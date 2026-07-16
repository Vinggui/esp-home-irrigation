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

    // Thunk to notify the manager when a zone state changes outside of an API request
    void zoneStateChangedThunk(void* ctx) {
        auto *self = static_cast<Zone::ZoneManager*>(ctx);
        if (self) self->zoneStateChangedCallback();
    }

    void zoneStateSnapshotCallback(void* ctx, JsonDocument &doc) {
        auto *self = static_cast<Zone::ZoneManager*>(ctx);
        if (self) self->buildStateSnapshot(doc);
    }
}

ZoneManager::ZoneManager(Web::WebServer& webServer, Scheduler::Scheduler& scheduler) : 
    m_webServer(webServer),
    m_scheduler(scheduler) {
    m_needsBroadcastUpdate = false;
    for (uint8_t i = 0; i < MAX_NUM_ZONES; ++i) {
        m_availableOutputPins[i] = AVAILABLE_OUTPUT_PINS[i];
        m_currentActiveZones[i] = 0;

        // Start each zone handler
        m_zones[i].begin(i, AVAILABLE_OUTPUT_PINS[i], &m_scheduler);
        m_zones[i].setStateChangedCallback(&zoneStateChangedThunk, this);
    }

    // Register the API callback for zone state changes
    m_webServer.registerCallback(Api::RequestType::SET_ZONE_STATE, &zoneApiReceiverCB, this);
    m_webServer.registerStateSnapshotCallback(&zoneStateSnapshotCallback, this);
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

bool ZoneManager::setZoneState(const JsonDocument &request) {
    if (!request["zone"].is<uint8_t>() || !request["value"].is<bool>()) {
        LOG_ERROR_PGM(zoneManagerLogger, F("Invalid set_zone_state request"));
        return false;
    }

    uint8_t zoneIndex = request["zone"];
    if (zoneIndex >= MAX_NUM_ZONES || m_currentActiveZones[zoneIndex] == 0) {
        LOG_ERROR(zoneManagerLogger, "Invalid zone number: %d", zoneIndex);
        return false;
    }

    bool activate = request["value"];
    if (request["duration"].is<uint8_t>()) {
        m_zones[zoneIndex].setManualWateringDuration(request["duration"]);
    }

    bool success = m_zones[zoneIndex].setRunning(activate);
    if (success) {
        LOG_INFO(zoneManagerLogger, "Zone %d activated: %s", zoneIndex, activate ? "true" : "false");
        return true;
    }

    LOG_ERROR(zoneManagerLogger, "Failed to change state for zone %d", zoneIndex);
    return false;
}

bool ZoneManager::setZoneName(const JsonDocument &request) {
    if (!request["zone"].is<uint8_t>() || !request["name"].is<const char*>()) {
        LOG_ERROR_PGM(zoneManagerLogger, F("Invalid set_zone_name request"));
        return false;
    }

    uint8_t zoneIndex = request["zone"];
    if (zoneIndex >= MAX_NUM_ZONES || m_currentActiveZones[zoneIndex] == 0) {
        LOG_ERROR(zoneManagerLogger, "Invalid zone number: %d", zoneIndex);
        return false;
    }

    const char* newName = request["name"];
    m_zones[zoneIndex].setName(newName);
    LOG_INFO(zoneManagerLogger, "Zone %d renamed to %s", zoneIndex, newName);
    return true;
}

bool ZoneManager::setZoneOutputPin(const JsonDocument &request) {
    if (!request["zone"].is<uint8_t>() || !request["pin"].is<uint8_t>()) {
        LOG_ERROR_PGM(zoneManagerLogger, F("Invalid set_zone_output request"));
        return false;
    }

    uint8_t zoneIndex = request["zone"];
    uint8_t pinNumber = request["pin"];
    if (zoneIndex >= MAX_NUM_ZONES || m_currentActiveZones[zoneIndex] == 0) {
        LOG_ERROR(zoneManagerLogger, "Invalid zone number: %d", zoneIndex);
        return false;
    }

    bool pinInAllowedList = false;
    for (uint8_t i = 0; i < MAX_NUM_ZONES; ++i) {
        if (AVAILABLE_OUTPUT_PINS[i] == pinNumber) {
            pinInAllowedList = true;
            break;
        }
    }
    if (!pinInAllowedList) {
        LOG_ERROR(zoneManagerLogger, "Pin %d is not an allowed output pin", pinNumber);
        return false;
    }

    for (uint8_t i = 0; i < MAX_NUM_ZONES; ++i) {
        if (i == zoneIndex) {
            continue;
        }
        if (m_currentActiveZones[i] == 1 && m_availableOutputPins[i] == pinNumber) {
            LOG_ERROR(zoneManagerLogger, "Pin %d is already in use by another zone", pinNumber);
            return false;
        }
    }

    m_zones[zoneIndex].setOutputPin(pinNumber);
    m_availableOutputPins[zoneIndex] = pinNumber;
    LOG_INFO(zoneManagerLogger, "Zone %d assigned to pin %d", zoneIndex, pinNumber);
    return true;
}

bool ZoneManager::setWaterCostPerLiter(const JsonDocument &request) {
    double parsedCost = -1.0;

    if (request["cost"].is<double>() || request["cost"].is<int>()) {
        parsedCost = request["cost"].as<double>();
    } else if (request["waterCostPerLiter"].is<double>() || request["waterCostPerLiter"].is<int>()) {
        parsedCost = request["waterCostPerLiter"].as<double>();
    }

    if (parsedCost < 0.0) {
        LOG_ERROR_PGM(zoneManagerLogger, F("Invalid water cost value"));
        return false;
    }

    m_waterCostPerLiter = parsedCost;
    LOG_INFO(zoneManagerLogger, "Water cost updated to %.4f", m_waterCostPerLiter);
    return true;
}

bool ZoneManager::setSeasonalSettings(const JsonDocument &request) {
    if (!request["settings"].is<JsonObjectConst>()) {
        LOG_ERROR_PGM(zoneManagerLogger, F("Invalid seasonal settings payload"));
        return false;
    }

    JsonObjectConst settings = request["settings"].as<JsonObjectConst>();

    if (settings["enabled"].is<bool>()) {
        m_seasonalSettingsEnabled = settings["enabled"].as<bool>();
    }

    if (settings["spring"]["multiplier"].is<double>() || settings["spring"]["multiplier"].is<int>()) {
        m_springMultiplier = settings["spring"]["multiplier"].as<double>();
    }
    if (settings["summer"]["multiplier"].is<double>() || settings["summer"]["multiplier"].is<int>()) {
        m_summerMultiplier = settings["summer"]["multiplier"].as<double>();
    }
    if (settings["fall"]["multiplier"].is<double>() || settings["fall"]["multiplier"].is<int>()) {
        m_fallMultiplier = settings["fall"]["multiplier"].as<double>();
    }
    if (settings["winter"]["multiplier"].is<double>() || settings["winter"]["multiplier"].is<int>()) {
        m_winterMultiplier = settings["winter"]["multiplier"].as<double>();
    }

    LOG_INFO(zoneManagerLogger, "Seasonal settings updated");
    return true;
}

bool ZoneManager::resetZoneUsage(const JsonDocument &request) {
    if (!request["zone"].is<uint8_t>()) {
        LOG_ERROR_PGM(zoneManagerLogger, F("Invalid zone reset request"));
        return false;
    }

    uint8_t zoneIndex = request["zone"];
    if (zoneIndex >= MAX_NUM_ZONES || m_currentActiveZones[zoneIndex] == 0) {
        LOG_ERROR(zoneManagerLogger, "Invalid zone number: %d", zoneIndex);
        return false;
    }

    m_zones[zoneIndex].resetUsage();
    LOG_INFO(zoneManagerLogger, "Usage reset for zone %d", zoneIndex);
    return true;
}

bool ZoneManager::saveSchedules(const JsonDocument &request) {
    if (!request["zones"].is<JsonArrayConst>()) {
        LOG_ERROR_PGM(zoneManagerLogger, F("Schedules data is not an array"));
        return false;
    }

    JsonArrayConst zonesArray = request["zones"].as<JsonArrayConst>();
    if (zonesArray.size() > MAX_NUM_ZONES) {
        LOG_ERROR_PGM(zoneManagerLogger, F("Too many zones in save request"));
        return false;
    }

    bool anySuccess = false;
    for (JsonVariantConst zoneVar : zonesArray) {
        if (!zoneVar["id"].is<uint8_t>()) {
            continue;
        }

        uint8_t zoneIndex = zoneVar["id"];
        if (zoneIndex >= MAX_NUM_ZONES || m_currentActiveZones[zoneIndex] == 0) {
            LOG_ERROR(zoneManagerLogger, "Invalid zone number: %d", zoneIndex);
            continue;
        }

        if (zoneVar["name"].is<const char*>()) {
            m_zones[zoneIndex].setName(zoneVar["name"]);
        }

        if (zoneVar["flowRate"].is<double>() || zoneVar["flowRate"].is<int>()) {
            m_zones[zoneIndex].setFlowRate(zoneVar["flowRate"].as<double>());
        }

        if (zoneVar["schedules"].is<JsonArrayConst>()) {
            m_zones[zoneIndex].setSchedules(zoneVar["schedules"].as<JsonArrayConst>());
        }

        anySuccess = true;
    }

    return anySuccess;
}

bool ZoneManager::updateZones(const JsonDocument &request) {
    if (!request["zones"].is<JsonArrayConst>()) {
        LOG_ERROR_PGM(zoneManagerLogger, F("Zones data is not an array"));
        return false;
    }
    JsonArrayConst zonesArray = request["zones"].as<JsonArrayConst>();
    if (zonesArray.size() > MAX_NUM_ZONES) {
        LOG_ERROR_PGM(zoneManagerLogger, F("Too many zones in request"));
        return false;
    }

    bool anySuccess = false;
    for (JsonVariantConst zoneVar : zonesArray) {
        if (zoneVar["zone"].is<uint8_t>() && zoneVar["value"].is<bool>()) {
            uint8_t zoneIndex = zoneVar["zone"];
            bool activate = zoneVar["value"];
            if (zoneIndex < MAX_NUM_ZONES && m_currentActiveZones[zoneIndex] == 1) {
                if (m_zones[zoneIndex].setRunning(activate)) {
                    anySuccess = true;
                    LOG_INFO(zoneManagerLogger, "Zone %d activated: %s", zoneIndex, activate ? "true" : "false");
                }
            } else {
                LOG_ERROR(zoneManagerLogger, "Invalid zone number: %d", zoneIndex);
            }
        } else {
            LOG_ERROR_PGM(zoneManagerLogger, F("Invalid zone data in request"));
        }
    }
    return anySuccess;
}

void ZoneManager::zoneStateApiHandler(const JsonDocument &request) {
    bool response = false;
    if (request["command"] == "create_new_zone") {
        response = registerZone(request);
        if (response) { m_needsBroadcastUpdate = true; }
    } else if (request["command"] == "set_zone_state") {
        response = setZoneState(request);
        if (response) { m_needsBroadcastUpdate = true; }
    } else if (request["command"] == "set_zone_name") {
        response = setZoneName(request);
        if (response) { m_needsBroadcastUpdate = true; }
    } else if (request["command"] == "set_zone_output") {
        response = setZoneOutputPin(request);
        if (response) { m_needsBroadcastUpdate = true; }
    } else if (request["command"] == "set_water_cost") {
        response = setWaterCostPerLiter(request);
        if (response) {
            m_needsBroadcastUpdate = true;
            SendBroadcastUpdate();
        }
    } else if (request["command"] == "set_seasonal_settings") {
        response = setSeasonalSettings(request);
        if (response) {
            m_needsBroadcastUpdate = true;
            SendBroadcastUpdate();
        }
    } else if (request["command"] == "reset_zone_usage") {
        response = resetZoneUsage(request);
        if (response) {
            m_needsBroadcastUpdate = true;
            SendBroadcastUpdate();
        }
    } else if (request["command"] == "save_schedules") {
        response = saveSchedules(request);
        if (response) {
            m_needsBroadcastUpdate = true;
            SendBroadcastUpdate();
        }
    } else if (request["command"] == "update_zones") {
        response = updateZones(request);
        if (response) { m_needsBroadcastUpdate = true; }
    } else {
        LOG_ERROR_PGM(zoneManagerLogger, F("Unknown zone command"));
    }

    JsonDocument responseDoc;
    responseDoc["api_response"] = request["command"];
    responseDoc["status"] = response;
    m_webServer.broadcastMessage(responseDoc);
}

void ZoneManager::zoneStateChangedCallback() {
    m_needsBroadcastUpdate = true;
}

void ZoneManager::buildStateSnapshot(JsonDocument &out) {
    out["api_data"] = "all_zones_update";
    out["water_cost_per_liter"] = m_waterCostPerLiter;
    JsonObject seasonalSettings = out["seasonal_settings"].to<JsonObject>();
    seasonalSettings["enabled"] = m_seasonalSettingsEnabled;
    JsonObject springSettings = seasonalSettings["spring"].to<JsonObject>();
    springSettings["multiplier"] = m_springMultiplier;
    JsonObject summerSettings = seasonalSettings["summer"].to<JsonObject>();
    summerSettings["multiplier"] = m_summerMultiplier;
    JsonObject fallSettings = seasonalSettings["fall"].to<JsonObject>();
    fallSettings["multiplier"] = m_fallMultiplier;
    JsonObject winterSettings = seasonalSettings["winter"].to<JsonObject>();
    winterSettings["multiplier"] = m_winterMultiplier;
    JsonArray zonesArray = out["zones"].to<JsonArray>();

    for (uint8_t i = 0; i < MAX_NUM_ZONES; ++i) {*
        if (m_currentActiveZones[i] == 1) {
            JsonDocument zoneData = m_zones[i].toJson();
            zonesArray.add<JsonObject>(zoneData.as<JsonObject>());
        }
    }
}

void ZoneManager::SendBroadcastUpdate() {
    LOG_DEBUG_PGM(zoneManagerLogger, F("Broadcasting zones update..."));
    JsonDocument broadcastDoc;
    buildStateSnapshot(broadcastDoc);
    m_webServer.broadcastMessage(broadcastDoc);
}

void ZoneManager::update() {
    const unsigned long nowMs = millis();
    bool anyZoneActive = false;

    for (uint8_t i = 0; i < MAX_NUM_ZONES; ++i) {
        if (m_currentActiveZones[i] == 1 && m_zones[i].isActive()) {
            anyZoneActive = true;
            m_zones[i].updateUsage(nowMs, m_waterCostPerLiter);
        }
    }

    if (m_needsBroadcastUpdate || (anyZoneActive && (nowMs - m_lastBroadcastMs >= 1000))) {
        SendBroadcastUpdate();
        m_lastBroadcastMs = nowMs;
        m_needsBroadcastUpdate = false;
    }
}


void ZoneManager::test() {
    LOG_INFO_PGM(zoneManagerLogger, F("Starting ZoneManager test..."));
    m_zones[0].setRunning(true);
}

} // namespace Zone