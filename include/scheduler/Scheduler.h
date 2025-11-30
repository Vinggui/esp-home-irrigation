#pragma once

#include <NTPClient.h>

#include "logger/Logger.hpp"

namespace Scheduler {

LOG_NAME(schedulerLogger, "Scheduler");

class Scheduler {
public:
    Scheduler();

    int setTimer(int seconds, void (*callback)(int));
    void update();

private:
    void checkTimers();

    // Variables for NTP client
    const char* m_ntpServer = "pool.ntp.org";
    const int m_timeOffsetSeconds = 0;
    const int m_updatePeriod = 300000; // 5min seconds
    NTPClient m_timeClient;
    WiFiUDP m_ntpUDP;

    // Misc variables
    unsigned long m_lastUpdate;
    
    // Timer structure and variables
    static const int MAX_TIMERS = 10;
    struct TimerTask {
        int durationSeconds;
        void (*callback)(int);
        unsigned long endTime;
        bool active;
    };
    TimerTask m_timers[MAX_TIMERS];
};

}; // namespace Zone
