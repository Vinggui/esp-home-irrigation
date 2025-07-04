#include <Arduino.h>

#define LED 2

void setup() {
  // put your setup code here, to run once:
  pinMode(LED, OUTPUT);
}

// void loop(void) {
//   server.handleClient();
//   delay(2);
// }
void loop() {
  // put your main code here, to run repeatedly:
  digitalWrite(LED, HIGH);   // turn the LED on (HIGH is the voltage level)
  delay(5);               // wait for a second
  digitalWrite(LED, LOW);    // turn the LED off by making the voltage LOW
  delay(11);               // wait for a second
}