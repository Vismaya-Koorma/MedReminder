/*
 * ============================================================================
 * Medicine Reminder & Monitoring System - ESP32 Dispenser Firmware
 * ============================================================================
 * Target Microcontroller: ESP32
 *
 * Hardware Pin Connections:
 * 1. FC-51 Infrared Obstacle Avoidance Sensor:
 *    - VCC -> 3V3
 *    - GND -> GND
 *    - OUT -> GPIO22
 *    Sensor Electrical Logic:
 *    - LOW  = Hand / Object detected (Infrared reflected to receiver)
 *    - HIGH = Beam clear (No obstacle detected)
 *
 * 2. Medicine Reminder Alert LED:
 *    - Anode (+) -> GPIO19 (via ~220Ω resistor)
 *    - Cathode (-) -> GND
 *    LED Behavior:
 *    - Blinks non-blocking (~500 ms ON / ~500 ms OFF) when reminder is DUE.
 *    - Turns OFF IMMEDIATELY the instant FC-51 detects a hand (LOW on GPIO 22).
 *    - Latch acknowledgement persists across reminder polls while that reminder
 *      remains active, keeping LED OFF.
 *    - Latch resets automatically when reminder is cleared / marked TAKEN on web.
 *    - Remains OFF when no reminder is DUE.
 *
 * 3. Active Buzzer Module (3-pin, Active-LOW):
 *    - GND -> ESP32 GND
 *    - IO  -> GPIO18
 *    - VCC -> ESP32 3V3
 *    Trigger Logic:
 *    - BUZZER_ON  = LOW  (0V conducts PNP transistor -> Buzzer sounds)
 *    - BUZZER_OFF = HIGH (3.3V cuts off PNP transistor -> Buzzer silent)
 *    Buzzer Behavior:
 *    - Beeps intermittently (~500 ms ON / ~500 ms OFF) when reminder is DUE.
 *    - Turns OFF IMMEDIATELY the instant FC-51 detects a hand (LOW on GPIO 22).
 *    - Latch acknowledgement persists across reminder polls while that reminder
 *      remains active, keeping Buzzer OFF.
 *    - Remains OFF when no reminder is DUE.
 *
 * Backend API Contract:
 *   - Reminder Status:   GET  /api/devices/reminder-due/?compartment=1 (IsAuthenticated)
 *   - Heartbeat:         POST /api/devices/heartbeat/ (AllowAny)
 *   - Compartment Event: POST /api/devices/compartment-event/ (IsAuthenticated)
 * ============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include "config.h"

// State variables for sensor reading (GPIO 22)
int lastReading = HIGH;
int stableState = HIGH;
unsigned long lastDebounceTime = 0;
unsigned long sensorLowStartTime = 0;
const unsigned long HAND_CONFIRM_DELAY_MS = 50; // Hand must be continuously present for 50 ms to dismiss LED

// State variables for non-blocking reminder LED alert (GPIO 19)
bool isReminderDue = false;
bool reminderAcknowledged = false; // Latch: hand-detected acknowledgement suppresses LED until cleared
int lastDueCount = 0;              // Track due_count to detect when a NEW scheduled dose arrives
int ledState = LOW;
unsigned long lastLedBlinkTime = 0;

// State variables for non-blocking reminder Buzzer alert (GPIO 18)
int buzzerState = BUZZER_OFF;
unsigned long lastBuzzerBlinkTime = 0;

// Timer for periodic DUE reminder polling
unsigned long lastReminderPollTime = 0;

// Timer for periodic heartbeat
unsigned long lastHeartbeatTime = 0;

// Timer for periodic diagnostic logging to Serial Monitor
unsigned long lastDiagLogTime = 0;

// Wi-Fi reconnection tracking
unsigned long lastWifiRetryTime = 0;
const unsigned long WIFI_RETRY_INTERVAL_MS = 10000;

// Function prototypes
void connectWiFi();
void checkWiFiConnection();
void updateReminderLed();
void updateReminderBuzzer();
void checkReminderStatus();
void sendHeartbeat();
void sendCompartmentEvent(const char* eventType);

void setup() {
  // 1. Earliest safe point: Immediately drive active-LOW Buzzer to BUZZER_OFF (HIGH)
  // before delays or serial initialization to mute buzzer as early as possible
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, BUZZER_OFF);

  Serial.begin(115200);
  delay(1000);

  Serial.println("\n==========================================");
  Serial.println("  Medicine Reminder System - ESP32 Node   ");
  Serial.println("==========================================");
  Serial.printf("Device ID: %s\n", DEVICE_ID);
  Serial.printf("Target Server: %s\n", SERVER_BASE_URL);
  Serial.printf("Sensor Pin: GPIO %d (FC-51 OUT)\n", SENSOR_PIN);
  Serial.printf("LED Alert Pin: GPIO %d\n", LED_PIN);
  Serial.printf("Buzzer Alert Pin: GPIO %d (Active-LOW: ON=%d, OFF=%d)\n", BUZZER_PIN, BUZZER_ON, BUZZER_OFF);
  Serial.printf("Debounce Filter: %lu ms\n", DEBOUNCE_DELAY_MS);
  Serial.println("==========================================\n");

  // Configure sensor pin as INPUT_PULLUP (safely defaults floating/idle line to HIGH / clear beam)
  pinMode(SENSOR_PIN, INPUT_PULLUP);
  int initialSensorVal = digitalRead(SENSOR_PIN);
  stableState = initialSensorVal;
  lastReading = initialSensorVal;

  Serial.printf("[INIT] Initial GPIO 22 reading: %d (%s)\n",
    initialSensorVal,
    (initialSensorVal == LOW ? "LOW - Object detected at startup" : "HIGH - Beam clear")
  );

  // Configure reminder alert LED pin as output, initialized LOW (OFF)
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // Initial Wi-Fi connection
  connectWiFi();

  // Send initial startup heartbeat and initial status check if connected
  if (WiFi.status() == WL_CONNECTED) {
    sendHeartbeat();
    checkReminderStatus();
  }
}

void loop() {
  // 1. Maintain Wi-Fi connectivity
  checkWiFiConnection();

  // 2. Read raw sensor value on every single iteration
  int rawSensorReading = digitalRead(SENSOR_PIN);

  // 2a. CONFIRMED HAND DETECTION & LED SHUTOFF:
  // When sensor is continuously LOW for at least HAND_CONFIRM_DELAY_MS (50 ms),
  // confirm that a real hand is present (rejects transient microsecond noise glitches).
  if (rawSensorReading == LOW) {
    if (sensorLowStartTime == 0) {
      sensorLowStartTime = millis();
    } else if ((millis() - sensorLowStartTime) >= HAND_CONFIRM_DELAY_MS) {
      if (isReminderDue && !reminderAcknowledged) {
        reminderAcknowledged = true;
        ledState = LOW;
        digitalWrite(LED_PIN, LOW);
        buzzerState = BUZZER_OFF;
        digitalWrite(BUZZER_PIN, BUZZER_OFF);

        Serial.println("\n==================================================================");
        Serial.println("[HAND DETECTED] >>> FC-51 Sensor CONFIRMED LOW (Hand present >= 50 ms)! <<<");
        Serial.println("[ALERT CONTROL] Reason: Confirmed hand -> reminderAcknowledged=true, LED & Buzzer turned OFF");
        Serial.println("==================================================================\n");

        // Post reminder acknowledgement event to backend (does NOT mark medicine as TAKEN)
        sendCompartmentEvent("REMINDER_ACKNOWLEDGED");
      } else if (reminderAcknowledged) {
        // Enforce LED and Buzzer stay strictly OFF while acknowledged
        if (ledState != LOW || digitalRead(LED_PIN) != LOW) {
          ledState = LOW;
          digitalWrite(LED_PIN, LOW);
        }
        if (buzzerState != BUZZER_OFF || digitalRead(BUZZER_PIN) != BUZZER_OFF) {
          buzzerState = BUZZER_OFF;
          digitalWrite(BUZZER_PIN, BUZZER_OFF);
        }
      }
    }
  } else {
    // Sensor is HIGH (beam clear) -> reset confirmation timer
    sensorLowStartTime = 0;
  }

  // 2b. Transition diagnostic logging
  if (rawSensorReading != lastReading) {
    lastDebounceTime = millis();
    Serial.printf("[DIAG SENSOR] GPIO 22 transition: %s -> %s (Raw: %d)\n",
      (lastReading == LOW ? "LOW" : "HIGH"),
      (rawSensorReading == LOW ? "LOW (HAND/OBJECT DETECTED)" : "HIGH (BEAM CLEAR)"),
      rawSensorReading
    );
  }

  // 2c. Fast debounce filter (50 ms) for physical compartment open/close events
  if ((millis() - lastDebounceTime) > DEBOUNCE_DELAY_MS) {
    if (rawSensorReading != stableState) {
      stableState = rawSensorReading;

      if (stableState == LOW) {
        Serial.println("[COMPARTMENT] Stable State: COMPARTMENT_OPENED (Hand in compartment)");
        sendCompartmentEvent("COMPARTMENT_OPENED");
      } else {
        Serial.println("[COMPARTMENT] Stable State: COMPARTMENT_CLOSED (Hand removed/Beam restored)");
        sendCompartmentEvent("COMPARTMENT_CLOSED");
      }
    }
  }

  lastReading = rawSensorReading;

  // 3. Update non-blocking reminder LED alert on GPIO 19 (~500 ms ON / ~500 ms OFF)
  updateReminderLed();

  // 3b. Update non-blocking reminder Buzzer alert on GPIO 18 (~500 ms ON / ~500 ms OFF)
  updateReminderBuzzer();

  // 4. Periodic polling for DUE medicine reminders (every 3 seconds)
  if (millis() - lastReminderPollTime >= REMINDER_POLL_INTERVAL_MS) {
    lastReminderPollTime = millis();
    checkReminderStatus();
  }

  // 5. Periodic Heartbeat (every 60 seconds)
  if (millis() - lastHeartbeatTime >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatTime = millis();
    sendHeartbeat();
  }

  // 6. Periodic live diagnostics to Serial Monitor (every 2 seconds)
  if (millis() - lastDiagLogTime >= 2000) {
    lastDiagLogTime = millis();
    int currentSensor = digitalRead(SENSOR_PIN);
    int currentLed = digitalRead(LED_PIN);
    int currentBuzzer = digitalRead(BUZZER_PIN);
    Serial.printf("[STATUS DIAG] SENSOR (GPIO 22): %s | LED (GPIO 19): %s | BUZZER (GPIO 18): %s | Reminder Due: %s | Ack Latch: %s\n",
      (currentSensor == LOW ? "LOW [HAND DETECTED]" : "HIGH [CLEAR]"),
      (currentLed == HIGH ? "ON (Blinking)" : "OFF"),
      (currentBuzzer == BUZZER_ON ? "ON (Beeping)" : "OFF"),
      (isReminderDue ? "YES" : "NO"),
      (reminderAcknowledged ? "YES (Suppressed)" : "NO")
    );
  }

  // Small delay to prevent tight loop spinning
  delay(10);
}

/**
 * Non-blocking LED controller for GPIO 19
 * Blinks continuously (~500 ms ON / ~500 ms OFF) while isReminderDue is true AND NOT acknowledged by hand.
 * Turns OFF when hand is confirmed (reminderAcknowledged == true) or reminder is cleared.
 */
