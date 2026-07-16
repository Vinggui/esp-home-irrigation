#include <Arduino.h>

#include "api/WebAPITypes.hpp"
#include "zone/ZoneHandler.hpp"

namespace Zone {
    
namespace {
    // thunk to dispatch back to object instance
    void zoneTimerThunk(int timerId, void* ctx) {
        auto *self = static_cast<Zone::ZoneHandler*>(ctx);
        if (self) self->activationTimerCallback(timerId);
    }
}

ZoneHandler::ZoneHandler() {
}

void ZoneHandler::begin(int id, int outputPin, Scheduler::Scheduler* scheduler) {
    m_zoneId = id;
    m_pinNumber = outputPin;
    m_scheduler = scheduler;
    pinMode(m_pinNumber, OUTPUT);
    digitalWrite(m_pinNumber, LOW);
}

void ZoneHandler::cleanData() {
    m_zoneName = "New Zone";
    m_isActive = false;
    m_manualWateringDuration = 10;
    m_totalVolumeLiters = 0.0;
    m_totalCost = 0.0;
    m_averageDaily = 0.0;
    m_lastUsageSampleMs = 0;

    // Ensure the output is turned off and cancel any active timer
    digitalWrite(m_pinNumber, LOW);
    if (m_timerHandler >= 0 && m_scheduler) {
        m_scheduler->cancelTimer(m_timerHandler);
    }
    m_timerHandler = -1;
    
    for (int i = 0; i < MAX_NUM_SCHEDULES_PER_ZONE; ++i) {
        m_schedules[i].id = -1;
        m_schedules[i].enabled = false;
        m_schedules[i].startTime = 0;
        m_schedules[i].duration = 0;
        m_schedules[i].daysOfWeekBitmask = 0;
    }
}

JsonDocument ZoneHandler::toJson() const {
    JsonDocument doc;
    doc["zone_id"] = m_zoneId;
    doc["zone_name"] = m_zoneName;
    doc["pin_number"] = m_pinNumber;
    doc["is_active"] = m_isActive;
    doc["flow_rate"] = m_flowRate;
    doc["manual_timer"] = m_manualWateringDuration;
    
    if (m_isActive && m_timerHandler >= 0) {
        doc["active_until"] = m_scheduler ? m_scheduler->getRemainingTime(m_timerHandler) : 0;
    } else {
        doc["active_until"] = 0;
    }

    JsonObject statsObject = doc["stats"].to<JsonObject>();
    statsObject["totalVolume"] = m_totalVolumeLiters;
    statsObject["totalCost"] = m_totalCost;
    statsObject["averageDaily"] = m_averageDaily;

    JsonArray schedulesArray = doc["schedules"].to<JsonArray>();
    // Add schedule data if needed
    for (int i = 0; i < MAX_NUM_SCHEDULES_PER_ZONE; ++i) {
        if (m_schedules[i].id == -1) { continue; } // Skip unused slots
        JsonDocument scheduleObj;
        scheduleObj["id"] = m_schedules[i].id;
        scheduleObj["enabled"] = m_schedules[i].enabled;
        scheduleObj["start_time"] = m_schedules[i].startTime;
        scheduleObj["duration"] = m_schedules[i].duration;

        JsonArray daysOfWeekArray = scheduleObj["days_of_week"].to<JsonArray>();
        for (int day = 0; day < 7; ++day) {
            if (m_schedules[i].daysOfWeekBitmask & (1 << day)) {
                daysOfWeekArray.add(Api::DAYS_OF_WEEK[day]);
            }
        }
        schedulesArray.add<JsonObject>(scheduleObj.as<JsonObject>());
    }

    return doc;
}

void ZoneHandler::setManualWateringDuration(uint8_t minutes) {
    m_manualWateringDuration = minutes;
}

void ZoneHandler::setName(const char* name) {
    if (name) {
        m_zoneName = name;
    }
}

void ZoneHandler::setFlowRate(double flowRate) {
    if (flowRate > 0.0) {
        m_flowRate = flowRate;
    }
}

void ZoneHandler::setOutputPin(int pinNumber) {
    if (pinNumber < 0) {
        return;
    }

    if (m_pinNumber >= 0) {
        digitalWrite(m_pinNumber, LOW);
    }

    m_pinNumber = pinNumber;
    pinMode(m_pinNumber, OUTPUT);
    digitalWrite(m_pinNumber, m_isActive ? HIGH : LOW);
}

void ZoneHandler::setSchedules(const JsonArrayConst &schedules) {
    for (int i = 0; i < MAX_NUM_SCHEDULES_PER_ZONE; ++i) {
        m_schedules[i].id = -1;
        m_schedules[i].enabled = false;
        m_schedules[i].startTime = 0;
        m_schedules[i].duration = 0;
        m_schedules[i].daysOfWeekBitmask = 0;
    }

    int index = 0;
    for (JsonVariantConst scheduleVar : schedules) {
        if (index >= MAX_NUM_SCHEDULES_PER_ZONE) {
            break;
        }

        ScheduleEntry &entry = m_schedules[index];
        entry.id = index;
        entry.enabled = scheduleVar["enabled"].as<bool>();

        if (scheduleVar["startTime"].is<const char*>()) {
            const char* value = scheduleVar["startTime"].as<const char*>();
            int hours = 0;
            int minutes = 0;
            if (sscanf(value, "%d:%d", &hours, &minutes) == 2) {
                entry.startTime = hours * 3600 + minutes * 60;
            }
        } else if (scheduleVar["start_time"].is<const char*>()) {
            const char* value = scheduleVar["start_time"].as<const char*>();
            int hours = 0;
            int minutes = 0;
            if (sscanf(value, "%d:%d", &hours, &minutes) == 2) {
                entry.startTime = hours * 3600 + minutes * 60;
            }
        } else if (scheduleVar["start_time"].is<int>()) {
            entry.startTime = scheduleVar["start_time"].as<int>();
        } else if (scheduleVar["startTime"].is<int>()) {
            entry.startTime = scheduleVar["startTime"].as<int>();
        }

        if (scheduleVar["duration"].is<int>()) {
            entry.duration = scheduleVar["duration"].as<int>();
        }

        entry.daysOfWeekBitmask = 0;
        if (scheduleVar["days"].is<JsonArrayConst>()) {
            JsonArrayConst daysArray = scheduleVar["days"].as<JsonArrayConst>();
            for (JsonVariantConst dayVar : daysArray) {
                const char* day = dayVar.as<const char*>();
                for (int dayIndex = 0; dayIndex < 7; ++dayIndex) {
                    if (strcmp(day, Api::DAYS_OF_WEEK[dayIndex]) == 0) {
                        entry.daysOfWeekBitmask |= (1 << dayIndex);
                        break;
                    }
                }
            }
        } else if (scheduleVar["days_of_week"].is<JsonArrayConst>()) {
            JsonArrayConst daysArray = scheduleVar["days_of_week"].as<JsonArrayConst>();
            for (JsonVariantConst dayVar : daysArray) {
                const char* day = dayVar.as<const char*>();
                for (int dayIndex = 0; dayIndex < 7; ++dayIndex) {
                    if (strcmp(day, Api::DAYS_OF_WEEK[dayIndex]) == 0) {
                        entry.daysOfWeekBitmask |= (1 << dayIndex);
                        break;
                    }
                }
            }
        }

        ++index;
    }
}

void ZoneHandler::updateUsage(unsigned long nowMs, double waterCostPerLiter) {
    if (!m_isActive) {
        return;
    }

    if (m_lastUsageSampleMs == 0) {
        m_lastUsageSampleMs = nowMs;
        return;
    }

    const unsigned long elapsedMs = nowMs - m_lastUsageSampleMs;
    if (elapsedMs <= 0) {
        return;
    }

    const double elapsedMinutes = elapsedMs / 60000.0;
    const double addedVolume = m_flowRate * elapsedMinutes;
    const double addedCost = addedVolume * waterCostPerLiter;

    m_totalVolumeLiters += addedVolume;
    m_totalCost += addedCost;
    m_averageDaily = m_totalVolumeLiters;
    m_lastUsageSampleMs = nowMs;
}

void ZoneHandler::resetUsage() {
    m_totalVolumeLiters = 0.0;
    m_totalCost = 0.0;
    m_averageDaily = 0.0;
    m_lastUsageSampleMs = 0;
}

uint8_t ZoneHandler::getManualWateringDuration() const {
    return m_manualWateringDuration;
}

bool ZoneHandler::isActive() const {
    return m_isActive;
}

void ZoneHandler::setStateChangedCallback(void (*callback)(void* ctx), void* ctx) {
    m_stateChangedCallback = callback;
    m_stateChangedCallbackCtx = ctx;
}

void ZoneHandler::activationTimerCallback(int timerId) {
    if (timerId != m_timerHandler) {
        LOG_ERROR_PGM(zoneHandlerLogger, F("Mismatched timer ID in callback"));
        return;
    }
    LOG_INFO(zoneHandlerLogger, "Activation timer %d callback triggered", timerId);
    updateUsage(millis(), 0.0);
    m_isActive = false;
    digitalWrite(m_pinNumber, LOW);
    m_timerHandler = -1;
    m_lastUsageSampleMs = 0;
    if (m_stateChangedCallback) {
        m_stateChangedCallback(m_stateChangedCallbackCtx);
    }
}

bool ZoneHandler::setRunning(bool activate) {
    if (!m_scheduler) {
        LOG_ERROR_PGM(zoneHandlerLogger, F("Scheduler unavailable"));
        return false;
    }

    if (!activate) {
        updateUsage(millis(), 0.0);
        m_isActive = false;
        digitalWrite(m_pinNumber, LOW);
        if (m_timerHandler >= 0) {
            m_scheduler->cancelTimer(m_timerHandler);
            m_timerHandler = -1;
        }
        m_lastUsageSampleMs = 0;
        if (m_stateChangedCallback) {
            m_stateChangedCallback(m_stateChangedCallbackCtx);
        }
        return true;
    }

    if (m_timerHandler >= 0) {
        m_scheduler->cancelTimer(m_timerHandler);
        m_timerHandler = -1;
    }

    m_isActive = true;
    m_lastUsageSampleMs = millis();
    digitalWrite(m_pinNumber, HIGH);
    int newTimer = m_scheduler->setTimer(m_manualWateringDuration * 60, &zoneTimerThunk, this);
    if (newTimer < 0) {
        LOG_ERROR_PGM(zoneHandlerLogger, F("Failed to set activation timer"));
        digitalWrite(m_pinNumber, LOW);
        m_isActive = false;
        return false;
    }
    m_timerHandler = newTimer;
    return true;
}

} // namespace Zone