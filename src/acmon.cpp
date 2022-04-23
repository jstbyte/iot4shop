#ifdef ACMON
#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <espnow.h>
#include <ArduinoJson.h>

uint8_t broadcastAddress[] = {0x48, 0x3F, 0xDA, 0x7E, 0x1E, 0x70};
uint8_t payload[32];
uint8_t payload_size;

void setup()
{
    WiFi.mode(WIFI_STA);
    WiFi.disconnect();

    esp_now_init();

    esp_now_set_self_role(ESP_NOW_ROLE_SLAVE);
    esp_now_add_peer(broadcastAddress, ESP_NOW_ROLE_COMBO, 1, NULL, 0);

    StaticJsonDocument<32> jdoc;
    jdoc["cmd"] = "POWER_STATE";

    payload_size = serializeMsgPack(jdoc, payload);
}

void loop()
{
    esp_now_send(broadcastAddress, payload, payload_size);
    delay(100);
}

#endif