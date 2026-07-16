#pragma once

#include <ArduinoJson.h>

#include "logger/Logger.hpp"
#include "api/WebAPITypes.hpp"
#include "ZoneHandler.hpp"
#include "contants/globals.hpp"
#include "server/WebServer.hpp"

namespace Zone {

LOG_NAME(zoneManagerLogger, "ZoneManager");

class ZoneManager {
public:
    ZoneManager(Web::WebServer& webServer, Scheduler::Scheduler& scheduler);
    void zoneStateApiHandler(const JsonDocument &request);
    bool registerZone(const JsonDocument &request);
    bool setZoneState(const JsonDocument &request);
    bool setZoneName(const JsonDocument &request);
    bool setZoneOutputPin(const JsonDocument &request);
    bool setWaterCostPerLiter(const JsonDocument &request);
    bool setSeasonalSettings(const JsonDocument &request);
    bool resetZoneUsage(const JsonDocument &request);
    bool saveSchedules(const JsonDocument &request);
    bool updateZones(const JsonDocument &request);
    void zoneStateChangedCallback();
    void buildStateSnapshot(JsonDocument &out);
    void update();

    void test();

private:
    
    void SendBroadcastUpdate();

    Web::WebServer& m_webServer;
    Scheduler::Scheduler& m_scheduler;
    ZoneHandler m_zones[MAX_NUM_ZONES];
    uint8_t m_availableOutputPins[MAX_NUM_ZONES];
    uint8_t m_currentActiveZones[MAX_NUM_ZONES];
    double m_waterCostPerLiter{0.005};
    unsigned long m_lastBroadcastMs{0};
    bool m_seasonalSettingsEnabled{true};
    double m_springMultiplier{1.0};
    double m_summerMultiplier{1.4};
    double m_fallMultiplier{0.8};
    double m_winterMultiplier{0.4};
    bool m_needsBroadcastUpdate;
};

}; // namespace Zone