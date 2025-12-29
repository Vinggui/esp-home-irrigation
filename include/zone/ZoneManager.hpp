#pragma once

#include <ArduinoJson.h>

#include "logger/Logger.hpp"
#include "server/WebAPITypes.hpp"
#include "ZoneHandler.hpp"
#include "contants/globals.hpp"

namespace Zone {

LOG_NAME(zoneManagerLogger, "ZoneManager");

class ZoneManager {
public:
    ZoneManager(Scheduler::Scheduler& scheduler);

    void setZoneStateApiCb(const JsonDocument &request);
    void registerZoneApiCb(const JsonDocument &request);

    void test();

private:
    Scheduler::Scheduler& m_scheduler;
    ZoneHandler m_zones[MAX_NUM_ZONES];
    uint8_t m_availableOutputPins[MAX_NUM_ZONES];
    uint8_t m_currentActiveZones[MAX_NUM_ZONES];
};

}; // namespace Zone