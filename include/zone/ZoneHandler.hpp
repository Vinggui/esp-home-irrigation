#pragma once

#include <ArduinoJson.h>

#include "logger/Logger.hpp"
#include "scheduler/Scheduler.hpp"

namespace Zone {

LOG_NAME(zoneHandlerLogger, "ZoneHandler");

class ZoneHandler {
public:
    ZoneHandler();

    void begin(int outputPin, Scheduler::Scheduler* scheduler);
    void cleanData();
    bool setRunning(bool activate);
    void activationTimerCallback(int timerId);
    JsonDocument toJson() const;

private:
    
    std::string m_zoneName;
    int m_pinNumber{-1};
    bool m_isActive{false};
    uint8_t m_wateringDuration{10}; // in seconds
    Scheduler::Scheduler* m_scheduler{nullptr};
    int m_timerHandler{0};
};

}; // namespace Zone