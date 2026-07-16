"use client"

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import {
  Droplets,
  Clock,
  AlertTriangle,
  Settings,
  Plus,
  Trash2,
} from "lucide-react";
import type { Zone } from "../zones/ZoneManager";
import { useZones } from "../zones/ZoneManager";
import { useSeasons } from "../seasons/SeasonManager";
import type { DailySchedule } from "../../lib/types";
import { useAppSettings } from "../settings/AppSettingsProvider";
import { useScheduleDirty } from "../../App";

export default function Schedule() {
  const [conflicts, setConflicts] = useState<string[]>([])
  const [nameDrafts, setNameDrafts] = useState<Record<number, string>>({})
  const { zones,
          addZone,
          removeZone,
          updateZone, 
          updateZoneName,
          updateZonePin,
          addScheduleToZone,
          updateZoneSchedule,
          removeScheduleFromZone,
          toggleDay,
          saveSchedules: saveSchedulesToServer,
          savedZones,
  } = useZones();
  const { setDirty, isDirty } = useScheduleDirty();

  const { currentSeason,
          getSeasonIcon,
          getSeasonName,
          getSeasonalMultiplier,
          getAdjustedDuration,
  } = useSeasons();

  const { seasonalSettings } = useAppSettings();
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string>("");

  const buildCurrentSnapshot = (sourceZones: Zone[] = zones) =>
    JSON.stringify({
      zones: sourceZones.map((zone: Zone) => ({
        id: zone.id,
        name: zone.name,
        pinNumber: zone.pinNumber,
        flowRate: zone.flowRate,
        schedules: zone.schedules.map((schedule: DailySchedule) => ({
          id: schedule.id,
          enabled: schedule.enabled,
          startTime: schedule.startTime,
          duration: schedule.duration,
          days: schedule.days,
        })),
      })),
      seasonalSettings,
      currentSeason,
    });

  const handleSaveSchedules = () => {
    if (conflicts.length > 0) return

    const scheduleData = {
      zones: zones.map((zone: Zone) => ({
        id: zone.id,
        name: zone.name,
        flowRate: zone.flowRate,
        schedules: zone.schedules.map((schedule: DailySchedule) => ({
          ...schedule,
          adjustedDuration: getAdjustedDuration(schedule.duration),
        })),
      })),
      seasonalSettings,
      currentSeason,
      timestamp: new Date().toISOString(),
    }

    try {
      saveSchedulesToServer();
      const snapshot = buildCurrentSnapshot();
      setLastSavedSnapshot(snapshot);
      setHasLocalChanges(false);
      setDirty(false);
    } catch (error) {
      console.error("Failed to save schedules:", error)
    }
  };

  // Conflict detection
  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number)
    return hours * 60 + minutes
  };
  const checkConflicts = () => {
    const newConflicts: string[] = []

    for (let i = 0; i < zones.length; i++) {
      for (let j = i + 1; j < zones.length; j++) {
        const zone1 = zones[i]
        const zone2 = zones[j]

        zone1.schedules.forEach((schedule1: DailySchedule) => {
          zone2.schedules.forEach((schedule2: DailySchedule) => {
            if (!schedule1.enabled || !schedule2.enabled) return

            const sharedDays = schedule1.days.filter((day) => schedule2.days.includes(day))
            if (sharedDays.length === 0) {return;}

            const start1 = timeToMinutes(schedule1.startTime)
            const end1 = start1 + getAdjustedDuration(schedule1.duration)
            const start2 = timeToMinutes(schedule2.startTime)
            const end2 = start2 + getAdjustedDuration(schedule2.duration)

            if (start1 < end2 && end1 > start2) {
              // Convert sharedDays to a readable format
              const readableDays = sharedDays.map((day) => {
                const dayOption = dayOptions.find((option) => option.value === day);
                return dayOption ? dayOption.Name : day;
              });
              newConflicts.push(
                `${zone1.name} (${schedule1.startTime}) and ${zone2.name} (${schedule2.startTime}) overlap on ${readableDays.join(", ")}`,
              )
            }
          })
        })
      }
    }

    setConflicts(newConflicts)
  };
  
  useEffect(() => {
    console.log("Zones or seasonal settings changed");
    checkConflicts();
  }, [zones, seasonalSettings]);

  useEffect(() => {
    const handleSaveRequest = () => {
      const snapshot = buildCurrentSnapshot();
      setLastSavedSnapshot(snapshot);
      setHasLocalChanges(false);
      setDirty(false);
    };

    const handleDiscardRequest = () => {
      setLastSavedSnapshot(buildCurrentSnapshot(savedZones));
      setHasLocalChanges(false);
      setDirty(false);
    };

    window.addEventListener("schedule:save-request", handleSaveRequest);
    window.addEventListener("schedule:discard-request", handleDiscardRequest);

    return () => {
      window.removeEventListener("schedule:save-request", handleSaveRequest);
      window.removeEventListener("schedule:discard-request", handleDiscardRequest);
    };
  }, [savedZones, setDirty]);

  useEffect(() => {
    if (savedZones.length > 0) {
      const savedSnapshot = buildCurrentSnapshot(savedZones);
      setLastSavedSnapshot(savedSnapshot);
    }
  }, [savedZones]);

  useEffect(() => {
    const snapshot = buildCurrentSnapshot();

    if (lastSavedSnapshot === "") {
      const hasExistingState =
        zones.length > 0 ||
        currentSeason !== undefined ||
        Object.keys(seasonalSettings || {}).length > 0;

      if (hasExistingState) {
        setLastSavedSnapshot(snapshot);
        setHasLocalChanges(false);
        setDirty(false);
      } else {
        setHasLocalChanges(false);
        setDirty(false);
      }

      return;
    }

    const isModified = snapshot !== lastSavedSnapshot;
    setHasLocalChanges(isModified);
    setDirty(isModified);
  }, [zones, seasonalSettings, currentSeason, lastSavedSnapshot, setDirty]);

  const availablePins = [2, 17, 18, 19];

  const dayOptions = [
    { value: "mon", label: "Mon", Name: "Monday" },
    { value: "tue", label: "Tue", Name: "Tuesday" },
    { value: "wed", label: "Wed", Name: "Wednesday" },
    { value: "thu", label: "Thu", Name: "Thursday" },
    { value: "fri", label: "Fri", Name: "Friday" },
    { value: "sat", label: "Sat", Name: "Saturday" },
    { value: "sun", label: "Sun", Name: "Sunday" },
  ];
  

  return (
    <>
    {/* Conflicts Alert */}
    {conflicts.length > 0 && (
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          <div className="font-semibold mb-2">Schedule Conflicts Detected:</div>
          {conflicts.map((conflict: string, index: number) => (
            <div key={index} className="text-sm">
              {conflict}
            </div>
          ))}
        </AlertDescription>
      </Alert>
    )}
    
    {/* Zone Management */}
    <Card className="border-blue-200">
      <CardHeader>
        <CardTitle className="text-blue-900 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Zone Management
          </span>
          <Button onClick={addZone} className="bg-green-600 hover:bg-green-700" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Zone
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-blue-600">
          Total Zones: {zones.length} • Active Schedules:{" "}
          {zones.reduce((sum: number, zone: Zone) => sum + zone.schedules.filter((s: DailySchedule) => s.enabled).length, 0)}
        </div>
      </CardContent>
    </Card>

    {/* Setup Import/Export */}
    {/* <Card className="border-blue-200">
      <CardHeader>
        <CardTitle className="text-blue-900 flex items-center gap-2">
          <Download className="h-5 w-5" />
          Setup Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={exportSetup} className="flex-1 bg-blue-600 hover:bg-blue-700">
            <Download className="h-4 w-4 mr-2" />
            Export Setup
          </Button>
          <div className="flex-1">
            <input type="file" accept=".json" onChange={importSetup} className="hidden" id="import-setup" />
            <Button
              onClick={() => document.getElementById("import-setup")?.click()}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import Setup
            </Button>
          </div>
        </div>
        <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded mt-3">
          <strong>Setup includes:</strong> Zone configurations, schedules, flow rates, seasonal settings, and
          water cost
        </div>
      </CardContent>
    </Card> */}

    {/* Individual Zones */}
    {zones.map((zone: Zone) => (
      <Card key={zone.id} className="border-blue-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <Droplets className="h-5 w-5 text-blue-600" />
              <Input
                value={nameDrafts[zone.id] ?? zone.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setNameDrafts((prev) => ({ ...prev, [zone.id]: e.target.value }))
                }}
                onBlur={() => {
                  const draft = nameDrafts[zone.id] ?? zone.name
                  if (draft !== zone.name) {
                    updateZoneName(zone.id, draft)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    const draft = nameDrafts[zone.id] ?? zone.name
                    if (draft !== zone.name) {
                      updateZoneName(zone.id, draft)
                    }
                    e.currentTarget.blur()
                  }
                }}
                className="font-semibold text-blue-900 border-none p-0 h-auto bg-transparent focus:bg-white focus:border-blue-500"
                placeholder="Zone name"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => addScheduleToZone(zone.id)}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Schedule
              </Button>
              {zones.length > 1 && (
                <Button onClick={() => removeZone(zone.id)} size="sm" variant="destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Flow Rate Setting */}
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-blue-800">Output Pin:</Label>
              <select
                value={zone.pinNumber}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateZonePin(zone.id, Number(e.target.value))}
                className="rounded border border-blue-200 bg-white px-2 py-1 text-sm text-blue-900"
              >
                {availablePins
                  .filter((pin) => pin === zone.pinNumber || !zones.some((other: Zone) => other.id !== zone.id && other.pinNumber === pin))
                  .map((pin) => (
                    <option key={pin} value={pin}>
                      GPIO {pin}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-blue-800">Flow Rate:</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={zone.flowRate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateZone(zone.id, { flowRate: Number.parseInt(e.target.value) || 1 })}
                  className="w-20 border-blue-200 focus:border-blue-500"
                />
                <span className="text-sm text-blue-600">L/min</span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {zone.schedules.length === 0 ? (
            <div className="text-center py-8 text-blue-600 bg-blue-50 rounded-lg">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No schedules configured</p>
              <p className="text-sm">Click "Add Schedule" to create a watering schedule</p>
            </div>
          ) : (
            zone.schedules.map((schedule, index) => (
              <div key={schedule.id} className="border border-blue-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={schedule.enabled}
                      onCheckedChange={(enabled: boolean) => updateZoneSchedule(zone.id, schedule.id, { enabled })}
                      className="data-[state=checked]:bg-blue-600"
                    />
                    <Label className="text-blue-800 font-medium">Schedule {index + 1}</Label>
                  </div>
                  <Button
                    onClick={() => removeScheduleFromZone(zone.id, schedule.id)}
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {schedule.enabled && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-blue-800">Start Time</Label>
                        <Input
                          type="time"
                          value={schedule.startTime}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateZoneSchedule(zone.id, schedule.id, { startTime: e.target.value })
                          }
                          className="border-blue-200 focus:border-blue-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-blue-800">Duration (minutes)</Label>
                        <Input
                          type="number"
                          min="1"
                          max="120"
                          value={schedule.duration}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateZoneSchedule(zone.id, schedule.id, {
                              duration: Number.parseInt(e.target.value) || 0,
                            })
                          }
                          className="border-blue-200 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-blue-800">Active Days</Label>
                      <div className="flex flex-wrap gap-2">
                        {dayOptions.map((day: { value: string; label: string }) => (
                          <Badge
                            key={day.value}
                            variant={schedule.days.includes(day.value) ? "default" : "outline"}
                            className={`cursor-pointer ${schedule.days.includes(day.value)
                              ? "bg-blue-600 hover:bg-blue-700"
                              : "border-blue-300 text-blue-700 hover:bg-blue-50"
                              }`}
                            onClick={() => toggleDay(zone.id, schedule.id, day.value)}
                          >
                            {day.label}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Schedule Preview */}
                    <div className="bg-blue-50 p-3 rounded text-sm text-blue-800">
                      <strong>Preview:</strong>{" "}
                      {schedule.days.length > 0
                        ? `Runs ${schedule.startTime} for ${schedule.duration} minutes on ${schedule.days.join(", ")}`
                        : "No days selected"}
                      {seasonalSettings.enabled && (
                        <>
                          <br />
                          <strong>
                            Seasonal adjustment ({getSeasonIcon(currentSeason)} {getSeasonName(currentSeason)}):
                          </strong>{" "}
                          {schedule.duration} min → {getAdjustedDuration(schedule.duration)} min (
                          {getSeasonalMultiplier() > 1 ? "+" : ""}
                          {((getSeasonalMultiplier() - 1) * 100).toFixed(0)}%)
                        </>
                      )}
                      <br />
                      <strong>Water usage:</strong>{" "}
                      {(getAdjustedDuration(schedule.duration) * zone.flowRate).toFixed(0)}L per run
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    ))}

    <Button
      onClick={handleSaveSchedules}
      disabled={conflicts.length > 0 || !isDirty}
      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-green-400"
    >
      {conflicts.length > 0 ? "Resolve Conflicts First" : isDirty ? "Save All Schedules" : "No Changes to Save"}
    </Button>
    </>
  );
}