void updateReminderLed() {
  if (isReminderDue && !reminderAcknowledged) {
    unsigned long currentMillis = millis();
    if (currentMillis - lastLedBlinkTime >= LED_BLINK_INTERVAL_MS) {
      lastLedBlinkTime = currentMillis;
      ledState = (ledState == LOW) ? HIGH : LOW;
      digitalWrite(LED_PIN, ledState);
      Serial.printf("[LED BLINK] GPIO 19 toggled to %s (isReminderDue=true, reminderAcknowledged=false)\n",
        (ledState == HIGH ? "HIGH (ON)" : "LOW (OFF)"));
    }
  } else {
    // Ensure LED is strictly OFF when not due or when reminder is acknowledged
    if (ledState != LOW || digitalRead(LED_PIN) != LOW) {
      ledState = LOW;
      digitalWrite(LED_PIN, LOW);
      Serial.printf("[LED CONTROL] Reason: %s -> GPIO 19 set LOW\n",
        (!isReminderDue ? "No reminder due" : "Reminder acknowledged by hand latch"));
    }
  }
}

/**
 * Non-blocking Buzzer controller for GPIO 18 (Active-LOW)
 * Beeps intermittently (~500 ms ON / ~500 ms OFF) while isReminderDue is true AND NOT acknowledged by hand.
 * Turns OFF (BUZZER_OFF / HIGH) when hand is confirmed (reminderAcknowledged == true) or reminder is cleared.
 */
