"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Droplets,
  Clock,
  Play,
  Square,
  AlertTriangle,
  Wifi,
  BarChart3,
  Settings,
  TrendingUp,
  Download,
  Calendar,
  Plus,
  Trash2,
  Upload,
} from "lucide-react"

interface DailySchedule {
  id: string
  enabled: boolean
  startTime: string
  duration: number
  days: string[]
}

interface Zone {
  id: number
  name: string
  flowRate: number
  schedules: DailySchedule[]
  manualActive: boolean
  manualTimer: number
  stats: {
    totalVolume: number
    totalCost: number
    averageDaily: number
  }
}

interface SeasonalSettings {
  enabled: boolean
  spring: { multiplier: number; months: number[] }
  summer: { multiplier: number; months: number[] }
  fall: { multiplier: number; months: number[] }
  winter: { multiplier: number; months: number[] }
}

// Configuration for your ESP32 API endpoints
const API_BASE_URL = "http://192.168.1.100" // Change this to your ESP32's IP address
const API_ENDPOINTS = {
  schedule: `${API_BASE_URL}/api/schedule`,
  manual: `${API_BASE_URL}/api/manual`,
  status: `${API_BASE_URL}/api/status`,
}

export default function IrrigationController() {
  const [zones, setZones] = useState<Zone[]>([
    {
      id: 1,
      name: "Front Lawn",
      flowRate: 15,
      schedules: [
        {
          id: "1-default",
          enabled: false,
          startTime: "06:00",
          duration: 30,
          days: ["mon", "wed", "fri"],
        },
      ],
      manualActive: false,
      manualTimer: 10,
      stats: { totalVolume: 450, totalCost: 2.25, averageDaily: 15 },
    },
    {
      id: 2,
      name: "Back Yard",
      flowRate: 12,
      schedules: [
        {
          id: "2-default",
          enabled: false,
          startTime: "06:30",
          duration: 20,
          days: ["tue", "thu", "sat"],
        },
      ],
      manualActive: false,
      manualTimer: 10,
      stats: { totalVolume: 240, totalCost: 1.2, averageDaily: 8 },
    },
  ])

  const [conflicts, setConflicts] = useState<string[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [lastSync, setLastSync] = useState<Date>(new Date())
  const [waterCostPerLiter, setWaterCostPerLiter] = useState(0.005)
  const [isLoading, setIsLoading] = useState(false)

  const [seasonalSettings, setSeasonalSettings] = useState<SeasonalSettings>({
    enabled: true,
    spring: { multiplier: 1.0, months: [3, 4, 5] },
    summer: { multiplier: 1.4, months: [6, 7, 8] },
    fall: { multiplier: 0.8, months: [9, 10, 11] },
    winter: { multiplier: 0.4, months: [12, 1, 2] },
  })

  const dayOptions = [
    { value: "mon", label: "Mon" },
    { value: "tue", label: "Tue" },
    { value: "wed", label: "Wed" },
    { value: "thu", label: "Thu" },
    { value: "fri", label: "Fri" },
    { value: "sat", label: "Sat" },
    { value: "sun", label: "Sun" },
  ]

  const getCurrentSeason = (): keyof Omit<SeasonalSettings, "enabled"> => {
    const month = new Date().getMonth() + 1
    if (seasonalSettings.spring.months.includes(month)) return "spring"
    if (seasonalSettings.summer.months.includes(month)) return "summer"
    if (seasonalSettings.fall.months.includes(month)) return "fall"
    return "winter"
  }

  const currentSeason = getCurrentSeason()

  const getSeasonalMultiplier = (): number => {
    if (!seasonalSettings.enabled) return 1.0
    return seasonalSettings[currentSeason].multiplier
  }

  const getAdjustedDuration = (baseDuration: number): number => {
    return Math.round(baseDuration * getSeasonalMultiplier())
  }

  const getSeasonIcon = (season: string): string => {
    switch (season) {
      case "spring":
        return "🌱"
      case "summer":
        return "☀️"
      case "fall":
        return "🍂"
      case "winter":
        return "❄️"
      default:
        return "🌿"
    }
  }

  const getSeasonName = (season: string): string => {
    return season.charAt(0).toUpperCase() + season.slice(1)
  }

  // Check ESP32 connection status
  const checkConnection = async () => {
    try {
      console.error("Connection check ok1")
      const response = await fetch(API_ENDPOINTS.status, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      })
      setIsConnected(response.ok)
      if (response.ok) {
        console.error("Connection check ok")
        setLastSync(new Date())
      }
    } catch (error) {
      console.error("Connection check failed:", error)
      setIsConnected(false)
    }
  }

  // Check connection on component mount and every 30 seconds
  useEffect(() => {
    checkConnection()
    const interval = setInterval(checkConnection, 5000)
    return () => clearInterval(interval)
  }, [])

  // Zone management functions
  const addZone = () => {
    const newId = Math.max(...zones.map((z) => z.id), 0) + 1
    const newZone: Zone = {
      id: newId,
      name: `Zone ${newId}`,
      flowRate: 10,
      schedules: [],
      manualActive: false,
      manualTimer: 10,
      stats: { totalVolume: 0, totalCost: 0, averageDaily: 0 },
    }
    setZones((prev) => [...prev, newZone])
  }

  const removeZone = (zoneId: number) => {
    if (zones.length <= 1) return
    setZones((prev) => prev.filter((zone) => zone.id !== zoneId))
  }

  const updateZoneName = (zoneId: number, name: string) => {
    setZones((prev) => prev.map((zone) => (zone.id === zoneId ? { ...zone, name } : zone)))
  }

  const updateZone = (zoneId: number, updates: Partial<Zone>) => {
    setZones((prev) => prev.map((zone) => (zone.id === zoneId ? { ...zone, ...updates } : zone)))
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
    setZones((prev) =>
      prev.map((zone) => (zone.id === zoneId ? { ...zone, schedules: [...zone.schedules, newSchedule] } : zone)),
    )
  }

  const removeScheduleFromZone = (zoneId: number, scheduleId: string) => {
    setZones((prev) =>
      prev.map((zone) =>
        zone.id === zoneId ? { ...zone, schedules: zone.schedules.filter((s) => s.id !== scheduleId) } : zone,
      ),
    )
  }

  const updateZoneSchedule = (zoneId: number, scheduleId: string, updates: Partial<DailySchedule>) => {
    setZones((prev) =>
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

  const toggleDay = (zoneId: number, scheduleId: string, day: string) => {
    setZones((prev) =>
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

  // Manual control functions
  const toggleManualZone = async (zoneId: number) => {
    const zone = zones.find((z) => z.id === zoneId)
    if (!zone) return

    const newState = !zone.manualActive
    setIsLoading(true)

    try {
      const response = await fetch(API_ENDPOINTS.manual, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zone: zoneId,
          active: newState,
          duration: newState ? zone.manualTimer : 0,
          flowRate: zone.flowRate,
        }),
      })

      if (response.ok) {
        updateZone(zoneId, { manualActive: newState })
        setIsConnected(true)
        setLastSync(new Date())
      } else {
        throw new Error("Failed to control zone")
      }
    } catch (error) {
      console.error("Failed to send manual command:", error)
      setIsConnected(false)
      alert("Failed to control zone. Check your connection to the ESP32.")
    } finally {
      setIsLoading(false)
    }
  }

  // Import/Export functions
  const exportSetup = () => {
    const setupData = {
      zones: zones.map((zone) => ({
        id: zone.id,
        name: zone.name,
        flowRate: zone.flowRate,
        schedules: zone.schedules,
      })),
      waterCostPerLiter,
      seasonalSettings,
      exportedAt: new Date().toISOString(),
      version: "1.1",
    }

    const blob = new Blob([JSON.stringify(setupData, null, 2)], {
      type: "application/json",
    })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `irrigation-setup-${new Date().toISOString().split("T")[0]}.json`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const importSetup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const setupData = JSON.parse(e.target?.result as string)

        if (setupData.zones && Array.isArray(setupData.zones)) {
          setZones(
            setupData.zones.map((zone: any) => ({
              ...zone,
              manualActive: false,
              manualTimer: zone.manualTimer || 10,
              stats: zone.stats || { totalVolume: 0, totalCost: 0, averageDaily: 0 },
            })),
          )

          if (setupData.waterCostPerLiter) {
            setWaterCostPerLiter(setupData.waterCostPerLiter)
          }

          if (setupData.seasonalSettings) {
            setSeasonalSettings(setupData.seasonalSettings)
          }

          alert("Setup imported successfully!")
        } else {
          alert("Invalid setup file format")
        }
      } catch (error) {
        alert("Error importing setup file")
        console.error("Import error:", error)
      }
    }
    reader.readAsText(file)
    event.target.value = ""
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

        zone1.schedules.forEach((schedule1) => {
          zone2.schedules.forEach((schedule2) => {
            if (!schedule1.enabled || !schedule2.enabled) return

            const sharedDays = schedule1.days.filter((day) => schedule2.days.includes(day))
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

  const saveSchedules = async () => {
    if (conflicts.length > 0) {
      alert("Please resolve schedule conflicts before saving.")
      return
    }

    setIsLoading(true)

    const scheduleData = {
      zones: zones.map((zone) => ({
        id: zone.id,
        name: zone.name,
        flowRate: zone.flowRate,
        schedules: zone.schedules.map((schedule) => ({
          ...schedule,
          adjustedDuration: getAdjustedDuration(schedule.duration),
        })),
      })),
      seasonalSettings,
      currentSeason,
      timestamp: new Date().toISOString(),
    }

    try {
      const response = await fetch(API_ENDPOINTS.schedule, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scheduleData),
      })

      if (response.ok) {
        setLastSync(new Date())
        setIsConnected(true)
        alert("Schedules saved successfully!")
      } else {
        throw new Error("Failed to save schedules")
      }
    } catch (error) {
      console.error("Failed to save schedules:", error)
      setIsConnected(false)
      alert("Failed to save schedules. Check your connection to the ESP32.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Droplets className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-blue-900">ESP32 Irrigation Control</h1>
          </div>
          <div className="flex items-center justify-center gap-4 text-sm text-blue-600">
            <div className="flex items-center gap-1">
              <Wifi className={`h-4 w-4 ${isConnected ? "text-green-500" : "text-red-500"}`} />
              <span>{isConnected ? "Connected" : "Disconnected"}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>{getSeasonIcon(currentSeason)}</span>
              <span>
                {getSeasonName(currentSeason)} (
                {seasonalSettings.enabled ? `${(getSeasonalMultiplier() * 100).toFixed(0)}%` : "No adjustment"})
              </span>
            </div>
            <span>Last sync: {lastSync.toLocaleTimeString()}</span>
          </div>
          <div className="text-xs text-gray-500">
            ESP32 API: {API_BASE_URL} • {isLoading ? "Processing..." : "Ready"}
          </div>
        </div>

        {/* Connection Status Alert */}
        {!isConnected && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <div className="font-semibold mb-1">ESP32 Connection Issue</div>
              <div className="text-sm">
                Cannot connect to ESP32 at {API_BASE_URL}. Please check:
                <ul className="list-disc list-inside mt-1 ml-2">
                  <li>ESP32 is powered on and connected to WiFi</li>
                  <li>IP address is correct in the configuration</li>
                  <li>Your device is on the same network</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Conflicts Alert */}
        {conflicts.length > 0 && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <div className="font-semibold mb-2">Schedule Conflicts Detected:</div>
              {conflicts.map((conflict, index) => (
                <div key={index} className="text-sm">
                  {conflict}
                </div>
              ))}
            </AlertDescription>
          </Alert>
        )}

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
              Settings & Stats
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-4">
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
                  {zones.reduce((sum, zone) => sum + zone.schedules.filter((s) => s.enabled).length, 0)}
                </div>
              </CardContent>
            </Card>

            {/* Setup Import/Export */}
            <Card className="border-blue-200">
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
            </Card>

            {/* Individual Zones */}
            {zones.map((zone) => (
              <Card key={zone.id} className="border-blue-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <Droplets className="h-5 w-5 text-blue-600" />
                      <Input
                        value={zone.name}
                        onChange={(e) => updateZoneName(zone.id, e.target.value)}
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
                  <div className="flex items-center gap-4 mt-3">
                    <Label className="text-blue-800">Flow Rate:</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        max="50"
                        value={zone.flowRate}
                        onChange={(e) => updateZone(zone.id, { flowRate: Number.parseInt(e.target.value) || 1 })}
                        className="w-20 border-blue-200 focus:border-blue-500"
                      />
                      <span className="text-sm text-blue-600">L/min</span>
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
                              onCheckedChange={(enabled) => updateZoneSchedule(zone.id, schedule.id, { enabled })}
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
                                  onChange={(e) =>
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
                                  onChange={(e) =>
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
                                {dayOptions.map((day) => (
                                  <Badge
                                    key={day.value}
                                    variant={schedule.days.includes(day.value) ? "default" : "outline"}
                                    className={`cursor-pointer ${
                                      schedule.days.includes(day.value)
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
              onClick={saveSchedules}
              disabled={conflicts.length > 0 || isLoading || !isConnected}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isLoading
                ? "Saving..."
                : conflicts.length > 0
                  ? "Resolve Conflicts First"
                  : !isConnected
                    ? "ESP32 Not Connected"
                    : "Save All Schedules to ESP32"}
            </Button>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            {zones.map((zone) => (
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
                        onChange={(e) => updateZone(zone.id, { manualTimer: Number.parseInt(e.target.value) || 1 })}
                        className="w-20 border-blue-200 focus:border-blue-500"
                        disabled={zone.manualActive}
                      />
                    </div>
                    <Button
                      onClick={() => toggleManualZone(zone.id)}
                      variant={zone.manualActive ? "destructive" : "default"}
                      className={zone.manualActive ? "" : "bg-blue-600 hover:bg-blue-700"}
                      disabled={isLoading || !isConnected}
                    >
                      {isLoading ? (
                        "Processing..."
                      ) : zone.manualActive ? (
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

                  {zone.manualActive && (
                    <div className="text-sm text-blue-600 flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Running for {zone.manualTimer} minutes
                    </div>
                  )}

                  <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                    Water usage: {(zone.manualTimer * zone.flowRate).toFixed(0)}L • Cost: $
                    {(zone.manualTimer * zone.flowRate * waterCostPerLiter).toFixed(2)}
                  </div>

                  {!isConnected && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      ⚠️ ESP32 not connected - manual control unavailable
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            {/* Overall Statistics */}
            <Card className="border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-900 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Overall Usage Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {zones.reduce((sum, zone) => sum + zone.stats.totalVolume, 0).toFixed(0)}L
                    </div>
                    <div className="text-sm text-blue-800">Total Volume</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      ${zones.reduce((sum, zone) => sum + zone.stats.totalCost, 0).toFixed(2)}
                    </div>
                    <div className="text-sm text-blue-800">Total Cost</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {zones.reduce((sum, zone) => sum + zone.stats.averageDaily, 0).toFixed(1)}L
                    </div>
                    <div className="text-sm text-blue-800">Daily Average</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {zones.reduce((sum, zone) => sum + zone.schedules.filter((s) => s.enabled).length, 0)}
                    </div>
                    <div className="text-sm text-blue-800">Active Schedules</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ESP32 Configuration */}
            <Card className="border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-900 flex items-center gap-2">
                  <Wifi className="h-5 w-5" />
                  ESP32 Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-gray-50 p-3 rounded text-sm">
                    <strong>Current API Base URL:</strong> {API_BASE_URL}
                    <br />
                    <strong>Status:</strong>{" "}
                    <span className={isConnected ? "text-green-600" : "text-red-600"}>
                      {isConnected ? "Connected" : "Disconnected"}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <strong>To change the ESP32 IP address:</strong>
                    <ol className="list-decimal list-inside mt-1 ml-2 space-y-1">
                      <li>Edit the API_BASE_URL constant in the code</li>
                      <li>Update it to your ESP32's IP address (e.g., "http://192.168.1.100")</li>
                      <li>Ensure your ESP32 is on the same network</li>
                    </ol>
                  </div>
                  <Button onClick={checkConnection} className="bg-blue-600 hover:bg-blue-700" size="sm">
                    <Wifi className="h-4 w-4 mr-2" />
                    Test Connection
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Water Cost Settings */}
            <Card className="border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-900 flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Water Cost Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Label className="text-blue-800 min-w-fit">Water Cost (per liter):</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600">$</span>
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        value={waterCostPerLiter}
                        onChange={(e) => setWaterCostPerLiter(Number.parseFloat(e.target.value) || 0)}
                        className="w-24 border-blue-200 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Seasonal Adjustment Settings */}
            <Card className="border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-900 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span>{getSeasonIcon(currentSeason)}</span>
                    Seasonal Adjustments
                  </span>
                  <Switch
                    checked={seasonalSettings.enabled}
                    onCheckedChange={(enabled) => setSeasonalSettings((prev) => ({ ...prev, enabled }))}
                    className="data-[state=checked]:bg-blue-600"
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-blue-900">
                      Current Season: {getSeasonIcon(currentSeason)} {getSeasonName(currentSeason)}
                    </span>
                    <Badge className="bg-blue-600">
                      {seasonalSettings.enabled ? `${(getSeasonalMultiplier() * 100).toFixed(0)}%` : "Disabled"}
                    </Badge>
                  </div>
                  {seasonalSettings.enabled && (
                    <div className="text-sm text-blue-700">
                      Watering durations are{" "}
                      {getSeasonalMultiplier() > 1
                        ? "increased"
                        : getSeasonalMultiplier() < 1
                          ? "decreased"
                          : "unchanged"}{" "}
                      by {Math.abs((getSeasonalMultiplier() - 1) * 100).toFixed(0)}% for {currentSeason}
                    </div>
                  )}
                </div>

                {seasonalSettings.enabled && (
                  <div className="space-y-4">
                    <Label className="text-blue-800 font-medium">Season Multipliers</Label>

                    {/* Spring Settings */}
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🌱</span>
                        <div>
                          <div className="font-medium text-green-800">Spring</div>
                          <div className="text-sm text-green-600">March, April, May</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="3.0"
                          value={seasonalSettings.spring.multiplier}
                          onChange={(e) =>
                            setSeasonalSettings((prev) => ({
                              ...prev,
                              spring: { ...prev.spring, multiplier: Number.parseFloat(e.target.value) || 1.0 },
                            }))
                          }
                          className="w-20 border-green-200 focus:border-green-500"
                        />
                        <span className="text-sm text-green-600">×</span>
                      </div>
                    </div>

                    {/* Summer Settings */}
                    <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">☀️</span>
                        <div>
                          <div className="font-medium text-orange-800">Summer</div>
                          <div className="text-sm text-orange-600">June, July, August</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="3.0"
                          value={seasonalSettings.summer.multiplier}
                          onChange={(e) =>
                            setSeasonalSettings((prev) => ({
                              ...prev,
                              summer: { ...prev.summer, multiplier: Number.parseFloat(e.target.value) || 1.0 },
                            }))
                          }
                          className="w-20 border-orange-200 focus:border-orange-500"
                        />
                        <span className="text-sm text-orange-600">×</span>
                      </div>
                    </div>

                    {/* Fall Settings */}
                    <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🍂</span>
                        <div>
                          <div className="font-medium text-amber-800">Fall</div>
                          <div className="text-sm text-amber-600">September, October, November</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="3.0"
                          value={seasonalSettings.fall.multiplier}
                          onChange={(e) =>
                            setSeasonalSettings((prev) => ({
                              ...prev,
                              fall: { ...prev.fall, multiplier: Number.parseFloat(e.target.value) || 1.0 },
                            }))
                          }
                          className="w-20 border-amber-200 focus:border-amber-500"
                        />
                        <span className="text-sm text-amber-600">×</span>
                      </div>
                    </div>

                    {/* Winter Settings */}
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">❄️</span>
                        <div>
                          <div className="font-medium text-slate-800">Winter</div>
                          <div className="text-sm text-slate-600">December, January, February</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="3.0"
                          value={seasonalSettings.winter.multiplier}
                          onChange={(e) =>
                            setSeasonalSettings((prev) => ({
                              ...prev,
                              winter: { ...prev.winter, multiplier: Number.parseFloat(e.target.value) || 1.0 },
                            }))
                          }
                          className="w-20 border-slate-200 focus:border-slate-500"
                        />
                        <span className="text-sm text-slate-600">×</span>
                      </div>
                    </div>

                    <div className="bg-blue-50 p-3 rounded text-sm text-blue-800">
                      <strong>How it works:</strong>
                      <ul className="mt-1 space-y-1 list-disc list-inside">
                        <li>Base durations are multiplied by seasonal factors</li>
                        <li>Summer typically needs more water (1.4× = 40% increase)</li>
                        <li>Winter needs less water (0.4× = 60% decrease)</li>
                        <li>Adjustments are applied automatically based on current date</li>
                        <li>ESP32 receives both base and adjusted durations</li>
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Zone Statistics */}
            {zones.map((zone) => (
              <Card key={zone.id} className="border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-blue-900 flex items-center gap-2">
                    <Droplets className="h-5 w-5" />
                    {zone.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <div className="text-sm text-blue-800">Flow Rate</div>
                      <div className="font-semibold text-blue-600">{zone.flowRate} L/min</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-blue-800">Total Volume</div>
                      <div className="font-semibold text-blue-600">{zone.stats.totalVolume.toFixed(0)}L</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-blue-800">Total Cost</div>
                      <div className="font-semibold text-green-600">${zone.stats.totalCost.toFixed(2)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-blue-800">Active Schedules</div>
                      <div className="font-semibold text-blue-600">
                        {zone.schedules.filter((s) => s.enabled).length}
                      </div>
                    </div>
                  </div>

                  {/* Schedule Summary */}
                  {zone.schedules.filter((s) => s.enabled).length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm text-blue-800 font-medium">Active Schedules:</div>
                      <div className="space-y-1">
                        {zone.schedules
                          .filter((s) => s.enabled)
                          .map((schedule, index) => (
                            <div key={schedule.id} className="text-sm bg-blue-50 p-2 rounded">
                              <strong>Schedule {index + 1}:</strong> {schedule.startTime} for {schedule.duration}min on{" "}
                              {schedule.days.join(", ")}
                              <br />
                              <span className="text-blue-600">
                                Base water usage: {(schedule.duration * zone.flowRate).toFixed(0)}L per run
                              </span>
                              {seasonalSettings.enabled && (
                                <>
                                  <br />
                                  <span className="text-green-600">
                                    Adjusted ({getSeasonName(currentSeason)}):{" "}
                                    {(getAdjustedDuration(schedule.duration) * zone.flowRate).toFixed(0)}L per run
                                  </span>
                                </>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Efficiency Metrics */}
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-blue-100">
                    <div className="space-y-1">
                      <div className="text-sm text-blue-800">Cost per Hour</div>
                      <div className="font-semibold text-blue-600">
                        ${(zone.flowRate * 60 * waterCostPerLiter).toFixed(2)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-blue-800">Efficiency Rating</div>
                      <div className="flex items-center gap-1">
                        <div className="font-semibold text-green-600">
                          {zone.flowRate > 10 ? "High" : zone.flowRate > 5 ? "Medium" : "Low"}
                        </div>
                        <div
                          className={`w-2 h-2 rounded-full ${
                            zone.flowRate > 10 ? "bg-green-500" : zone.flowRate > 5 ? "bg-yellow-500" : "bg-red-500"
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
