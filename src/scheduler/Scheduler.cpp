#include <Arduino.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#include "scheduler/Scheduler.hpp"

namespace Scheduler {


Scheduler::Scheduler() :
    m_ntpUDP(WiFiUDP()),
    m_timeClient(NTPClient(m_ntpUDP, m_ntpServer, m_timeOffsetSeconds, m_updatePeriod))
    {}

String Scheduler::retrieveExternalIP(WiFiClient& wifiClient) {
    HTTPClient http;
    const char * getIpURL = "http://api.ipify.org";
    // Note: Most free APIs have usage limits, check their terms.
    http.begin(wifiClient, getIpURL); 
    int httpCode = http.GET();
    
    if (httpCode <= 0) {
        LOG_ERROR(schedulerLogger, "Failed to retrieve external IP, HTTP code: %d", httpCode);
    }
    
    String payload = http.getString();
    http.end();
    return payload;
}

String Scheduler::retrieveTimezoneOffset(WiFiClient& wifiClient, String ipAddress) {
    HTTPClient http;
    String getIpURL = "http://ip-api.com/json/" + ipAddress + "?fields=status,message,timezone,offset";
    // Note: Most free APIs have usage limits, check their terms.
    http.begin(wifiClient, getIpURL); 
    int httpCode = http.GET();
    
    if (httpCode <= 0) {
        LOG_ERROR(schedulerLogger, "Failed to retrieve geo location for IP:%s, HTTP code: %d", ipAddress.c_str(), httpCode);
    }
    
    String payload = http.getString();
    LOG_DEBUG(schedulerLogger, "Geo location response: %s", payload.c_str());
    http.end();
    
    JsonDocument doc;
    // Deserialize the JSON document
    DeserializationError error = deserializeJson(doc, payload);
    
    // Test if parsing succeeds.
    if (error) {
        LOG_ERROR_PGM(schedulerLogger, F("deserializeJson() retrieving timezone: "));
        LOG_ERROR_PGM(schedulerLogger, error.f_str());
        return "";
    }

    if (String(doc["status"]) != "success") {
        LOG_ERROR(schedulerLogger, "Geo location API error: %s", String(doc["message"]).c_str());
        return "";
    }
    
    LOG_INFO(schedulerLogger, "Timezone retrieved as: %s", doc["timezone"].as<const char*>());
    return doc["offset"]; // Extract the time zone string
}

void Scheduler::setCurrentLocalTimeByIP(WiFiClient& wifiClient) {
    String ipAddress = retrieveExternalIP(wifiClient);
    if (ipAddress.length() == 0) {
        LOG_ERROR_PGM(schedulerLogger, F("Could not retrieve external IP address"));
        return;
    }

    // Make request to a geolocation API (e.g., ip-api.com)
    String timezoneOffset = retrieveTimezoneOffset(wifiClient, ipAddress);

    if (timezoneOffset.length() > 0) {
        m_timeClient.setTimeOffset(timezoneOffset.toInt());
        LOG_INFO(schedulerLogger, "Timezone offset set to: %s", timezoneOffset.c_str());
    } else {
        // Fallback to a default
        m_timeClient.setTimeOffset(-8 * 3600); // UTC-8 as default
        LOG_INFO_PGM(schedulerLogger, F("Could not find timezone in response. Using UTC-8 as default."));
    }
}


int Scheduler::setTimer(int seconds, TimerCallback callback, void* callerCtx) {
    // Set a timer for the specified duration
    for (int i = 0; i < MAX_TIMERS; ++i) {
        if (!m_timers[i].active) {
            m_timers[i].durationSeconds = seconds;
            m_timers[i].ctx = callerCtx;
            m_timers[i].callback = callback;
            m_timers[i].endTime = millis() + seconds * 1000;
            m_timers[i].active = true;
            LOG_INFO(schedulerLogger, "Timer set for %d seconds", seconds);
            return i; // Return timer ID
        }
    }
    LOG_ERROR(schedulerLogger, "No available timer slots");
    return -1; // No available timer slots
}

bool Scheduler::cancelTimer(int timerId) {
    if (timerId < 0 || timerId >= MAX_TIMERS) return false;
    if (!m_timers[timerId].active) return false;
    m_timers[timerId].active = false;
    m_timers[timerId].callback = nullptr;
    return true;
}

void Scheduler::checkTimers() {
    unsigned long currentTime = millis();
    for (int i = 0; i < MAX_TIMERS; ++i) {
        // LOG_INFO(schedulerLogger, "Timer %d check", i);
        if (m_timers[i].active && currentTime >= m_timers[i].endTime) {
            m_timers[i].active = false; // Deactivate timer
            if (m_timers[i].callback) m_timers[i].callback(i, m_timers[i].ctx); // Call the callback
        }
    }
}

void Scheduler::begin(WiFiClient& wifiClient) {
    // Initialize NTP client
    m_timeClient.begin();
    m_lastUpdate = millis();
    setCurrentLocalTimeByIP(wifiClient);
}

void Scheduler::update() {
    // Update NTP client every second
    if (millis() - m_lastUpdate >= 1000) {
        m_lastUpdate = millis();
        m_timeClient.update();
        
        // print formatted time
        LOG_INFO(schedulerLogger, "Current time: %s", m_timeClient.getFormattedTime().c_str());
        // Check timers
        checkTimers();
    }
}

} // namespace Scheduler