void updateReminderBuzzer() {
  if (isReminderDue && !reminderAcknowledged) {
    unsigned long currentMillis = millis();
    if (currentMillis - lastBuzzerBlinkTime >= BUZZER_BEEP_INTERVAL_MS) {
      lastBuzzerBlinkTime = currentMillis;
      buzzerState = (buzzerState == BUZZER_ON) ? BUZZER_OFF : BUZZER_ON;
      digitalWrite(BUZZER_PIN, buzzerState);
      Serial.printf("[BUZZER] GPIO 18 toggled to %s (isReminderDue=true, reminderAcknowledged=false)\n",
        (buzzerState == BUZZER_ON ? "BUZZER_ON (Sounding)" : "BUZZER_OFF (Silent)"));
    }
  } else {
    // Ensure Buzzer is strictly OFF (BUZZER_OFF / HIGH) when not due or when reminder is acknowledged
    if (buzzerState != BUZZER_OFF || digitalRead(BUZZER_PIN) != BUZZER_OFF) {
      buzzerState = BUZZER_OFF;
      digitalWrite(BUZZER_PIN, BUZZER_OFF);
      Serial.printf("[BUZZER CONTROL] Reason: %s -> GPIO 18 set to BUZZER_OFF\n",
        (!isReminderDue ? "No reminder due" : "Reminder acknowledged by hand latch"));
    }
  }
}

