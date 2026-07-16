"use client"

import React, { useState, createContext, useContext, useEffect, useRef } from "react";
import { useWebSocket } from "../connection-manager/ConnectionManager";
import { useSeasons } from "../seasons/SeasonManager";
import type { DailySchedule } from "../../lib/types";
import { useAppSettings } from "../settings/AppSettingsProvider";

export interface Zone {
    id: number
    name: string
    pinNumber: number
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
  updateZoneStates: (updates: { zone: number; value: boolean; duration?: number }[]) => void;
  resetZoneUsage: (zoneId: number) => void;
  addZone: () => void;
  removeZone: (zoneId: number) => void;
  updateZoneName: (zoneId: number, name: string) => void;
  updateZonePin: (zoneId: number, pinNumber: number) => void;
  updateZone: (zoneId: number, updates: Partial<Zone>) => void;
  addScheduleToZone: (zoneId: number) => void;
  removeScheduleFromZone: (zoneId: number, scheduleId: string) => void;
  updateZoneSchedule: (zoneId: number, scheduleId: string, updates: Partial<DailySchedule>) => void;
  saveSchedules: () => void;
  savedZones: Zone[];
  saveZonesSnapshot: (snapshot?: Zone[]) => void;
  restoreZonesToSavedSnapshot: () => void;
}

const ZoneContext = createContext<ZoneContextType | undefined>(undefined)

export const useZones = () => {
  const ctx = useContext(ZoneContext);
  if (!ctx) { throw new Error("useZones must be used within a ZoneManager"); }
  return ctx;
};

