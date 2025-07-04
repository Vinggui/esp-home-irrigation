#pragma once

Class WebServer {
    WebServer(int port = 80);
    void begin();
    void handleClient();
}