/**
 * Periodically query Django backend for current DUE reminder status
 * Endpoint: GET /api/devices/reminder-due/?compartment=1 (IsAuthenticated)
 */
void checkReminderStatus() {
  if (WiFi.status() != WL_CONNECTED) {
    // Wi-Fi disconnected: Safely preserve current alert state.
    // Do NOT assume medicine was taken on network interruption.
    return;
  }

  HTTPClient http;
  String url = String(SERVER_BASE_URL) + "/api/devices/reminder-due/?compartment=" + String(COMPARTMENT_NUMBER);

  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT_MS);

  // Authenticate with Django REST Framework Auth Token
  String authHeader = "Token " + String(AUTH_TOKEN);
  http.addHeader("Authorization", authHeader);
  http.addHeader("Content-Type", "application/json");

  int httpCode = http.GET();

  if (httpCode == HTTP_CODE_OK) {
    String response = http.getString();

    int currentDueCount = 0;
    int dueCountIdx = response.indexOf("\"due_count\":");
    if (dueCountIdx >= 0) {
      currentDueCount = response.substring(dueCountIdx + 12).toInt();
    }

    // Check for reminder due state in JSON response
    if (response.indexOf("\"is_reminder_due\":true") >= 0 || response.indexOf("\"is_reminder_due\": true") >= 0) {
      bool brandNewDue = (!isReminderDue) || (currentDueCount > lastDueCount && currentDueCount > 0);
      lastDueCount = currentDueCount;

      if (brandNewDue) {
        // A brand new reminder has just transitioned to DUE
        Serial.printf("\n[REMINDER POLL] >>> Brand new reminder DUE from server! (due_count=%d) <<<\n", currentDueCount);
        isReminderDue = true;
        reminderAcknowledged = false; // Fresh reminder: reset latch
        sensorLowStartTime = 0;
        lastLedBlinkTime = millis();
        ledState = HIGH;
        digitalWrite(LED_PIN, HIGH);
        lastBuzzerBlinkTime = millis();
        buzzerState = BUZZER_ON;
        digitalWrite(BUZZER_PIN, BUZZER_ON);
        Serial.println("[ALERT CONTROL] Reason: Brand new reminder DUE -> starting blink & beep on GPIO 19 & GPIO 18");
      } else {
        // Requirement 4: Ensure reminder polling cannot turn the LED or Buzzer back on while reminderAcknowledged == true
        if (reminderAcknowledged) {
          if (ledState != LOW || digitalRead(LED_PIN) != LOW) {
            ledState = LOW;
            digitalWrite(LED_PIN, LOW);
          }
          if (buzzerState != BUZZER_OFF || digitalRead(BUZZER_PIN) != BUZZER_OFF) {
            buzzerState = BUZZER_OFF;
            digitalWrite(BUZZER_PIN, BUZZER_OFF);
          }
          Serial.println("[REMINDER POLL] Server: reminder is still DUE, but acknowledged by hand latch. Keeping LED & Buzzer OFF.");
        }
      }
    } else if (response.indexOf("\"is_reminder_due\":false") >= 0 || response.indexOf("\"is_reminder_due\": false") >= 0) {
      lastDueCount = 0;
      // Requirement 5: Clear acknowledgement latch ONLY when reminder is no longer due
      if (isReminderDue || reminderAcknowledged) {
        Serial.println("\n[REMINDER POLL] --- Medicine marked TAKEN / cleared on server. Resetting alert latch ---");
        isReminderDue = false;
        reminderAcknowledged = false; // Reset latch so NEXT scheduled reminder can blink normally
        sensorLowStartTime = 0;
        ledState = LOW;
        digitalWrite(LED_PIN, LOW);
        buzzerState = BUZZER_OFF;
        digitalWrite(BUZZER_PIN, BUZZER_OFF);
        Serial.println("[ALERT CONTROL] Reason: Reminder no longer DUE -> latch reset, GPIO 19 LED set LOW & GPIO 18 Buzzer set to BUZZER_OFF");
      }
    }
  } else {
    // Backend unreachable or returned error:
    // Safely preserve alert state. Do not assume taken.
    if (httpCode < 0) {
      Serial.printf("[REMINDER POLL] Warning: Status check connection failed (%s, code %d). Ensure Django is running on 0.0.0.0:8000 and PC IP is reachable. Alert state preserved (due=%d, ack=%d).\n",
        http.errorToString(httpCode).c_str(), httpCode, isReminderDue, reminderAcknowledged);
    } else {
      Serial.printf("[REMINDER POLL] Warning: Status check HTTP code %d. Alert state preserved (due=%d, ack=%d).\n",
        httpCode, isReminderDue, reminderAcknowledged);
    }
    if (reminderAcknowledged) {
      if (ledState != LOW || digitalRead(LED_PIN) != LOW) {
        ledState = LOW;
        digitalWrite(LED_PIN, LOW);
      }
      if (buzzerState != BUZZER_OFF || digitalRead(BUZZER_PIN) != BUZZER_OFF) {
        buzzerState = BUZZER_OFF;
        digitalWrite(BUZZER_PIN, BUZZER_OFF);
      }
    }
  }

  http.end();
}

