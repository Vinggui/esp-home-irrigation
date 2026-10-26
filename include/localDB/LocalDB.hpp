#pragma once

#include <ArduinoJson.h>

namespace LocalDB {

class Database {
public:
    bool begin();
    bool load(JsonDocument& document);
    bool save(const JsonDocument& document);

private:
    static constexpr uint32_t MAGIC = 0x49525247;
    static constexpr uint16_t VERSION = 1;
    static constexpr size_t EEPROM_SIZE = 4096;
    static constexpr size_t HEADER_SIZE = 12;

    uint32_t checksum(const uint8_t* data, size_t length) const;
};

} // namespace LocalDB