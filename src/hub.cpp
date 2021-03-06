#ifdef HUB
#include <Arduino.h>

/* Fixed SPIFFS Errors */
#include <FS.h>
#define SPIFFS LittleFS
#include <LittleFS.h>

#ifdef ESP32
#include <WiFi.h>
#include <AsyncTCP.h>
#elif defined(ESP8266)
#include <ESP8266WiFi.h>
#include <ESPAsyncTCP.h>
#endif
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <IRrecv.h>
#include <IRutils.h>
#include <AsyncElegantOTA.h>

#define IR_POWER 0x1FE48B7
#define IR_EQ 0x1FE20DF
#define IR_MODE 0x1FE58A7
#define IR_1 0x1FE50AF
#define IR_2 0x1FED827
#define IR_3 0x1FEF807
#define IR_4 0x1FE30CF

enum power_saver_mode_t
{
  POWER_SAVER_OFF,
  POWER_SAVER_ON,
  POWER_SAVER_TURBO
};

/* Global Refs */
const char *ssid_sta = "";
const char *password = "";

AsyncWebServer server(80);
IRrecv irrecv(4);

/* Global States */
bool power = false;
unsigned long long power_changed_time = 0;
uint8 power_saver[] = {POWER_SAVER_OFF, POWER_SAVER_OFF, POWER_SAVER_OFF, POWER_SAVER_OFF};
decode_results ir_result;

unsigned long long last_on_time[] = {0, 0, 0, 0};
unsigned long long total_on_time[] = {0, 0, 0, 0};

uint8_t pinMapToIndex(uint8_t pin)
{
  switch (pin)
  {
  case 14:
    return 0;
  case 12:
    return 1;
  case 13:
    return 2;
  case 5:
    return 3;
  default:
    return 0;
  }
}

uint8_t pinFromIndex(uint8_t index)
{
  switch (index)
  {
  case 0:
    return 14;
  case 1:
    return 12;
  case 2:
    return 13;
  case 3:
    return 5;
  default:
    return 2;
  }
}

void digitalWriteWithTime(uint8_t pin, bool state)
{
  digitalWrite(pin, state);

  uint8_t pinIndex = pinMapToIndex(pin);

  if (!state) // INVERT_FOR_RELAY;
  {
    last_on_time[pinIndex] = millis();
  }
  else
  {
    total_on_time[pinIndex] = total_on_time[pinIndex] + (millis() - last_on_time[pinIndex]);
  }
}

String getContentType(String path)
{
  if (path.endsWith(".js.gz"))
  {
    return "application/javascript";
  }
  else if (path.endsWith(".css.gz"))
  {
    return "text/css";
  }
  else if (path.endsWith(".html.gz"))
  {
    return "text/html";
  }
  else if (path.endsWith(".png.gz"))
  {
    return "image/png";
  }
  else if (path.endsWith(".svg.gz"))
  {
    return "image/svg";
  }
  else
  {
    return "";
  }
}

void notFoundHandler(AsyncWebServerRequest *req)
{
  req->send(404, "text/plain", "Not found!");
}

void wwwRootHandler(AsyncWebServerRequest *req, String path, String contentType)
{
  if (LittleFS.exists(path))
  {
    auto *response = req->beginResponse(LittleFS, path, contentType);
    response->addHeader("Content-Encoding", "gzip");
    req->send(response);
    return;
  }
  notFoundHandler(req);
};

void staticAssetsHandler(AsyncWebServerRequest *req)
{
  /* REG_EX = "^\\/assets\\/(.*)$" */
  String path = "/assets/" + req->pathArg(0) + ".gz";

  if (LittleFS.exists(path))
  {
    auto *response = req->beginResponse(LittleFS, path, getContentType(path));
    response->addHeader("Content-Encoding", "gzip");
    response->addHeader("Cache-Control", "max-age=86400");
    req->send(response);
    return;
  }
  notFoundHandler(req);
};

void pinStateHandler(AsyncWebServerRequest *req)
{
  /* REG_EX = "^\\/pin\\/(12|13|14|5)\\/(high|low|change)$" */
  uint8_t pin = req->pathArg(0).toInt();
  String state = req->pathArg(1);

  if (state == "change")
  {
    digitalWriteWithTime(pin, !digitalRead(pin));
    req->send(200, "text/plain", digitalRead(pin) ? "high" : "low");
    return;
  }
  else
  {
    digitalWriteWithTime(pin, (state == "high"));
    req->send(200, "text/plain", "OK!");
  }
}

