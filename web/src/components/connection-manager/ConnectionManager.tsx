import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
type MessageCallback = (message: JSON) => void;

type WebSocketContextType = {
  sendMessage: (msg: object) => void;
  subscribe: (type: string, cb: MessageCallback) => void;
  unsubscribe: (type: string, cb: MessageCallback) => void;
  connected: boolean;
  lastSync: Date;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined)

export const useWebSocket = () => {
  const ctx = useContext(WebSocketContext)
  if (!ctx) throw new Error("useWebSocket must be used within ConnectionManager")
  return ctx
}

export const ConnectionManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const socket = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const callbacks = useRef<Map<string, Set<MessageCallback>>>(new Map());

  // Subscribe to a message type
  const subscribe = useCallback((type: string, cb: MessageCallback) => {
    if (!callbacks.current.has(type)) callbacks.current.set(type, new Set())
    callbacks.current.get(type)!.add(cb);
  }, []);

  // Unsubscribe from a message type
  const unsubscribe = useCallback((type: string, cb: MessageCallback) => {
    callbacks.current.get(type)?.delete(cb);
  }, []);

  // Try to reconnect if the connection is lost
  const connectWS = () => {
    if (socket.current && socket.current.readyState === WebSocket.OPEN) { return; }

    // Use VITE_WS_URL if set, otherwise default to current host
    const url = import.meta.env.VITE_WS_URL ?? window.location.hostname;
    console.log("Checking connection to ESP32 at ", url);
    socket.current = new WebSocket(`ws://${url}/ws`);
    if (!socket.current) {
      console.error("Failed to create WebSocket connection");
      setTimeout(connectWS, 2000);
      return;
    }
    console.log("WebSocket connection created, waiting for open...");
    socket.current.onopen = () => {
      setConnected(true);
      console.log("WebSocket connection established");
    };
    socket.current.onmessage = handleWSMessages;
    socket.current.onclose = () => {
      setConnected(false);
      console.log("WebSocket connection closed. Attempting to reconnect...");
      setTimeout(connectWS, 1000);
    };
  };

  const requestSystemData = () => {
    sendMessage({ api_handler: "get_system_data" });
    console.debug("Requesting system data...");
  }

  // Handles received messages
  const handleWSMessages = async (event: MessageEvent) => {
    setLastSync(new Date());
    const data = JSON.parse(event.data);
    const type = data.type

    // Call registered callbacks for this type
    console.debug("Received message of type:", type, data);
    callbacks.current.get(type)?.forEach((cb: MessageCallback) => cb(data));
  };

  // Connect on mount
  useEffect(() => {
    connectWS();
    requestSystemData();
    
    return () => {
      socket.current?.close();
    }
  }, [])

  // Send function
  const sendMessage = useCallback((msg: object) => {
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify(msg))
      console.debug("Sent message:", msg);
    }
  }, [connected]);

  return (
    <WebSocketContext.Provider value={{ sendMessage, subscribe, unsubscribe, connected, lastSync }}>
      {children}
    </WebSocketContext.Provider>
  );
}