/**
 * Connect to Wi-Fi network specified in config.h
 */
void connectWiFi() {
  Serial.printf("[WIFI] Connecting to SSID: '%s'", WIFI_SSID);

  // Cleanly reset any lingering Wi-Fi state before starting
  WiFi.disconnect(true);
  delay(100);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 15000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Connected successfully!");
    Serial.printf("[WIFI] ESP32 Assigned IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[WIFI] Signal Strength (RSSI): %d dBm\n", WiFi.RSSI());
  } else {
    Serial.println("\n[WIFI] Warning: Initial connection timed out.");
    int status = WiFi.status();
    if (status == WL_NO_SSID_AVAIL) {
      Serial.println("[WIFI] Diagnostic: SSID not found. Verify hotspot is active and exact spelling/case.");
    } else if (status == WL_CONNECT_FAILED) {
      Serial.println("[WIFI] Diagnostic: Handshake failed. Verify hotspot password.");
    } else {
      Serial.printf("[WIFI] Diagnostic: Status code %d. Will retry in background.\n", status);
    }
  }
}

/**
 * Periodically verify Wi-Fi status and reconnect if connection is lost
 */
void checkWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastWifiRetryTime >= WIFI_RETRY_INTERVAL_MS) {
      lastWifiRetryTime = millis();
      Serial.printf("[WIFI] Retrying connection to '%s'...\n", WIFI_SSID);
      WiFi.disconnect();
      delay(100);
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
  }
}

