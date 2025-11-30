#include <functional>

#include <Arduino.h>
#include <WiFi.h>

#include "logger/Logger.hpp"
#include "server/WebServer.hpp"
#include "zone/ZoneManager.hpp"
#include "scheduler/Scheduler.hpp"

#define LED 2
#define MAX_ZONES 4

// Replace with your network credentials (or load from .env)
const char* ssid = "";
const char* password = "";

Web::WebServer webServer(80);
Zone::ZoneManager zoneManager;

LOG_NAME(mainLogger, "main");

void setup() {
    Log::begin(115200);

    // put your setup code here, to run once:
    pinMode(LED, OUTPUT);

    // Connect to Wi-Fi
    WiFi.begin(ssid, password);
    int counter = 0;
    while (WiFi.status() != WL_CONNECTED) {
      digitalWrite(LED, HIGH);
      delay(100);
      digitalWrite(LED, LOW);
      delay(100);
      if (counter++ % 5 == 0) {
        LOG_INFO_PGM(mainLogger, F("Connecting to WiFi.."));
      }
    }
    digitalWrite(LED, HIGH);

    // Print ESP Local IP Address
    LOG_INFO_PGM(mainLogger, WiFi.localIP());

    // Start the web server
    webServer.begin();
    webServer.registerCallback(Web::RequestType::SET_ZONE_STATE, 
                              std::bind(&Zone::ZoneManager::setZoneStateApiCb, &zoneManager, std::placeholders::_1));
    

    // TEMPORARY: Registering Zone
    JsonDocument request;
    zoneManager.registerZoneApiCb(request);

    digitalWrite(LED, LOW);
}

void loop() {
  webServer.update();
}