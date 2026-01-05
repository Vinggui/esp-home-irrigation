// WebSocket server handling
#include "server/WebServer.hpp"
#include <LittleFS.h>

namespace Web {

WebServer::WebServer(int port) : m_server(AsyncWebServer(port)), m_ws(AsyncWebSocket("/ws")) {}

void WebServer::begin() {
    // Create AsyncWebServer object on port 80
    initWebSocket();
    
    if (!LittleFS.begin()) {
      LOG_WARNING_PGM(webServerLogger, F("LittleFS mount failed, formatting..."));
      return;
    }
    
    size_t total = LittleFS.totalBytes();
    size_t used  = LittleFS.usedBytes();
    LOG_INFO(webServerLogger, "LittleFS mounted: %u bytes total, %u bytes used", total, used);
    m_server.begin();
}

void WebServer::initWebSocket() {
  auto callback = [this](AsyncWebSocket *server, AsyncWebSocketClient *client,
                         AwsEventType type, void *arg, uint8_t *data, size_t len) {
    this->onEvent(server, client, type, arg, data, len);
  };
  m_ws.onEvent(callback);
  m_server.addHandler(&m_ws);// Serve the index.html file from the root
  m_server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
    request->send(LittleFS, "/index.html", "text/html");
  });
  // Serve other static files
  m_server.serveStatic("/", LittleFS, "/");
}

void WebServer::notifyClients() {
  // m_ws.textAll(String(ledState));
}

void WebServer::handleWebSocketMessage(void *arg, uint8_t *data, size_t len) {
  AwsFrameInfo *info = (AwsFrameInfo*)arg;
    LOG_DEBUG_PGM(webServerLogger, F("MSG received by the WebSocket server"));
  if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
    data[len] = 0;
    
    // Deserialize the JSON document
    DeserializationError error = deserializeJson(m_jsonDoc, data);

    // Test if parsing succeeds.
    if (error) {
      LOG_ERROR_PGM(webServerLogger, F("deserializeJson() failed: "));
      LOG_ERROR_PGM(webServerLogger, error.f_str());
      return;
    }

    // Assert the resquest has a valid command type
    if (!m_jsonDoc["command"].is<const char*>()) {
      LOG_ERROR_PGM(webServerLogger, F("Invalid request: command is not a string"));
      return;
    }
    const char* command = m_jsonDoc["command"];
    uint8_t requestType = getRequestTypeByString(command);
    if (requestType == 255) {
      LOG_ERROR_PGM(webServerLogger, F("Invalid request: unknown command"));
      return;
    }

    for (int i = 0; i < m_callbackCount; ++i) {
      if (requestType == m_expectedRegistredCallbacks[i].type) {
        LOG_INFO(webServerLogger, "Found Callback for command: %s", command);
        m_expectedRegistredCallbacks[i].cb(m_jsonDoc);
        return;
      }
    }
  } else {
    LOG_ERROR_PGM(webServerLogger, F("Invalid WebSocket message"));
  }
}

void WebServer::onEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type,
             void *arg, uint8_t *data, size_t len) {
  switch (type) {
    case WS_EVT_CONNECT:
      LOG_INFO(webServerLogger, "WebSocket client #%u connected from %s\n", client->id(), client->remoteIP().toString().c_str());
      break;
    case WS_EVT_DISCONNECT:
      LOG_INFO(webServerLogger, "WebSocket client #%u disconnected\n", client->id());
      break;
    case WS_EVT_DATA:
      handleWebSocketMessage(arg, data, len);
      break;
    case WS_EVT_PONG:
    case WS_EVT_ERROR:
      break;
  }
}

void WebServer::registerCallback(RequestType type, ApiHandlerFunction cb) {
  m_expectedRegistredCallbacks[m_callbackCount++] = {static_cast<uint8_t>(type), cb};
}

void WebServer::update() {
  // m_ws.cleanupClients();
}

} // namespace Web