void pinStatusHandler(AsyncWebServerRequest *req)
{
  /* REG_EX = "^\\/pin\\/(12|13|14|5)$" */
  uint8_t pin = req->pathArg(0).toInt();
  uint8_t pinIndex = pinMapToIndex(req->pathArg(0).toInt());
  String ps_mode = (power_saver[pinIndex] == POWER_SAVER_TURBO) ? "turbo"
                   : (power_saver[pinIndex] == POWER_SAVER_ON)  ? "on"
                                                                : "off";

  StaticJsonDocument<64> jdoc;
  jdoc["state"] = (bool)digitalRead(pin);
  jdoc["powerMode"] = ps_mode;
  if (!digitalRead(pin)) // INVERT_FOR_RELAY;
  {
    jdoc["uptime"] = total_on_time[pinIndex] + (millis() - last_on_time[pinIndex]);
  }
  else
  {
    jdoc["uptime"] = total_on_time[pinIndex];
  }

  String result;
  serializeJson(jdoc, result);
  req->send(200, "text/plain", result);
}

void powerStatusHandler(AsyncWebServerRequest *req)
{
  String duration = String(millis() - power_changed_time);
  req->send(200, "text/plain", String(power ? "AC:" : "DC:") + duration);
}

void powerModeStateHandler(AsyncWebServerRequest *req)
{
  /* REG_EX = "^\\/power-saver\\/(12|13|14|5)\\/(on|off|turbo)$" */
  uint8_t pin = req->pathArg(0).toInt();
  String state = req->pathArg(1);

  uint8_t ps_mode = (state == "turbo") ? POWER_SAVER_TURBO
                    : (state == "on")  ? POWER_SAVER_ON
                                       : POWER_SAVER_OFF;

  power_saver[pinMapToIndex(pin)] = ps_mode;

  req->send(200, "text/plain", state);
}

void powerModeStatusHandler(AsyncWebServerRequest *req)
{
  /* REG_EX = "^\\/power-saver\\/(12|13|14|5)$" */
  uint8 state = power_saver[pinMapToIndex(req->pathArg(0).toInt())];
  String ps_mode = (state == POWER_SAVER_TURBO) ? "turbo"
                   : (state == POWER_SAVER_ON)  ? "on"
                                                : "off";

  req->send(200, "text/plain", ps_mode);
}

void onTimeResetHandler(AsyncWebServerRequest *req)
{
  /* REG_EX = "^\\/reset-ot-counter\\/(12|13|14|5)$" */
  uint8_t pin = req->pathArg(0).toInt();
  uint8_t pinIndex = pinMapToIndex(pin);

  total_on_time[pinIndex] = 0;

  if (!digitalRead(pin)) // INVERT_FOR_RELAY;
  {
    last_on_time[pinIndex] = millis();
  }
  req->send(200, "text/plain", "OK!");
}

void sendUartMessageHandler(AsyncWebServerRequest *req, uint8_t *data, size_t len, size_t index, size_t total)
{
  StaticJsonDocument<128> _json;
  if (deserializeJson(_json, data, len))
  {
    req->send(404, "text/plain", "ERROR!");
    return;
  }

  serializeMsgPack(_json, Serial);

  req->send(200, "text/plain", "OK!");
}

