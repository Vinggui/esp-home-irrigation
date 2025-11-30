#pragma once

#include <functional>

#include <ArduinoJson.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>

#include "WebAPITypes.hpp"
#include "logger/Logger.hpp"

namespace Web {

#define MAX_NUM_CALLBACKS 5
LOG_NAME(webServerLogger, "WebServer");

class WebServer {
public:
    WebServer(int port = 80);
    void begin();
    void handleClient();
    void registerCallback(RequestType type, ApiHandlerFunction cb);
    void update();

private:
    void handleWebSocketMessage(void *arg, uint8_t *data, size_t len);

    void onEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type,
                 void *arg, uint8_t *data, size_t len);

    void initWebSocket();

    void notifyClients();

    AsyncWebServer m_server;
    AsyncWebSocket m_ws;
    JsonDocument m_jsonDoc;

    // For simplicity, we use a simple array with a fixed size for all expected callbacks.
    int m_callbackCount{0};
    ApiCallbackEntry m_expectedRegistredCallbacks[MAX_NUM_CALLBACKS];
};

}; // namespace Web