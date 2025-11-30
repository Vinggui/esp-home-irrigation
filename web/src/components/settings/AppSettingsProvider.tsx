import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import type { SeasonalSettings } from "../../lib/types";

type AppSettingsContextType = {
    seasonalSettings: SeasonalSettings;
    setSeasonalSettings: (settings: SeasonalSettings) => void;
    waterCostPerLiter: number;
    setWaterCostPerLiter: (cost: number) => void;
    showSidebarSettings: boolean;
    setShowSidebarSettings: (show: boolean) => void;
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined)

export const useAppSettings = () => {
  const ctx = useContext(AppSettingsContext)
  if (!ctx) throw new Error("useAppSettings must be used within AppSettingsProvider")
  return ctx
}

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [seasonalSettings, setSeasonalSettings] = useState<SeasonalSettings>({
      enabled: true,
      spring: { multiplier: 1.0, months: [3, 4, 5] },
      summer: { multiplier: 1.4, months: [6, 7, 8] },
      fall: { multiplier: 0.8, months: [9, 10, 11] },
      winter: { multiplier: 0.4, months: [12, 1, 2] },
    });

    const [showSidebarSettings, setShowSidebarSettings] = useState(false);
    const [waterCostPerLiter, setWaterCostPerLiter] = useState(0.005);

  return (
    <AppSettingsContext.Provider value={{ seasonalSettings, setSeasonalSettings, waterCostPerLiter, setWaterCostPerLiter, showSidebarSettings, setShowSidebarSettings }}>
      {children}
    </AppSettingsContext.Provider>
  );
}