String macToString(const unsigned char *mac)
{
  char buf[20];
  snprintf(buf, sizeof(buf), "%02x:%02x:%02x:%02x:%02x:%02x",
           mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  return String(buf);
}

void powerModeChangeAction(uint8_t pin)
{
  if (power_saver[pinMapToIndex(pin)] == POWER_SAVER_TURBO)
  {
    digitalWriteWithTime(pin, !power); // RELAY_INVERT;
    return;
  }

  if (!power && power_saver[pinMapToIndex(pin)] == POWER_SAVER_ON)
  {
    digitalWriteWithTime(pin, HIGH); // RELAY_INVERT;
  }
}

void uartMessageHandler()
{
  StaticJsonDocument<64> message;
  if (deserializeMsgPack(message, Serial)) // IF ERROR!
  {
    return;
  }

  String cmd = message["cmd"].as<String>();
  if (cmd == "power" && message.containsKey("value"))
  {
    bool current_power_state = message["value"].as<bool>();

    if (power != current_power_state)
    {
      power_changed_time = millis();
      power = current_power_state;
      digitalWrite(LED_BUILTIN, !power);
      powerModeChangeAction(5);
      powerModeChangeAction(12);
      powerModeChangeAction(13);
      powerModeChangeAction(14);
    }
  }

  if (cmd == "pin" && message.containsKey("pin") && message.containsKey("state"))
  {
    uint8_t pin = message["pin"].as<uint8_t>();
    uint8_t state = message["state"].as<uint8_t>();
    digitalWriteWithTime(pin, (state == 2) ? !digitalRead(pin) : state);
  }
}

void iRemoteHandler()
{
  if (irrecv.decode(&ir_result))
  {
    switch (ir_result.value)
    {
    case IR_POWER:
      digitalWriteWithTime(5, HIGH);
      digitalWriteWithTime(12, HIGH);
      digitalWriteWithTime(13, HIGH);
      digitalWriteWithTime(14, HIGH);
      break;
    case IR_EQ:
      digitalWriteWithTime(5, LOW);
      digitalWriteWithTime(12, LOW);
      digitalWriteWithTime(13, LOW);
      digitalWriteWithTime(14, LOW);
      break;
    case IR_MODE:
      digitalWriteWithTime(5, !digitalRead(5));
      digitalWriteWithTime(12, !digitalRead(12));
      digitalWriteWithTime(13, !digitalRead(13));
      digitalWriteWithTime(14, !digitalRead(14));
      break;
    case IR_1:
      digitalWriteWithTime(5, !digitalRead(5));
      break;
    case IR_2:
      digitalWriteWithTime(12, !digitalRead(12));
      break;
    case IR_3:
      digitalWriteWithTime(13, !digitalRead(13));
      break;
    case IR_4:
      digitalWriteWithTime(14, !digitalRead(14));
      break;
    default:
      break;
    }

    irrecv.resume(); // Receive the next value;
  }
}

/* EXECUTE PROGRAM */
void setup()
{
  // Configure Pins;
  pinMode(12, OUTPUT);
  digitalWrite(12, HIGH);
  pinMode(13, OUTPUT);
  digitalWrite(13, HIGH);
  pinMode(14, OUTPUT);
  digitalWrite(14, HIGH);
  pinMode(5, OUTPUT);
  digitalWrite(5, HIGH);
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH);

  irrecv.enableIRIn();
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid_sta, password);
  Serial.begin(9600);
  LittleFS.begin();

  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);

  // Handle index file.
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *req)
            { wwwRootHandler(req, "/index.html.gz", "text/html"); });

  // Handle manifest.json file.
  server.on("/manifest.json", HTTP_GET, [](AsyncWebServerRequest *req)
            { wwwRootHandler(req, "/manifest.json.gz", "application/manifest+json"); });

  server.on("^\\/assets\\/(.*)$", HTTP_GET, staticAssetsHandler);
  server.on("^\\/pin\\/(12|13|14|5)\\/(high|low|change)$", HTTP_GET, pinStateHandler);
  server.on("^\\/pin\\/(12|13|14|5)$", HTTP_GET, pinStatusHandler);
  server.on("/power", HTTP_GET, powerStatusHandler);
  server.on("^\\/power-saver\\/(12|13|14|5)\\/(on|off|turbo)$", HTTP_GET, powerModeStateHandler);
  server.on("^\\/power-saver\\/(12|13|14|5)$", HTTP_GET, powerModeStatusHandler);
  server.on("^\\/reset-ot-counter\\/(12|13|14|5)$", HTTP_GET, onTimeResetHandler);
  server.on(
      "/send-message", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL, sendUartMessageHandler);

  AsyncElegantOTA.begin(&server);
  server.onNotFound(notFoundHandler);
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");
  server.begin();
}

void loop()
{
  if (Serial.available())
  {
    uartMessageHandler();
  }
  else if (power)
  {
    digitalWrite(LED_BUILTIN, LOW);
  }
  else if (power == false)
  {
    digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
  }
  iRemoteHandler();
  delay(100);
}

#endif