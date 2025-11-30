#include <Arduino.h>

#include "Zone/ZoneHandler.hpp"

#define OUTPUT_PIN 2

namespace Zone {

ZoneHandler::ZoneHandler() {
    // Constructor implementation
}

bool ZoneHandler::setRunning(bool activate) {
    m_isActive = activate? HIGH : LOW;
    
    digitalWrite(OUTPUT_PIN, m_isActive);
    return activate;
}

} // namespace Zone