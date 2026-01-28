#include <Arduino.h>

#include "zone/ZoneHandler.hpp"
#include "api/WebAPITypes.hpp"

#define OUTPUT_PIN 2

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
}

void ZoneHandler::cleanData() {
    m_zoneName = "New Zone";
    m_isActive = false;
    m_manualWateringDuration = 10;

    // Check if there is an active timer and cancel it
    if (m_timerHandler != 0 && m_scheduler) {
        m_scheduler->cancelTimer(m_timerHandler);
    }
    
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
    
    if (m_isActive) {
        doc["active_until"] = m_scheduler->getRemainingTime(m_timerHandler);
    } else {
        doc["active_until"] = 0;
    }

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

void ZoneHandler::activationTimerCallback(int timerId) {
    if (timerId != m_timerHandler) {
        LOG_ERROR_PGM(zoneHandlerLogger, F("Mismatched timer ID in callback"));
        return;
    }
    LOG_INFO(zoneHandlerLogger, "Activation timer %d callback triggered", timerId);
    m_isActive = LOW;
    digitalWrite(OUTPUT_PIN, m_isActive);
}

bool ZoneHandler::setRunning(bool activate) {
    m_isActive = activate? HIGH : LOW;
    
    digitalWrite(OUTPUT_PIN, m_isActive);
    m_timerHandler = m_scheduler->setTimer(m_manualWateringDuration, &zoneTimerThunk, this);
    if (m_timerHandler < 0) {
        LOG_ERROR_PGM(zoneHandlerLogger, F("Failed to set activation timer"));
        return false;
    }
    return activate;
}

} // namespace Zone