export const ZoneManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getAdjustedDuration, currentSeason } = useSeasons();
  const { seasonalSettings, waterCostPerLiter } = useAppSettings();
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
  const [savedZones, setSavedZones] = useState<Zone[]>([]);

  const cloneZones = (source: Zone[]): Zone[] =>
    source.map((zone) => ({
      ...zone,
      schedules: zone.schedules.map((schedule) => ({
        ...schedule,
        days: [...schedule.days],
      })),
    }));

  const saveZonesSnapshot = (snapshot: Zone[] = zones) => {
    setSavedZones(cloneZones(snapshot));
  };

  const restoreZonesToSavedSnapshot = () => {
    setZones(cloneZones(savedZones));
  };

  const normalizeStartTime = (value: unknown) => {
    if (typeof value === "number") {
      const totalMinutes = Math.max(0, Math.floor(value / 60));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
        return trimmed;
      }

      const numericValue = Number(trimmed);
      if (!Number.isNaN(numericValue)) {
        const totalMinutes = Math.max(0, Math.floor(numericValue / 60));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
      }
    }

    return "00:00";
  };

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

    sendMessage({
      api_handler: "set_zone_state",
      command: "set_zone_name",
      zone: zoneId,
      name,
    })
  }

  const updateZone = (zoneId: number, updates: Partial<Zone>) => {
    setZones((prev: Zone[]) => prev.map((zone) => (zone.id === zoneId ? { ...zone, ...updates } : zone)))
  }

  const updateZonePin = (zoneId: number, pinNumber: number) => {
    setZones((prev: Zone[]) => prev.map((zone) => (zone.id === zoneId ? { ...zone, pinNumber } : zone)))
    sendMessage({
      api_handler: "set_zone_state",
      command: "set_zone_output",
      zone: zoneId,
      pin: pinNumber,
    })
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
    const handler = subscribe("all_zones_update", (data: any) => {
      if (!Array.isArray(data.zones)) {
        console.warn("Received invalid zones update payload", data);
        return;
      }

      const parsedZones: Zone[] = data.zones.map((zone: any) => ({
        id: typeof zone.zone_id === "number" ? zone.zone_id : zone.id,
        name: zone.zone_name ?? zone.name ?? `Zone ${zone.zone_id}`,
        pinNumber: typeof zone.pin_number === "number" ? zone.pin_number : 0,
        flowRate: typeof zone.flow_rate === "number" ? zone.flow_rate : 0,
        schedules: Array.isArray(zone.schedules)
          ? zone.schedules.map((schedule: any) => ({
              id: schedule.id?.toString() ?? `${zone.zone_id}-${Date.now()}`,
              enabled: Boolean(schedule.enabled),
              startTime: normalizeStartTime(schedule.start_time ?? schedule.startTime),
              duration: typeof schedule.duration === "number" ? schedule.duration : 0,
              days: Array.isArray(schedule.days_of_week) ? schedule.days_of_week : [],
            }))
          : [],
        isActive: Boolean(zone.is_active),
        manualTimer: typeof zone.manual_timer === "number" ? zone.manual_timer : 10,
        activeUntil:
          typeof zone.active_until === "number"
            ? Math.floor(Date.now() / 1000) + zone.active_until
            : 0,
        stats: {
          totalVolume: typeof zone.stats?.totalVolume === "number" ? zone.stats.totalVolume : 0,
          totalCost: typeof zone.stats?.totalCost === "number" ? zone.stats.totalCost : 0,
          averageDaily: typeof zone.stats?.averageDaily === "number" ? zone.stats.averageDaily : 0,
        },
      }))

      setZones(parsedZones);
      setSavedZones(cloneZones(parsedZones));
      console.debug("Received zones update:", parsedZones);
    });
    return () => {
      unsubscribe(handler);
    };
  }, [subscribe, unsubscribe]);

  const saveSchedules = () => {
    if (conflicts.length > 0) return

    const scheduleData = {
      api_handler: "set_zone_state",
      command: "save_schedules",
      waterCostPerLiter,
      zones: zones.map((zone: Zone) => ({
        id: zone.id,
        name: zone.name,
        flowRate: zone.flowRate,
        schedules: zone.schedules.map((schedule: DailySchedule) => ({
          id: schedule.id,
          enabled: schedule.enabled,
          startTime: schedule.startTime,
          start_time: schedule.startTime,
          duration: schedule.duration,
          days: schedule.days,
          days_of_week: schedule.days,
        })),
      })),
    }

    try {
      saveZonesSnapshot(zones);
      sendMessage(scheduleData)
    } catch (error) {
      console.error("Failed to save schedules:", error)
    }
  }

  const setZoneState = (zoneId: number, state: boolean, durationMinutes: number) => {
    const nextActiveUntil = state ? Math.floor(Date.now() / 1000) + durationMinutes * 60 : 0;
    const ObjectToSend = {
      api_handler: "set_zone_state",
      command: "set_zone_state",
      zone: zoneId,
      value: state,
      duration: durationMinutes,
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

  const resetZoneUsage = (zoneId: number) => {
    const ObjectToSend = {
      api_handler: "set_zone_state",
      command: "reset_zone_usage",
      zone: zoneId,
    };

    try {
      sendMessage(ObjectToSend);
    } catch (error) {
      console.error("Failed to reset zone usage:", error);
    }
  };

  const updateZoneStates = (updates: { zone: number; value: boolean; duration?: number }[]) => {
    const ObjectToSend = {
      api_handler: "set_zone_state",
      command: "update_zones",
      zones: updates,
    };

    try {
      sendMessage(ObjectToSend);
    } catch (error) {
      console.error("Failed to send batch zone update:", error)
    }

    setZones((prev: Zone[]) =>
      prev.map((zone) => {
        const zoneUpdate = updates.find((update) => update.zone === zone.id);
        if (!zoneUpdate) return zone;
        const nextRemainingSeconds = zoneUpdate.value && typeof zoneUpdate.duration === "number" ? zoneUpdate.duration * 60 : 0;
        return {
          ...zone,
          isActive: zoneUpdate.value,
          activeUntil: nextRemainingSeconds,
        };
      }),
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
      updateZoneStates,
      resetZoneUsage,
      addZone,
      removeZone,
      updateZoneName,
      updateZonePin,
      updateZone,
      addScheduleToZone,
      removeScheduleFromZone,
      updateZoneSchedule,
      saveSchedules,
      savedZones,
      saveZonesSnapshot,
      restoreZonesToSavedSnapshot,
    }}>
      {children}
    </ZoneContext.Provider>
  );
}
