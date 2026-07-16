"use client"

import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import {
  Droplets,
  Clock,
  Play,
  Square,
} from "lucide-react";
import type { Zone } from "../zones/ZoneManager";
import { useZones } from "../zones/ZoneManager";
import { useAppSettings } from "../settings/AppSettingsProvider";

export default function ManualActivation() {
  const { zones, setZoneState, updateZone } = useZones();
  const [tick, setTick] = useState(0);
  const activationRenderRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());
  const { waterCostPerLiter } = useAppSettings();
  

  // Manual control functions
  const toggleManualZone = async (zoneId: number) => {
    const zone = zones.find((z: Zone) => z.id === zoneId)
    if (!zone) return

    const newState = !zone.isActive
    setZoneState(zoneId, newState, zone.manualTimer)
  }

  useEffect(() => {
    // This effect can be used to handle any side effects related to manual activation
    (zones as Zone[]).forEach((zone: Zone) => {
      if (zone.isActive) {
        if (!activationRenderRef.current.has(zone.id)) {
          const timer = setInterval(() => {
            setTick((t: number) => t + 1); // force re-render
          }, 1000);
          activationRenderRef.current.set(zone.id, timer);
        }
      } else {
        const timer = activationRenderRef.current.get(zone.id);
        if (timer) {
          clearInterval(timer);
          activationRenderRef.current.delete(zone.id);
        }
      }
    });
  }, [zones.some((zone: Zone) => zone.isActive)]);


  return (
    <>
      {zones.map((zone: Zone) => (
          <Card key={zone.id} className="border-blue-200">
          <CardHeader className="pb-3">
              <CardTitle className="text-blue-900 flex items-center gap-2">
              <Droplets className="h-5 w-5" />
              {zone.name}
              </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                  <Label className="text-blue-800">Timer (minutes)</Label>
                  <Input
                  type="number"
                  min="1"
                  max="60"
                  value={zone.manualTimer}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateZone(zone.id, { manualTimer: Number.parseInt(e.target.value) || 1 })}
                  className="w-20 border-blue-200 focus:border-blue-500"
                  />
              </div>
              <Button
                  onClick={() => toggleManualZone(zone.id)}
                  variant={zone.isActive ? "destructive" : "default"}
                  className={zone.isActive ? "" : "bg-blue-600 hover:bg-blue-700"}
              >
                  {zone.isActive ? (
                  <>
                      <Square className="h-4 w-4 mr-2" />
                      Stop
                  </>
                  ) : (
                  <>
                      <Play className="h-4 w-4 mr-2" />
                      Start
                  </>
                  )}
              </Button>
              </div>

              {zone.isActive && (
              <div className="text-sm text-blue-600 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Running for {Math.floor((zone.activeUntil - Date.now() / 1000) / 60)} minutes and {Math.floor((zone.activeUntil - Date.now() / 1000) % 60)} seconds
              </div>
              )}

              <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                Water usage: {(zone.manualTimer * zone.flowRate).toFixed(0)}L • Cost: $
                {(zone.manualTimer * zone.flowRate * waterCostPerLiter).toFixed(2)}
              </div>
          </CardContent>
          </Card>
      ))}
    </>
  );
}
