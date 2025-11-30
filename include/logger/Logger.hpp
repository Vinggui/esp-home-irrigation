#pragma once

#include <Arduino.h>

#include "contants/globals.hpp"

namespace Log {

void begin(int BAUD_RATE = 115200);
void printPGM(const char* str);

// Macro to initialize the logger
#define LOG_NAME(varName, name) const char varName[] PROGMEM = name;

// make all with macros for easy usage
// levels: 0 - none, 1 - error, 2 - warning, 3 - info, 4 - debug
#if LOG_LEVEL >= 1
    #define LOG_ERROR(logger, ...) do { Serial.print(F("[ERROR]")); Log::printPGM(logger); Serial.printf(__VA_ARGS__); Serial.println(); } while(0)
    #define LOG_ERROR_PGM(logger, ...) do { Serial.print(F("[ERROR]")); Log::printPGM(logger); Serial.print(__VA_ARGS__); Serial.println(); } while(0)
#else
    #define LOG_ERROR(...) do {} while(0)
    #define LOG_ERROR_PGM(...) do {} while(0)
#endif

#if LOG_LEVEL >= 2
    #define LOG_WARNING(logger, ...) do { Serial.print(F("[WARN]")); Log::printPGM(logger); Serial.printf(__VA_ARGS__); Serial.println(); } while(0)
    #define LOG_WARNING_PGM(logger, ...) do { Serial.print(F("[WARN]")); Log::printPGM(logger); Serial.print(__VA_ARGS__); Serial.println(); } while(0)
#else
    #define LOG_WARNING(...) do {} while(0)
    #define LOG_WARNING_PGM(...) do {} while(0)
#endif

#if LOG_LEVEL >= 3
    #define LOG_INFO(logger, ...) do { Serial.print(F("[INFO]")); Log::printPGM(logger); Serial.printf(__VA_ARGS__); Serial.println(); } while(0)
    #define LOG_INFO_PGM(logger, ...) do { Serial.print(F("[INFO]")); Log::printPGM(logger); Serial.print(__VA_ARGS__); Serial.println(); } while(0)
#else
    #define LOG_INFO(...) do {} while(0)
    #define LOG_INFO_PGM(...) do {} while(0)
#endif

#if LOG_LEVEL >= 4
    #define LOG_DEBUG(logger, ...) do { Serial.print(F("[DEBUG]")); Log::printPGM(logger); Serial.printf(__VA_ARGS__); Serial.println(); } while(0)
    #define LOG_DEBUG_PGM(logger, ...) do { Serial.print(F("[DEBUG]")); Log::printPGM(logger); Serial.print(__VA_ARGS__); Serial.println(); } while(0)
#else
    #define LOG_DEBUG(...) do {} while(0)
    #define LOG_DEBUG_PGM(...) do {} while(0)
#endif

}; // namespace Log