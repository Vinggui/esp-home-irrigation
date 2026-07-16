"use client"

import React, { useEffect, useState } from "react";
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
    const { sendMessage } = useWebSocket();
    const [waterCostDraft, setWaterCostDraft] = useState(String(waterCostPerLiter));
    const [seasonDrafts, setSeasonDrafts] = useState({
        spring: String(seasonalSettings.spring.multiplier),
        summer: String(seasonalSettings.summer.multiplier),
        fall: String(seasonalSettings.fall.multiplier),
        winter: String(seasonalSettings.winter.multiplier),
    });

    useEffect(() => {
        setWaterCostDraft(String(waterCostPerLiter));
    }, [waterCostPerLiter]);

    useEffect(() => {
        setSeasonDrafts({
            spring: String(seasonalSettings.spring.multiplier),
            summer: String(seasonalSettings.summer.multiplier),
            fall: String(seasonalSettings.fall.multiplier),
            winter: String(seasonalSettings.winter.multiplier),
        });
    }, [seasonalSettings]);

    const commitWaterCost = () => {
        const nextValue = Number.parseFloat(waterCostDraft) || 0;
        if (nextValue !== waterCostPerLiter) {
            setWaterCostPerLiter(nextValue);
            sendMessage({
                api_handler: "set_zone_state",
                command: "set_water_cost",
                cost: nextValue,
            });
        }
    };

    const commitSeasonalSettings = (updates: Partial<SeasonalSettings>) => {
        const nextSettings = { ...seasonalSettings, ...updates };
        setSeasonalSettings(nextSettings);
        sendMessage({
            api_handler: "set_zone_state",
            command: "set_seasonal_settings",
            settings: nextSettings,
        });
    };

    const commitSeasonMultiplier = (season: keyof Pick<SeasonalSettings, "spring" | "summer" | "fall" | "winter">) => {
        const nextValue = Number.parseFloat(seasonDrafts[season]) || 1.0;
        const nextSettings = {
            ...seasonalSettings,
            [season]: {
                ...seasonalSettings[season],
                multiplier: nextValue,
            },
        };

        if (nextSettings[season].multiplier !== seasonalSettings[season].multiplier) {
            setSeasonalSettings(nextSettings);
            sendMessage({
                api_handler: "set_zone_state",
                command: "set_seasonal_settings",
                settings: nextSettings,
            });
        }
    };

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
                                value={waterCostDraft}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWaterCostDraft(e.target.value)}
                                onBlur={commitWaterCost}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        commitWaterCost();
                                        e.currentTarget.blur();
                                    }
                                }}
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
                            onCheckedChange={(enabled: boolean) => commitSeasonalSettings({ enabled })}
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
                                    value={seasonDrafts.spring}
                                    onChange={(e) => setSeasonDrafts((prev) => ({ ...prev, spring: e.target.value }))}
                                    onBlur={() => commitSeasonMultiplier("spring")}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            commitSeasonMultiplier("spring");
                                            e.currentTarget.blur();
                                        }
                                    }}
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
                                    value={seasonDrafts.summer}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSeasonDrafts((prev) => ({ ...prev, summer: e.target.value }))}
                                    onBlur={() => commitSeasonMultiplier("summer")}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            commitSeasonMultiplier("summer");
                                            e.currentTarget.blur();
                                        }
                                    }}
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
                                    value={seasonDrafts.fall}
                                    onChange={(e) => setSeasonDrafts((prev) => ({ ...prev, fall: e.target.value }))}
                                    onBlur={() => commitSeasonMultiplier("fall")}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            commitSeasonMultiplier("fall");
                                            e.currentTarget.blur();
                                        }
                                    }}
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
                                    value={seasonDrafts.winter}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSeasonDrafts((prev) => ({ ...prev, winter: e.target.value }))}
                                    onBlur={() => commitSeasonMultiplier("winter")}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            commitSeasonMultiplier("winter");
                                            e.currentTarget.blur();
                                        }
                                    }}
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
