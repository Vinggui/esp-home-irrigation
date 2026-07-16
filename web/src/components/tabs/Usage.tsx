"use client"

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import {
  Droplets,
  Settings,
  TrendingUp,
} from "lucide-react";
import type { Zone } from "../zones/ZoneManager";
import { useZones } from "../zones/ZoneManager";
import { useSeasons } from "../seasons/SeasonManager";
import { useAppSettings } from "../settings/AppSettingsProvider";

export default function Usage() {
  const { zones, resetZoneUsage } = useZones();
const { currentSeason, getSeasonName, getAdjustedDuration } = useSeasons();
const { seasonalSettings, waterCostPerLiter, setWaterCostPerLiter } = useAppSettings();

  return (
    <>
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
                {zones.reduce((sum: number, zone: Zone) => sum + zone.stats.totalVolume, 0).toFixed(0)}L
            </div>
            <div className="text-sm text-blue-800">Total Volume</div>
            </div>
            <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
                ${zones.reduce((sum: number, zone: Zone) => sum + zone.stats.totalCost, 0).toFixed(2)}
            </div>
            <div className="text-sm text-blue-800">Total Cost</div>
            </div>
            <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
                {zones.reduce((sum: number, zone: Zone) => sum + zone.stats.averageDaily, 0).toFixed(1)}L
            </div>
            <div className="text-sm text-blue-800">Daily Average</div>
            </div>
            <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
                {zones.reduce((sum: number, zone: Zone) => sum + zone.schedules.filter((s) => s.enabled).length, 0)}
            </div>
            <div className="text-sm text-blue-800">Active Schedules</div>
            </div>
        </div>
        </CardContent>
    </Card>

    {/* Zone Statistics */}
    {zones.map((zone: Zone) => (
        <Card key={zone.id} className="border-blue-200">
        <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-blue-900 flex items-center gap-2">
                <Droplets className="h-5 w-5" />
                {zone.name}
            </CardTitle>
            <button
                type="button"
                onClick={() => resetZoneUsage(zone.id)}
                className="rounded border border-blue-200 bg-white px-3 py-1 text-sm text-blue-700 hover:bg-blue-50"
            >
                Reset Usage
            </button>
            </div>
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
            {/* <div className="space-y-1">
                <div className="text-sm text-blue-800">Efficiency Rating</div>
                <div className="flex items-center gap-1">
                <div className="font-semibold text-green-600">
                    {zone.flowRate > 10 ? "High" : zone.flowRate > 5 ? "Medium" : "Low"}
                </div>
                <div
                    className={`w-2 h-2 rounded-full ${zone.flowRate > 10 ? "bg-green-500" : zone.flowRate > 5 ? "bg-yellow-500" : "bg-red-500"
                    }`}
                />
                </div>
            </div> */}
            </div>
        </CardContent>
        </Card>
    ))}
    </>
  );
}
