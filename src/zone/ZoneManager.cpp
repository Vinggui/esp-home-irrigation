#include <Arduino.h>

#include "zone/ZoneManager.hpp"
#include "scheduler/Scheduler.hpp"

namespace Zone {

namespace {
    // Thunk to receive web server API calls and dispatch to member function
    void zoneApiReceiverCB(const JsonDocument &request, void* ctx) {
        auto *self = static_cast<Zone::ZoneManager*>(ctx);
        if (self) self->zoneStateApiHandler(request);
    }
}

ZoneManager::ZoneManager(Web::WebServer& webServer, Scheduler::Scheduler& scheduler) : 
    m_webServer(webServer),
    m_scheduler(scheduler) {
    m_needsBroadcastUpdate = false;
    for (uint8_t i = 0; i < MAX_NUM_ZONES; ++i) {
        m_availableOutputPins[i] = AVAILABLE_OUTPUT_PINS[i];
        m_currentActiveZones[i] = 0;
        pinMode(AVAILABLE_OUTPUT_PINS[i], OUTPUT);

        // Start each zone handler
        m_zones[i].begin(i, AVAILABLE_OUTPUT_PINS[i], &m_scheduler);
    }

    // Register the API callback for zone state changes
    m_webServer.registerCallback(Api::RequestType::SET_ZONE_STATE, &zoneApiReceiverCB, this);
}

bool ZoneManager::registerZone(const JsonDocument &request) {
    // Search for the first available zone slot
    for (uint8_t i = 0; i < MAX_NUM_ZONES; ++i) {
        if (m_currentActiveZones[i] == 0) {
            m_zones[i].cleanData();
            m_currentActiveZones[i] = 1; // Mark this zone as active
            LOG_INFO(zoneManagerLogger, "Zone %d registered successfully", i);
            return true;
        }
    }
    LOG_ERROR_PGM(zoneManagerLogger, F("No available zones to register"));
    return false;
}



void ZoneManager::zoneStateApiHandler(const JsonDocument &request) {
    bool response = false;
    if (request["command"] == "create_new_zone") {
        response = registerZone(request);
        if (response) { m_needsBroadcastUpdate = true; }
    } else if (request["command"] == "update_zones") {
        if (!request["zones"].is<JsonArrayConst>()) {
            LOG_ERROR_PGM(zoneManagerLogger, F("Zones data is not an array"));
            return;
        }
        JsonArrayConst zonesArray = request["zones"].as<JsonArrayConst>();
        // Expect all zones states in an array and no more than MAX_NUM_ZONES
        if (zonesArray.size() > MAX_NUM_ZONES) {
            LOG_ERROR_PGM(zoneManagerLogger, F("Too many zones in request"));

            // TODO: Consider sending an error response back
            return;
        }

        for (JsonVariantConst zoneVar : zonesArray) {
            if (zoneVar["zone"].is<uint8_t>() && zoneVar["value"].is<bool>()) {
                uint8_t zoneIndex = zoneVar["zone"];
                bool activate = zoneVar["value"];
                if (zoneIndex < MAX_NUM_ZONES &&
                    m_currentActiveZones[zoneIndex] == 1) {
                    m_zones[zoneIndex].setRunning(activate);
                    LOG_INFO(zoneManagerLogger, "Zone %d activated: %s", zoneIndex, activate ? "true" : "false");
                } else {
                    LOG_ERROR(zoneManagerLogger, "Invalid zone number: %d", zoneIndex);
                }
            } else {
                LOG_ERROR_PGM(zoneManagerLogger, F("Invalid zone data in request"));
            }
        }
    }


    // int targetZone = -1;
    // LOG_INFO_PGM(zoneManagerLogger, F("MSG received"));
    // if (request["zone"].is<uint8_t>()) {
    //     targetZone = static_cast<int>(request["zone"]);
    //     if ((targetZone < 0 || targetZone >= MAX_NUM_ZONES) &&
    //         m_currentActiveZones[targetZone] == 0) {
    //         LOG_ERROR(zoneManagerLogger, "Invalid zone number: %d", targetZone);
    //         return;
    //     }
    // }
    // LOG_INFO(zoneManagerLogger, "MSG received for zone %d", targetZone);
    // if (targetZone >= 0 && request["value"].is<bool>()) {
    //     bool activate = request["value"];
    //     m_zones[targetZone].setRunning(activate);
    //     LOG_INFO(zoneManagerLogger, "Zone %d activated: %s", targetZone, activate ? "true" : "false");
    // } else {
    //     LOG_ERROR(zoneManagerLogger, "Invalid request for activating zone %d", targetZone);
    // }

    JsonDocument responseDoc;
    responseDoc["api_response"] = request["command"];
    responseDoc["status"] = response;
    m_webServer.broadcastMessage(responseDoc);
}

void ZoneManager::SendBroadcastUpdate() {
    LOG_INFO_PGM(zoneManagerLogger, F("Broadcasting zones update..."));
    JsonDocument broadcastDoc;
    broadcastDoc["api_data"] = "all_zones_update";
    JsonArray zonesArray = broadcastDoc["zones"].to<JsonArray>();
    
    for (uint8_t i = 0; i < MAX_NUM_ZONES; ++i) {
        if (m_currentActiveZones[i] == 1) {
            JsonDocument zoneData = m_zones[i].toJson();
            zonesArray.add<JsonObject>(zoneData.as<JsonObject>());
        }
    }
    m_webServer.broadcastMessage(broadcastDoc);
}

void ZoneManager::update() {
    if (m_needsBroadcastUpdate) {
        SendBroadcastUpdate();
        m_needsBroadcastUpdate = false;
    }
}


void ZoneManager::test() {
    LOG_INFO_PGM(zoneManagerLogger, F("Starting ZoneManager test..."));
    m_zones[0].setRunning(true);
}

} // namespace Zone