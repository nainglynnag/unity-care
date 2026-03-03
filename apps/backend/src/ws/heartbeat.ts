import { WebSocketServer } from "ws";
import type { AuthenticatedWs } from "./types";

// Binary ping/pong heartbeat
// ws library uses native WS protocol ping frames (not JSON messages).
// Server sends a ping every INTERVAL ms.
// Client (browser / ws library) automatically responds with a pong frame.
// If no pong received before the next ping cycle, the socket is dead -> terminate.
//
// This is SEPARATE from the application-level PING/PONG JSON messages,
// which let the frontend show a "connected" indicator.
//
// Why terminate() instead of close()?
// close() sends a close frame — requires the other side to respond.
// terminate() immediately destroys the socket — correct for dead connections.

const INTERVAL = 30_000; // 30 seconds between pings

export function startHeartbeat(wss: WebSocketServer): void {
  const timer = setInterval(() => {
    wss.clients.forEach((socket) => {
      const ws = socket as AuthenticatedWs;

      if (!ws.isAlive) {
        // Did not respond to last ping — connection is dead
        ws.terminate();
        return;
      }

      ws.isAlive = false; // will be set back to true when pong arrives
      ws.ping(); // native WS binary ping frame
    });
  }, INTERVAL);

  // Clean up interval when WS server closes (e.g. graceful shutdown)
  wss.on("close", () => clearInterval(timer));
}
