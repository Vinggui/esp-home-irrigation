#include "logger/Logger.hpp"

namespace Log {

void begin(int BAUD_RATE) {
#if LOG_LEVEL > 0
    Serial.begin(BAUD_RATE);
    Serial.println("Logger initialized.");
#endif
};

void printPGM(const char* str) {
#if LOG_LEVEL > 0
    Serial.write("[");
    for (int i = 0; i < strlen_P(str); i++) {
        Serial.write(pgm_read_byte_near(str + i));
    }
    Serial.write("] ");
#endif
};

void printCurrentTime() {
#if LOG_LEVEL > 0
    unsigned long ms = millis();
    unsigned long seconds = ms / 1000;
    unsigned long minutes = seconds / 60;
    unsigned long hours = minutes / 60;
    seconds = seconds % 60;
    minutes = minutes % 60;
    Serial.printf("[%02lu:%02lu:%02lu]", hours, minutes, seconds);
#endif
};

}; // namespace Log