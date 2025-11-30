"use client"

import React, { useState } from "react";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import {
  Settings,
  Wifi,
} from "lucide-react";
import { useWebSocket } from "../connection-manager/ConnectionManager";
import { useAppSettings } from "../settings/AppSettingsProvider";
import { useSeasons } from "../seasons/SeasonManager";
import AppSettingsComponent from "../settings/AppSettingsComponent";

export default function StatusBar() {
    const { connected, lastSync } = useWebSocket();
    const { currentSeason, getSeasonName, getSeasonalMultiplier, getSeasonIcon } = useSeasons();
    const { seasonalSettings, waterCostPerLiter, setWaterCostPerLiter, setShowSidebarSettings } = useAppSettings();

    return (
        <>
            <div className="flex items-center gap-1">
                <Wifi className={`h-4 w-4 ${connected ? "text-green-500" : "text-red-500"}`} />
                <span>{connected ? "Connected" : "Disconnected"}</span>
            </div>
            <div className="flex items-center gap-1">
                <span>{getSeasonIcon(currentSeason)}</span>
                <span>
                {getSeasonName(currentSeason)} (
                {seasonalSettings.enabled ? `${(getSeasonalMultiplier() * 100).toFixed(0)}%` : "No adjustment"})
                </span>
            </div> 
            <span>Last sync: {lastSync.toLocaleTimeString()}</span>

            {/* Add a gear icon for a model view to change configurations */}
            <span
                className="text-blue-600 cursor-pointer hover:underline"
                onClick={() => setShowSidebarSettings(true)}
            >
                <Settings className="h-4 w-4 inline" />
                Settings
            </span>
            
            <AppSettingsComponent />
        </>
    )
}
