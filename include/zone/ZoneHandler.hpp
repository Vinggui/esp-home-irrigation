#pragma once

#include "logger/Logger.hpp"
#include "scheduler/Scheduler.hpp"

namespace Zone {

LOG_NAME(zoneHandlerLogger, "ZoneHandler");

class ZoneHandler {
public:
    ZoneHandler();

    void begin(int outputPin, Scheduler::Scheduler* scheduler);
    bool setRunning(bool activate);
    void activationTimerCallback(int timerId);

private:
    
    std::string m_zoneName;
    int m_pinNumber{-1};
    uint8_t m_isActive{0};
    uint8_t m_wateringDuration{5}; // in seconds
    Scheduler::Scheduler* m_scheduler{nullptr};
    int m_timerHandler{0};
};

}; // namespace Zone