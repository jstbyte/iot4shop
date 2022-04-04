#ifdef ESPNOW
#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <espnow.h>
#include <ArduinoJson.h>
// My Mac: 48:3F:DA:7E:1E:70

StaticJsonDocument<64> message;
unsigned long timeStamp = 0;
bool power = false;

void stringToMac(String macStr, uint8_t *mac)
{
    // macString Format: "B4:21:8A:F0:3A:AD"

    char *ptr; // start and end pointer for strtol

    for (uint8_t i = 1; i < 6; i++)
    {
        mac[i] = strtol(ptr + 1, &ptr, HEX);
    }
}

void onPktRecv(uint8_t *mac_addr, uint8_t *data, uint8_t len)
{

    StaticJsonDocument<64> jdoc;
    if (deserializeMsgPack(jdoc, data, len))
    {
        return;
    }

    String cmd = jdoc["cmd"].as<String>();
    if (cmd == "POWER_STATE")
    {
        power = true;
        timeStamp = millis();
    }
}

void uart_to_esp_now()
{
    StaticJsonDocument<64> jdoc;
    if (deserializeMsgPack(jdoc, Serial))
    {
        return;
    }

    uint8_t targetMac[6];
    stringToMac(jdoc["mac"].as<String>(), targetMac);

    jdoc.remove("target");
    uint8_t payload[64];
    uint8_t dlen = serializeMsgPack(jdoc, payload);
    esp_now_send(targetMac, payload, dlen);
}

void setup()
{
    pinMode(LED_BUILTIN, OUTPUT);

    Serial.begin(9600);
    WiFi.mode(WIFI_STA);
    WiFi.disconnect();

    if (esp_now_init() != 0)
    {
        ESP.restart();
    }

    esp_now_set_self_role(ESP_NOW_ROLE_COMBO);
    esp_now_register_recv_cb(onPktRecv);

    message["cmd"] = "power";
    message["value"] = false;
}

void loop()
{

    if (Serial.available())
    {
        uart_to_esp_now();
    }

    // Detact Power OFF:
    if ((millis() - timeStamp) > 1000)
    {
        power = 0;
    }

    if (message["value"].as<bool>() != power)
    {
        digitalWrite(LED_BUILTIN, power);
        message["value"] = power;
        serializeMsgPack(message, Serial);
    }
    delay(100);
}

#endif