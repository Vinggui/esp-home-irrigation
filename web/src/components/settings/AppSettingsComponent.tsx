"use client"

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { useWebSocket } from "../connection-manager/ConnectionManager";
import { useAppSettings } from "../settings/AppSettingsProvider";
import { useSeasons } from "../seasons/SeasonManager";
import type { SeasonalSettings } from "../../lib/types";
import {
  Settings,
} from "lucide-react";

export default function AppSettingsComponent() {
    const { currentSeason, getSeasonName, getSeasonalMultiplier, getSeasonIcon } = useSeasons();
    const { seasonalSettings, waterCostPerLiter, setWaterCostPerLiter, setSeasonalSettings, showSidebarSettings, setShowSidebarSettings } = useAppSettings();

    return (
        <>
            <div
                className={`fixed top-0 right-0 h-full w-100 bg-white shadow-lg z-50 transition-transform duration-300 overflow-y-auto ${
                    showSidebarSettings ? "translate-x-0" : "translate-x-full"
                }`}
                style={{ willChange: "transform" }}
            >
                <button
                    className="absolute top-4 right-4 text-xl"
                    onClick={() => setShowSidebarSettings(false)}
                >
                    &times;
                </button>
                <div className="p-6">
                    <h2 className="text-lg font-bold mb-4">Settings</h2>
                    
                    <Card className="border-blue-200">
                        <CardHeader>
                        <CardTitle className="text-blue-900 flex items-center gap-2 justify-center">
                            Water Cost
                        </CardTitle>
                        </CardHeader>
                        <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 justify-center">
                                <span className="text-blue-600">$</span>
                                <Input
                                type="number"
                                step="0.001"
                                min="0"
                                value={waterCostPerLiter}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWaterCostPerLiter(Number.parseFloat(e.target.value) || 0)}
                                className="w-24 border-blue-200 focus:border-blue-500"
                                />
                                per liter
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
                            onCheckedChange={(enabled: boolean) => setSeasonalSettings((prev: SeasonalSettings) => ({ ...prev, enabled }))}
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
                                    setSeasonalSettings((prev: SeasonalSettings) => ({
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
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    setSeasonalSettings((prev: SeasonalSettings) => ({
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
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    setSeasonalSettings((prev: SeasonalSettings) => ({
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
                                </ul>
                            </div>
                            </div>
                        )}
                        </CardContent>
                    </Card>

                </div>
            </div>
            {/* Overlay */}
            {showSidebarSettings && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-30 z-40"
                    onClick={() => setShowSidebarSettings(false)}
                />
            )}
        </>
    )
}
