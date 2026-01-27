"use client"

import React, { useState, createContext, useContext, useEffect, useRef } from "react";
import { useWebSocket } from "../connection-manager/ConnectionManager";
import { useSeasons } from "../seasons/SeasonManager";
import type { DailySchedule } from "../../lib/types";
import { useAppSettings } from "../settings/AppSettingsProvider";

export interface Zone {
    id: number
    name: string
    flowRate: number
    schedules: DailySchedule[]
    isActive: boolean
    manualTimer: number
    activeUntil: number // in seconds
    stats: {
        totalVolume: number
        totalCost: number
        averageDaily: number
    }
}

type ZoneContextType = {
  zones: Zone[];
  toggleDay: (zoneId: number, scheduleId: string, day: string) => void;
  setZoneState: (zoneId: number, state: boolean, duration: number) => void;
  addZone: () => void;
  removeZone: (zoneId: number) => void;
  updateZoneName: (zoneId: number, name: string) => void;
  updateZone: (zoneId: number, updates: Partial<Zone>) => void;
  addScheduleToZone: (zoneId: number) => void;
  removeScheduleFromZone: (zoneId: number, scheduleId: string) => void;
  updateZoneSchedule: (zoneId: number, scheduleId: string, updates: Partial<DailySchedule>) => void;
}

const ZoneContext = createContext<ZoneContextType | undefined>(undefined)

export const useZones = () => {
  const ctx = useContext(ZoneContext);
  if (!ctx) { throw new Error("useZones must be used within a ZoneManager"); }
  return ctx;
};

