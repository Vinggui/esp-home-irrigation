#include "localDB/LocalDB.hpp"

#include <EEPROM.h>

namespace LocalDB {

namespace {
constexpr size_t MAGIC_OFFSET = 0;
constexpr size_t VERSION_OFFSET = 4;
constexpr size_t LENGTH_OFFSET = 6;
constexpr size_t CHECKSUM_OFFSET = 8;
}

bool Database::begin() {
    return EEPROM.begin(EEPROM_SIZE);
}

uint32_t Database::checksum(const uint8_t* data, size_t length) const {
    uint32_t result = 0xFFFFFFFF;
    for (size_t index = 0; index < length; ++index) {
        result ^= data[index];
        for (uint8_t bit = 0; bit < 8; ++bit) {
            result = (result >> 1) ^ (0xEDB88320 & -(result & 1));
        }
    }
    return ~result;
}

bool Database::load(JsonDocument& document) {
    uint32_t magic = 0;
    uint16_t version = 0;
    uint16_t length = 0;
    uint32_t storedChecksum = 0;

    EEPROM.get(MAGIC_OFFSET, magic);
    EEPROM.get(VERSION_OFFSET, version);
    EEPROM.get(LENGTH_OFFSET, length);
    EEPROM.get(CHECKSUM_OFFSET, storedChecksum);

    if (magic != MAGIC || version != VERSION || length == 0 ||
        length > EEPROM_SIZE - HEADER_SIZE) {
        return false;
    }

    String payload;
    payload.reserve(length + 1);
    for (uint16_t index = 0; index < length; ++index) {
        payload += static_cast<char>(EEPROM.read(HEADER_SIZE + index));
    }

    if (checksum(reinterpret_cast<const uint8_t*>(payload.c_str()), length) != storedChecksum) {
        return false;
    }

    DeserializationError error = deserializeJson(document, payload);
    return !error;
}

bool Database::save(const JsonDocument& document) {
    String payload;
    serializeJson(document, payload);
    if (payload.isEmpty() || payload.length() > EEPROM_SIZE - HEADER_SIZE) {
        return false;
    }

    const uint16_t length = static_cast<uint16_t>(payload.length());
    const uint32_t payloadChecksum = checksum(
        reinterpret_cast<const uint8_t*>(payload.c_str()), length);

    EEPROM.put(MAGIC_OFFSET, MAGIC);
    EEPROM.put(VERSION_OFFSET, VERSION);
    EEPROM.put(LENGTH_OFFSET, length);
    EEPROM.put(CHECKSUM_OFFSET, payloadChecksum);
    for (uint16_t index = 0; index < length; ++index) {
        EEPROM.write(HEADER_SIZE + index, payload[index]);
    }

    return EEPROM.commit();
}

} // namespace LocalDB