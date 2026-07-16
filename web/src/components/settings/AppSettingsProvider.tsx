import React, { createContext, useContext, useEffect, useState } from "react";
import type { SeasonalSettings } from "../../lib/types";

const normalizeSeasonalSettings = (value: Partial<SeasonalSettings> | undefined): SeasonalSettings => ({
  enabled: value?.enabled ?? true,
  spring: {
    multiplier: value?.spring?.multiplier ?? 1.0,
    months: value?.spring?.months ?? [3, 4, 5],
  },
  summer: {
    multiplier: value?.summer?.multiplier ?? 1.4,
    months: value?.summer?.months ?? [6, 7, 8],
  },
  fall: {
    multiplier: value?.fall?.multiplier ?? 0.8,
    months: value?.fall?.months ?? [9, 10, 11],
  },
  winter: {
    multiplier: value?.winter?.multiplier ?? 0.4,
    months: value?.winter?.months ?? [12, 1, 2],
  },
});

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
    const [seasonalSettings, setSeasonalSettingsState] = useState<SeasonalSettings>(normalizeSeasonalSettings());

    const [showSidebarSettings, setShowSidebarSettings] = useState(false);
    const [waterCostPerLiter, setWaterCostPerLiter] = useState(0.005);

    const setSeasonalSettings = (settings: SeasonalSettings) => {
      setSeasonalSettingsState(normalizeSeasonalSettings(settings));
    };

    useEffect(() => {
      const handleSettingsBroadcast = (event: Event) => {
        const detail = (event as CustomEvent).detail;
        if (!detail) return;

        if (typeof detail.water_cost_per_liter === "number") {
          setWaterCostPerLiter(detail.water_cost_per_liter);
        }

        if (detail.seasonal_settings && typeof detail.seasonal_settings === "object") {
          setSeasonalSettings(detail.seasonal_settings as Partial<SeasonalSettings>);
        }
      };

      window.addEventListener("settings:broadcast", handleSettingsBroadcast);
      return () => window.removeEventListener("settings:broadcast", handleSettingsBroadcast);
    }, []);

  return (
    <AppSettingsContext.Provider value={{ seasonalSettings, setSeasonalSettings, waterCostPerLiter, setWaterCostPerLiter, showSidebarSettings, setShowSidebarSettings }}>
      {children}
    </AppSettingsContext.Provider>
  );
}