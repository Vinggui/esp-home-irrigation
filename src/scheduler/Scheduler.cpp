#include <Arduino.h>

#include "scheduler/Scheduler.hpp"

namespace Scheduler {


Scheduler::Scheduler() :
    m_ntpUDP(WiFiUDP()),
    m_timeClient(NTPClient(m_ntpUDP, m_ntpServer, m_timeOffsetSeconds, m_updatePeriod)) {
    // Initialize NTP client
    m_timeClient.begin();
    m_lastUpdate = millis();
}

int Scheduler::setTimer(int seconds, void (*callback)(int)) {
    // Set a timer for the specified duration
    LOG_INFO_PGM(schedulerLogger, F("Timer set for %d seconds"), seconds);
    for (int i = 0; i < MAX_TIMERS; ++i) {
        if (!m_timers[i].active) {
            m_timers[i].durationSeconds = seconds;
            m_timers[i].callback = callback;
            m_timers[i].endTime = m_timeClient.getEpochTime() + seconds;
            m_timers[i].active = true;
            return i; // Return timer ID
        }
    }    
}

void Scheduler::checkTimers() {
    unsigned long currentTime = m_timeClient.getEpochTime();
    for (int i = 0; i < MAX_TIMERS; ++i) {
        if (m_timers[i].active && currentTime >= m_timers[i].endTime) {
            LOG_INFO_PGM(schedulerLogger, F("Timer %d expired"), i);
            m_timers[i].callback(i); // Call the callback
            m_timers[i].active = false; // Deactivate timer
        }
    }
}

void Scheduler::update() {
    // Update NTP client ever second
    if (millis() - m_lastUpdate >= 1000) {
        m_lastUpdate = millis();
        m_timeClient.update();
        
        // Check timers
        checkTimers();
    }
}

} // namespace Scheduler