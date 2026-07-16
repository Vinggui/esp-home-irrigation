"use client"

import type React from "react";

import { useState, useEffect, useRef, createContext, useContext } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./components/ui/alert-dialog";
import {
  Droplets,
  Play,
  BarChart3,
  Calendar,
} from "lucide-react";
import { useWebSocket } from "./components/connection-manager/ConnectionManager";
import StatusBar from "./components/status-bar/StatusBar";
import ManualActivation from "./components/tabs/ManualActivation";
import Schedule from "./components/tabs/Schedule";
import Usage from "./components/tabs/Usage";
import { useZones } from "./components/zones/ZoneManager";

type ScheduleDirtyContextType = {
  isDirty: boolean;
  setDirty: (value: boolean) => void;
  confirmLeave: (nextTab?: string) => boolean;
};

const ScheduleDirtyContext = createContext<ScheduleDirtyContextType | undefined>(undefined);

export const useScheduleDirty = () => {
  const ctx = useContext(ScheduleDirtyContext);
  if (!ctx) throw new Error("useScheduleDirty must be used within App");
  return ctx;
};

export default function App() {
  const { subscribe, unsubscribe, connected } = useWebSocket();
  const { saveSchedules: saveSchedulesToServer, restoreZonesToSavedSnapshot } = useZones();
  const [activeTab, setActiveTab] = useState("schedule");
  const [scheduleDirty, setScheduleDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  const resetDirtyState = () => {
    restoreZonesToSavedSnapshot();
    setScheduleDirty(false);
  };

  const confirmLeave = (nextTab?: string) => {
    if (!scheduleDirty) return true;

    setPendingTab(nextTab ?? null);
    setShowLeaveDialog(true);
    return false;
  };

  const handleSaveAndLeave = () => {
    saveSchedulesToServer();
    setScheduleDirty(false);
    window.dispatchEvent(new CustomEvent("schedule:save-request"));
    if (pendingTab) {
      setActiveTab(pendingTab);
    }
    setPendingTab(null);
    setShowLeaveDialog(false);
  };

  const handleDiscardAndLeave = () => {
    resetDirtyState();
    window.dispatchEvent(new CustomEvent("schedule:discard-request"));
    if (pendingTab) {
      setActiveTab(pendingTab);
    }
    setPendingTab(null);
    setShowLeaveDialog(false);
  };

  const handleTabChange = (value: string) => {
    if (value === activeTab) return;
    if (!confirmLeave(value)) return;
    setActiveTab(value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Droplets className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-blue-900">Irrigation Control</h1>
          </div>
          <div className="flex items-center justify-center gap-4 text-sm text-blue-600">
            <StatusBar />
          </div>
        </div>

        <ScheduleDirtyContext.Provider value={{ isDirty: scheduleDirty, setDirty: setScheduleDirty, confirmLeave }}>
          <AlertDialog open={showLeaveDialog} onOpenChange={(open) => {
            if (!open) {
              setPendingTab(null);
              setShowLeaveDialog(false);
            }
          }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>You have unsaved schedule changes</AlertDialogTitle>
                <AlertDialogDescription>
                  Save the current schedule changes before leaving, or discard them and continue.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => {
                  setPendingTab(null);
                  setShowLeaveDialog(false);
                }}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDiscardAndLeave}>Discard</AlertDialogAction>
                <AlertDialogAction onClick={handleSaveAndLeave}>Save</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-blue-100">
              <TabsTrigger value="schedule" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Calendar className="h-4 w-4 mr-2" />
                Schedule{scheduleDirty ? " •" : ""}
              </TabsTrigger>
              <TabsTrigger value="manual" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Play className="h-4 w-4 mr-2" />
                Manual Control
              </TabsTrigger>
              <TabsTrigger value="stats" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <BarChart3 className="h-4 w-4 mr-2" />
                Usage Stats
              </TabsTrigger>
            </TabsList>

            <TabsContent value="schedule" className="space-y-4">
              <Schedule />
            </TabsContent>

            <TabsContent value="manual" className="space-y-4">
              <ManualActivation />
            </TabsContent>

            <TabsContent value="stats" className="space-y-4">
              <Usage />
            </TabsContent>
          </Tabs>
        </ScheduleDirtyContext.Provider>
      </div>
    </div>
  )
}
