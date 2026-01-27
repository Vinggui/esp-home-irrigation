#pragma once

#include <NTPClient.h>
#include <WiFi.h>
#include <WiFiUDP.h>

#include "logger/Logger.hpp"

namespace Scheduler {

LOG_NAME(schedulerLogger, "Scheduler");

class Scheduler {
public:
    using TimerCallback = void (*)(int timerId, void* ctx);

    Scheduler();
    void begin(WiFiClient& wifiClient);
    void update();

    void setCurrentLocalTimeByIP(WiFiClient& wifiClient);
    int setTimer(int seconds, TimerCallback callback, void* callerCtx);
    bool cancelTimer(int timerId);

private:
    void checkTimers();
    String retrieveExternalIP(WiFiClient& wifiClient);
    String retrieveTimezoneOffset(WiFiClient& wifiClient, String ipAddress);

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
        int durationSeconds{0};
        void* ctx{nullptr};
        TimerCallback callback{nullptr};
        unsigned long endTime{0};
        bool active{false};
    };
    TimerTask m_timers[MAX_TIMERS];
};

}; // namespace Scheduler
