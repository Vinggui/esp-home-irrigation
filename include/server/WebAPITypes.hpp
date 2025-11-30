#pragma once

#include <functional>

#include <ArduinoJson.h>
#include <cstring>
#include <stdint.h>

namespace Web {

enum class RequestType {
    SET_ZONE_CONFIG,
    SET_ZONE_STATE,
};

uint8_t getRequestTypeByString(const char* str);

typedef std::function<void(const JsonDocument &request)> ApiHandlerFunction;

struct ApiCallbackEntry {
    uint8_t type;
    ApiHandlerFunction cb;
};

}; // namespace Web
