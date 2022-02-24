#ifdef ACMON
#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <espnow.h>
// Target: 48:3F:DA:7E:1E:70
uint8_t broadcastAddress[] = {0x48, 0x3F, 0xDA, 0x7E, 0x1E, 0x70};

// void OnDataSent(uint8_t *mac_addr, uint8_t sendStatus)
// {
//     Serial.print("Last Packet Send Status: ");
//     if (sendStatus == 0)
//     {
//         Serial.println("Sent");
//     }
//     else
//     {
//         Serial.println("Failed");
//     }
// }

void setup()
{
    WiFi.mode(WIFI_STA);
    WiFi.disconnect();
    // Serial.begin(9600);

    esp_now_init();

    esp_now_set_self_role(ESP_NOW_ROLE_SLAVE);
    esp_now_add_peer(broadcastAddress, ESP_NOW_ROLE_SLAVE, 1, NULL, 0);
    // esp_now_register_send_cb(OnDataSent);
    // Serial.println("OK!");
}

uint8_t state = 1;

void loop()
{
    esp_now_send(broadcastAddress, &state, sizeof(state));
    delay(200);
}

#endif