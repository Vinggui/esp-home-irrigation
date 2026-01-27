#pragma once

#include <ArduinoJson.h>

#include "logger/Logger.hpp"
#include "server/WebAPITypes.hpp"
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
    void update();

    void test();

private:
    
    void SendBroadcastUpdate();

    Web::WebServer& m_webServer;
    Scheduler::Scheduler& m_scheduler;
    ZoneHandler m_zones[MAX_NUM_ZONES];
    uint8_t m_availableOutputPins[MAX_NUM_ZONES];
    uint8_t m_currentActiveZones[MAX_NUM_ZONES];
    bool m_needsBroadcastUpdate;
};

}; // namespace Zone