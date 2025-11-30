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

}; // namespace Log