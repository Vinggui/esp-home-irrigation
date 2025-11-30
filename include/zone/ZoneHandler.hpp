#pragma once

#include "logger/Logger.hpp"

namespace Zone {

LOG_NAME(zoneHandlerLogger, "ZoneHandler");

class ZoneHandler {
public:
    ZoneHandler();

    bool setRunning(bool activate);

private:
    std::string m_zoneName;
    uint8_t m_isActive{0};
    uint8_t m_wateringDuration{0}; // in seconds

};

}; // namespace Zone