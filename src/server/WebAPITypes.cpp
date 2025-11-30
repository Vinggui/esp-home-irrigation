#include <stdint.h>

#include "server/WebAPITypes.hpp"

namespace Web {

uint8_t getRequestTypeByString(const char* str) {
    if (strcmp(str, "set_zone_config") == 0) {
        return static_cast<uint8_t>(RequestType::SET_ZONE_CONFIG);
    } else if (strcmp(str, "set_zone_state") == 0) {
        return static_cast<uint8_t>(RequestType::SET_ZONE_STATE);
    }
    return 255; // Invalid type
}

}; // namespace Web
