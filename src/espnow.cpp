#ifdef ESPNOW
#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <espnow.h>
#include <ArduinoJson.h>
// My Mac: 48:3F:DA:7E:1E:70

StaticJsonDocument<64> message;
unsigned long timeStamp = 0;
bool power = false;

void onPktRecv(uint8_t *mac_addr, uint8_t *data, uint8_t len)
{
    power = true;
    timeStamp = millis();
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

    esp_now_set_self_role(ESP_NOW_ROLE_SLAVE);
    esp_now_register_recv_cb(onPktRecv);

    message["cmd"] = "power";
    message["value"] = false;
}

void loop()
{
    // Detact Power OFF:
    if ((millis() - timeStamp) > 2000)
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