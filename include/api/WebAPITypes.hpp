#pragma once

#include <functional>

#include <ArduinoJson.h>
#include <cstring>
#include <stdint.h>

namespace Api {

enum class RequestType {
    GET_ALL_CONFIGS,
    SET_ZONE_STATE
};

const char* const DAYS_OF_WEEK[] = {"sun", "mon", "tue", "wed", "thu", "fri", "sat"};

using ApiHandlerFunction = void (*)(const JsonDocument &request, void* ctx);

}; // namespace Api
