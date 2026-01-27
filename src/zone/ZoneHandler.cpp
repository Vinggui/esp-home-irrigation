#include <Arduino.h>

#include "Zone/ZoneHandler.hpp"

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

void ZoneHandler::begin(int outputPin, Scheduler::Scheduler* scheduler) {
    m_pinNumber = outputPin;
    m_scheduler = scheduler;
}

void ZoneHandler::cleanData() {
    m_zoneName = "New Zone";
    m_isActive = false;
    m_wateringDuration = 10;

    // Check if there is an active timer and cancel it
    if (m_timerHandler != 0 && m_scheduler) {
        m_scheduler->cancelTimer(m_timerHandler);
    }
}

JsonDocument ZoneHandler::toJson() const {
    JsonDocument doc;
    doc["api_handler"] = "single_zone_update";
    doc["zone_name"] = m_zoneName;
    doc["pin_number"] = m_pinNumber;
    doc["is_active"] = m_isActive;
    doc["watering_duration"] = m_wateringDuration;
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
    m_timerHandler = m_scheduler->setTimer(m_wateringDuration, &zoneTimerThunk, this);
    if (m_timerHandler < 0) {
        LOG_ERROR_PGM(zoneHandlerLogger, F("Failed to set activation timer"));
        return false;
    }
    return activate;
}

} // namespace Zone