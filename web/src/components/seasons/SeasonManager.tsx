"use client"

import React, { useState, createContext, useContext } from "react";
import type { SeasonalSettings } from "../../lib/types";
import { useAppSettings } from "../settings/AppSettingsProvider";

type SeasonContextType = {
    currentSeason: string;
    getAdjustedDuration: (baseDuration: number) => number;
    getSeasonIcon: (season: string) => string;
    getSeasonName: (season: string) => string;
    getSeasonalMultiplier: () => number;
}

const SeasonContext = createContext<SeasonContextType | undefined>(undefined)

export const useSeasons = () => {
  const ctx = useContext(SeasonContext)
  if (!ctx) { throw new Error("useSeasons must be used within a SeasonManager");}
  return ctx;
};

export const SeasonManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { seasonalSettings } =  useAppSettings();

    const getCurrentSeason = (): keyof Omit<SeasonalSettings, "enabled"> => {
        const month = new Date().getMonth() + 1;
        if (seasonalSettings.spring.months.includes(month)) { return "spring"; }
        if (seasonalSettings.summer.months.includes(month)) { return "summer"; }
        if (seasonalSettings.fall.months.includes(month)) { return "fall"; }
        return "winter";
    }

    const currentSeason = getCurrentSeason();

    const getSeasonalMultiplier = (): number => {
        if (!seasonalSettings.enabled) { return 1.0 };
        return seasonalSettings[currentSeason].multiplier;
    }

    const getAdjustedDuration = (baseDuration: number): number => {
        return Math.round(baseDuration * getSeasonalMultiplier());
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
        return season.charAt(0).toUpperCase() + season.slice(1);
    }

    return (
        <SeasonContext.Provider value={{
            currentSeason,
            getAdjustedDuration,
            getSeasonIcon,
            getSeasonName,
            getSeasonalMultiplier
        }}>
            {children}
        </SeasonContext.Provider>
    )
}
