import React from "react";
import ReactDOM from "react-dom/client";
import "./globals.css";
import App from "./App";
import { ConnectionManager } from "./components/connection-manager/ConnectionManager";
import { AppSettingsProvider } from "./components/settings/AppSettingsProvider";
import { SeasonManager } from "./components/seasons/SeasonManager";
import { ZoneManager } from "./components/zones/ZoneManager";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConnectionManager>
      <AppSettingsProvider>
        <SeasonManager>
          <ZoneManager>
            <App />
          </ZoneManager>
        </SeasonManager>
      </AppSettingsProvider>
    </ConnectionManager>
  </React.StrictMode>
);