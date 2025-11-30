#pragma once

#include <Arduino.h>

// levels: 0 - none, 1 - error, 2 - warning, 3 - info, 4 - debug
#define LOG_LEVEL 3

constexpr uint8_t MAX_NUM_ZONES = 4;
constexpr uint8_t AVAILABLE_OUTPUT_PINS[MAX_NUM_ZONES] = {2, 17, 18, 19};

