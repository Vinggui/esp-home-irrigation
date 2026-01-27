#pragma once

#include <functional>

#include <ArduinoJson.h>
#include <cstring>
#include <stdint.h>

namespace Web {

enum class RequestType {
    GET_ALL_CONFIGS,
    SET_ZONE_STATE
};

using ApiHandlerFunction = void (*)(const JsonDocument &request, void* ctx);

}; // namespace Web