/**
 * Send periodic device heartbeat to Django backend
 * Endpoint: POST /api/devices/heartbeat/ (AllowAny)
 */
void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HEARTBEAT] Skipped: Wi-Fi not connected.");
    return;
  }

  HTTPClient http;
  String url = String(SERVER_BASE_URL) + "/api/devices/heartbeat/";

  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");

  // Calculate approximate Wi-Fi status string based on RSSI
  int rssi = WiFi.RSSI();
  String wifiQuality = (rssi > -67) ? "Strong" : (rssi > -80 ? "Fair" : "Weak");

  // Construct JSON payload
  String payload = "{";
  payload += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"battery_level\":100,";
  payload += "\"wifi_status\":\"Connected (" + wifiQuality + ")\",";
  payload += "\"firmware_version\":\"1.0.0\",";
  payload += "\"is_simulated\":false";
  payload += "}";

  Serial.println("[HEARTBEAT] Sending status update to server...");
  int httpCode = http.POST(payload);

  if (httpCode > 0) {
    Serial.printf("[HEARTBEAT] Response Code: %d\n", httpCode);
    if (httpCode == HTTP_CODE_OK) {
      String response = http.getString();
      Serial.printf("[HEARTBEAT] Server Response: %s\n", response.c_str());
    }
  } else {
    Serial.printf("[HEARTBEAT] Failed, error: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}

/**
 * Send compartment interaction event to Django backend
 * Endpoint: POST /api/devices/compartment-event/ (IsAuthenticated)
 * @param eventType Event string (COMPARTMENT_OPENED, COMPARTMENT_CLOSED, REMINDER_ACKNOWLEDGED)
 */
void sendCompartmentEvent(const char* eventType) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[EVENT] Skipped: Wi-Fi not connected.");
    return;
  }

  HTTPClient http;
  String url = String(SERVER_BASE_URL) + "/api/devices/compartment-event/";

  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");

  // Token authentication required for device events
  String authHeader = "Token " + String(AUTH_TOKEN);
  http.addHeader("Authorization", authHeader);

  // Construct JSON payload
  String payload = "{";
  payload += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"compartment\":" + String(COMPARTMENT_NUMBER) + ",";
  payload += "\"event\":\"" + String(eventType) + "\"";
  payload += "}";

  Serial.printf("[EVENT] Posting %s to %s\n", eventType, url.c_str());
  Serial.printf("[EVENT] Payload: %s\n", payload.c_str());

  int httpCode = http.POST(payload);

  if (httpCode > 0) {
    Serial.printf("[EVENT] Response Code: %d\n", httpCode);
    String response = http.getString();
    Serial.printf("[EVENT] Server Response: %s\n", response.c_str());
  } else {
    Serial.printf("[EVENT] Failed, error: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}
