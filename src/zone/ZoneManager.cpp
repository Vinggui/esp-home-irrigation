#include <Arduino.h>

#include "Zone/ZoneManager.hpp"
#include "scheduler/Scheduler.hpp"

namespace Zone {

ZoneManager::ZoneManager(Scheduler::Scheduler& scheduler) : m_scheduler(scheduler) {
    for (uint8_t i = 0; i < MAX_NUM_ZONES; ++i) {
        m_availableOutputPins[i] = AVAILABLE_OUTPUT_PINS[i];
        m_currentActiveZones[i] = 0;
        pinMode(AVAILABLE_OUTPUT_PINS[i], OUTPUT);

        // Start each zone handler
        m_zones[i].begin(AVAILABLE_OUTPUT_PINS[i], &m_scheduler);
    }
}

void ZoneManager::registerZoneApiCb(const JsonDocument &request) {
    // Search for the first available zone slot
    for (uint8_t i = 0; i < MAX_NUM_ZONES; ++i) {
        if (m_currentActiveZones[i] == 0) {
            m_currentActiveZones[i] = 1; // Mark this zone as active
            LOG_INFO(zoneManagerLogger, "Zone %d registered successfully", i);
            return;
        }
    }
    LOG_ERROR_PGM(zoneManagerLogger, F("No available zones to register"));
}

void ZoneManager::setZoneStateApiCb(const JsonDocument &request) {
    int targetZone = -1;
    LOG_INFO_PGM(zoneManagerLogger, F("MSG received2"));
    if (request["zone"].is<uint8_t>()) {
        targetZone = static_cast<int>(request["zone"]);
        if ((targetZone < 0 || targetZone >= MAX_NUM_ZONES) &&
            m_currentActiveZones[targetZone] == 0) {
            LOG_ERROR(zoneManagerLogger, "Invalid zone number: %d", targetZone);
            return;
        }
    }
    LOG_INFO(zoneManagerLogger, "MSG received for zone %d", targetZone);
    if (targetZone >= 0 && request["value"].is<bool>()) {
        bool activate = request["value"];
        m_zones[targetZone].setRunning(activate);
        LOG_INFO(zoneManagerLogger, "Zone %d activated: %s", targetZone, activate ? "true" : "false");
    } else {
        LOG_ERROR(zoneManagerLogger, "Invalid request for activating zone %d", targetZone);
    }
}


void ZoneManager::test() {
    LOG_INFO_PGM(zoneManagerLogger, F("Starting ZoneManager test..."));
    m_zones[0].setRunning(true);
}

} // namespace Zone