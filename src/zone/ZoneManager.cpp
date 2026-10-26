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

void ZoneManager::begin() {
    if (!m_database.begin()) {
        LOG_ERROR_PGM(zoneManagerLogger, F("Failed to initialize EEPROM database"));
        return;
    }
    loadDatabase();
}

void ZoneManager::loadDatabase() {
    JsonDocument stored;
    if (!m_database.load(stored)) {
        LOG_INFO_PGM(zoneManagerLogger, F("No valid saved configuration found"));
        return;
    }

    m_waterCostPerLiter = stored["water_cost_per_liter"] | m_waterCostPerLiter;
    JsonObjectConst seasonal = stored["seasonal_settings"].as<JsonObjectConst>();
    if (seasonal) {
        m_seasonalSettingsEnabled = seasonal["enabled"] | m_seasonalSettingsEnabled;
        m_springMultiplier = seasonal["spring"]["multiplier"] | m_springMultiplier;
        m_summerMultiplier = seasonal["summer"]["multiplier"] | m_summerMultiplier;
        m_fallMultiplier = seasonal["fall"]["multiplier"] | m_fallMultiplier;
        m_winterMultiplier = seasonal["winter"]["multiplier"] | m_winterMultiplier;
    }

    JsonArrayConst zones = stored["zones"].as<JsonArrayConst>();
    for (JsonObjectConst zone : zones) {
        uint8_t zoneId = zone["zone_id"] | 255;
        if (zoneId >= MAX_NUM_ZONES) {
            continue;
        }
        uint8_t outputPin = zone["pin_number"] | AVAILABLE_OUTPUT_PINS[zoneId];
        bool validOutputPin = false;
        for (uint8_t allowedPin : AVAILABLE_OUTPUT_PINS) {
            if (allowedPin == outputPin) {
                validOutputPin = true;
                break;
            }
        }
        if (!validOutputPin) {
            outputPin = AVAILABLE_OUTPUT_PINS[zoneId];
        }
        m_currentActiveZones[zoneId] = 1;
        m_zones[zoneId].loadFromJson(zone);
        if (!validOutputPin) {
            m_zones[zoneId].setOutputPin(outputPin);
        }
        m_availableOutputPins[zoneId] = outputPin;
    }
    LOG_INFO_PGM(zoneManagerLogger, F("Configuration loaded from EEPROM"));
}

void ZoneManager::saveDatabase() {
    JsonDocument snapshot;
    buildStateSnapshot(snapshot);
    if (!m_database.save(snapshot)) {
        LOG_ERROR_PGM(zoneManagerLogger, F("Failed to save configuration to EEPROM"));
    }
}

bool ZoneManager::registerZone(const JsonDocument &request) {
    // Search for the first available zone slot
    for (uint8_t i = 0; i < MAX_NUM_ZONES; ++i) {
        if (m_currentActiveZones[i] == 0) {
            m_zones[i].cleanData();
            m_zones[i].setOutputPin(AVAILABLE_OUTPUT_PINS[i]);
            m_availableOutputPins[i] = AVAILABLE_OUTPUT_PINS[i];
            m_currentActiveZones[i] = 1; // Mark this zone as active
            LOG_INFO(zoneManagerLogger, "Zone %d registered successfully", i);
            return true;
        }
    }
    LOG_ERROR_PGM(zoneManagerLogger, F("No available zones to register"));
    return false;
}

bool ZoneManager::deleteZone(const JsonDocument &request) {
    if (!request["zone"].is<uint8_t>()) {
        LOG_ERROR_PGM(zoneManagerLogger, F("Invalid delete zone request"));
        return false;
    }

    const uint8_t zoneIndex = request["zone"];
    if (zoneIndex >= MAX_NUM_ZONES || m_currentActiveZones[zoneIndex] == 0) {
        LOG_ERROR(zoneManagerLogger, "Invalid zone number: %d", zoneIndex);
        return false;
    }

    m_zones[zoneIndex].cleanData();
    m_currentActiveZones[zoneIndex] = 0;
    m_availableOutputPins[zoneIndex] = AVAILABLE_OUTPUT_PINS[zoneIndex];
    LOG_INFO(zoneManagerLogger, "Zone %d deleted", zoneIndex);
    return true;
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
    if (!request["zone"].is<uint8_t>() ||
        (!request["gate"].is<uint8_t>() && !request["pin"].is<uint8_t>())) {
        LOG_ERROR_PGM(zoneManagerLogger, F("Invalid set_zone_output request"));
        return false;
    }

    uint8_t zoneIndex = request["zone"];
    uint8_t pinNumber = 0;
    if (request["gate"].is<uint8_t>()) {
        const uint8_t gate = request["gate"];
        if (gate < 1 || gate > MAX_NUM_ZONES) {
            LOG_ERROR(zoneManagerLogger, "Invalid gate number: %d", gate);
            return false;
        }
        pinNumber = AVAILABLE_OUTPUT_PINS[gate - 1];
    } else {
        pinNumber = request["pin"];
    }
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
    if (request["deleted_zones"].is<JsonArrayConst>()) {
        for (JsonVariantConst deletedZone : request["deleted_zones"].as<JsonArrayConst>()) {
            if (!deletedZone.is<uint8_t>()) {
                continue;
            }

            JsonDocument deleteRequest;
            deleteRequest["zone"] = deletedZone.as<uint8_t>();
            if (deleteZone(deleteRequest)) {
                anySuccess = true;
            }
        }
    }

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
    } else if (request["command"] == "delete_zone") {
        response = deleteZone(request);
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

    if (response && request["command"] != "set_zone_state" &&
        request["command"] != "update_zones") {
        saveDatabase();
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
    JsonArray gateOutputs = out["gate_outputs"].to<JsonArray>();
    for (uint8_t i = 0; i < MAX_NUM_ZONES; ++i) {
        JsonObject gateOutput = gateOutputs.add<JsonObject>();
        gateOutput["gate"] = i + 1;
        gateOutput["pin"] = AVAILABLE_OUTPUT_PINS[i];
    }
    JsonArray zonesArray = out["zones"].to<JsonArray>();

    for (uint8_t i = 0; i < MAX_NUM_ZONES; ++i) {
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

    digitalWrite(DEBUG_LED_PIN, anyZoneActive ? HIGH : LOW);

    if (anyZoneActive && (nowMs - m_lastDatabaseSaveMs >= 86400000UL)) {
        saveDatabase();
        m_lastDatabaseSaveMs = nowMs;
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