export const ZoneManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getAdjustedDuration, currentSeason } = useSeasons();
  const { seasonalSettings } = useAppSettings();
  const { subscribe, unsubscribe, connected, sendMessage } = useWebSocket();
  const [zones, setZones] = useState<Zone[]>([
    // {
    //   id: 1,
    //   name: "Front Lawn",
    //   flowRate: 15,
    //   schedules: [
    //     {
    //       id: "1-default",
    //       enabled: false,
    //       startTime: "06:00",
    //       duration: 30,
    //       days: ["mon", "wed", "fri"],
    //     },
    //   ],
    //   isActive: false,
    //   activeUntil: 0,
    //   manualTimer: 10,
    //   stats: { totalVolume: 450, totalCost: 2.25, averageDaily: 15 },
    // },
    // {
    //   id: 2,
    //   name: "Back Yard",
    //   flowRate: 12,
    //   schedules: [
    //     {
    //       id: "2-default",
    //       enabled: false,
    //       startTime: "06:30",
    //       duration: 20,
    //       days: ["tue", "thu", "sat"],
    //     },
    //   ],
    //   isActive: false,
    //   activeUntil: 0,
    //   manualTimer: 10,
    //   stats: { totalVolume: 240, totalCost: 1.2, averageDaily: 8 },
    // },
  ]);
  const [conflicts, setConflicts] = useState<string[]>([]);

  // Zone management functions
  const addZone = () => {
    // const newId = Math.max(...zones.map((z: Zone) => z.id), 0) + 1
    // const newZone: Zone = {
    //   id: newId,
    //   name: `Zone ${newId}`,
    //   flowRate: 10,
    //   schedules: [],
    //   isActive: false,
    //   activeUntil: 0,
    //   manualTimer: 10,
    //   stats: { totalVolume: 0, totalCost: 0, averageDaily: 0 },
    // }
    // setZones((prev: Zone[]) => [...prev, newZone])
    console.debug("Adding new zone...");
    sendMessage({
      api_handler: "set_zone_state",
      command: "create_new_zone",
    });
  }

  const removeZone = (zoneId: number) => {
    if (zones.length <= 1) return
    setZones((prev: Zone[]) => prev.filter((zone) => zone.id !== zoneId))
  }

  const updateZoneName = (zoneId: number, name: string) => {
    setZones((prev: Zone[]) => prev.map((zone) => (zone.id === zoneId ? { ...zone, name } : zone)))
  }

  const updateZone = (zoneId: number, updates: Partial<Zone>) => {
    setZones((prev: Zone[]) => prev.map((zone) => (zone.id === zoneId ? { ...zone, ...updates } : zone)))
  }

  // Schedule management functions
  const addScheduleToZone = (zoneId: number) => {
    const newSchedule: DailySchedule = {
      id: `${zoneId}-${Date.now()}`,
      enabled: false,
      startTime: "06:00",
      duration: 30,
      days: [],
    }
    setZones((prev: Zone[]) =>
      prev.map((zone) => (zone.id === zoneId ? { ...zone, schedules: [...zone.schedules, newSchedule] } : zone)),
    )
  }

  const removeScheduleFromZone = (zoneId: number, scheduleId: string) => {
    setZones((prev: Zone[]) =>
      prev.map((zone) =>
        zone.id === zoneId ? { ...zone, schedules: zone.schedules.filter((s) => s.id !== scheduleId) } : zone,
      ),
    )
  }

  const updateZoneSchedule = (zoneId: number, scheduleId: string, updates: Partial<DailySchedule>) => {
    setZones((prev: Zone[]) =>
      prev.map((zone) =>
        zone.id === zoneId
          ? {
            ...zone,
            schedules: zone.schedules.map((schedule) =>
              schedule.id === scheduleId ? { ...schedule, ...updates } : schedule,
            ),
          }
          : zone,
      ),
    )
  }

  // Conflict detection
  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number)
    return hours * 60 + minutes
  }

  const checkConflicts = () => {
    const newConflicts: string[] = []

    for (let i = 0; i < zones.length; i++) {
      for (let j = i + 1; j < zones.length; j++) {
        const zone1 = zones[i]
        const zone2 = zones[j]

        zone1.schedules.forEach((schedule1: DailySchedule) => {
          zone2.schedules.forEach((schedule2: DailySchedule) => {
            if (!schedule1.enabled || !schedule2.enabled) return

            const sharedDays = schedule1.days.filter((day: string) => schedule2.days.includes(day))
            if (sharedDays.length === 0) return

            const start1 = timeToMinutes(schedule1.startTime)
            const end1 = start1 + getAdjustedDuration(schedule1.duration)
            const start2 = timeToMinutes(schedule2.startTime)
            const end2 = start2 + getAdjustedDuration(schedule2.duration)

            if (start1 < end2 && end1 > start2) {
              newConflicts.push(
                `${zone1.name} (${schedule1.startTime}) and ${zone2.name} (${schedule2.startTime}) overlap on ${sharedDays.join(", ")}`,
              )
            }
          })
        })
      }
    }

    setConflicts(newConflicts)
  }

  useEffect(() => {
    checkConflicts()
  }, [zones, seasonalSettings])

  
  useEffect(() => {
    subscribe("all_zones_update", (data: any) => {
      console.debug("Received zones update:", data);
    });
  }, [])

  const saveSchedules = async () => {
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
      await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scheduleData),
      })
      // setLastSync(new Date())
    } catch (error) {
      console.error("Failed to save schedules:", error)
    }
  }

  const setZoneState = (zoneId: number, state: boolean, duration: number) => {
    // Calculate the activeUntil time in seconds epoch
    const nextActiveUntil = state ? Math.floor(Date.now() / 1000) + duration : 0;
    let ObjectToSend = {
      command: "set_zone_state",
      zone: zoneId,
      value: state,
    };
    
    try {
      sendMessage(ObjectToSend);
    } catch (error) {
      console.error("Failed to send manual command:", error)
    }

    setZones((prev: Zone[]) =>
      prev.map((zone) =>
        zone.id === zoneId ? { ...zone, isActive: state, activeUntil: nextActiveUntil } : zone,
      ),
    )
  }

  const toggleDay = (zoneId: number, scheduleId: string, day: string) => {
    setZones((prev: Zone[]) =>
      prev.map((zone) => {
        if (zone.id === zoneId) {
          return {
            ...zone,
            schedules: zone.schedules.map((schedule) => {
              if (schedule.id === scheduleId) {
                const newDays = schedule.days.includes(day)
                  ? schedule.days.filter((d) => d !== day)
                  : [...schedule.days, day]
                return { ...schedule, days: newDays }
              }
              return schedule
            }),
          }
        }
        return zone
      }),
    )
  }

  return (
    <ZoneContext.Provider value={{ 
      zones, 
      toggleDay,
      setZoneState, 
      addZone, 
      removeZone, 
      updateZoneName, 
      updateZone, 
      addScheduleToZone, 
      removeScheduleFromZone, 
      updateZoneSchedule }}>
        {children}
    </ZoneContext.Provider>
  );
}
