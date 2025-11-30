"use client"

import type React from "react";

import { useState, useEffect, useRef } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
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

export default function App() {
  const { subscribe, unsubscribe, connected } = useWebSocket();

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

        <Tabs defaultValue="schedule" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-blue-100">
            <TabsTrigger value="schedule" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Calendar className="h-4 w-4 mr-2" />
              Schedule
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
      </div>
    </div>
  )
}
