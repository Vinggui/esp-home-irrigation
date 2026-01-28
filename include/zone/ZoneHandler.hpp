#pragma once

#include <ArduinoJson.h>

#include "logger/Logger.hpp"
#include "scheduler/Scheduler.hpp"

namespace Zone {

LOG_NAME(zoneHandlerLogger, "ZoneHandler");

class ZoneHandler {
public:
    ZoneHandler();

    void begin(int id, int outputPin, Scheduler::Scheduler* scheduler);
    void cleanData();
    bool setRunning(bool activate);
    void activationTimerCallback(int timerId);
    JsonDocument toJson() const;

private:
    struct ScheduleEntry {
        int id{-1};
        bool enabled{false};
        int startTime{0}; // In seconds from midnight
        int duration{0}; // In seconds
        uint8_t daysOfWeekBitmask{0}; // bit 0 = Sunday, bit 1 = Monday, ..., bit 6 = Saturday
    };

    std::string m_zoneName;
    double m_flowRate{10.0}; // in liters per minute

    int m_zoneId{-1};
    int m_pinNumber{-1};
    bool m_isActive{false};
    uint8_t m_manualWateringDuration{10}; // in seconds
    Scheduler::Scheduler* m_scheduler{nullptr};
    int m_timerHandler{0};
    ScheduleEntry m_schedules[MAX_NUM_SCHEDULES_PER_ZONE]; // Support up to 5 schedules per zone
};

}; // namespace Zone