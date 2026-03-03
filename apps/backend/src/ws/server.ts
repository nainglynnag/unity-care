import { WebSocketServer } from "ws";
import type { Server } from "http";
import { startHeartbeat } from "./heartbeat";
import { setupAuthTimeout, handleDisconnect } from "./auth";
import { dispatch } from "./handlers";
import type { AuthenticatedWs } from "./types";

// Attaches a WS server to the existing http.Server.
// Express continues handling all HTTP traffic unchanged.
// The WS server only sees requests with "Upgrade: websocket" header.
//
// path: "/ws" — client connects to ws://host/ws

export function createWebSocketServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({
    server: httpServer,
    path: "/ws",
  });

  // Connection handler
  wss.on("connection", (socket: AuthenticatedWs) => {
    // 1. Set up Option B auth timeout — client has 5s to send AUTH
    setupAuthTimeout(socket);

    // 2. Set isAlive for heartbeat (true on connect, false after each ping)
    socket.isAlive = true;

    // 3. Pong handler — reset isAlive when client responds to binary ping
    socket.on("pong", () => {
      socket.isAlive = true;
    });

    // 4. Message handler — all inbound messages route through dispatch()
    socket.on("message", (data) => {
      // data can be Buffer, ArrayBuffer, or Buffer[] — normalise to string
      const raw = Array.isArray(data)
        ? Buffer.concat(data).toString("utf-8")
        : data.toString("utf-8");

      dispatch(socket, raw).catch((err) => {
        // Unhandled error inside dispatch — log and send generic error
        // Do NOT let it crash the server
        console.error("[WS] dispatch error:", err);
        if (socket.readyState === socket.OPEN) {
          socket.send(
            JSON.stringify({
              type: "ERROR",
              code: 5000,
              message: "Internal server error.",
            }),
          );
        }
      });
    });

    // 5. Close handler — clean up rooms and timers
    socket.on("close", () => {
      handleDisconnect(socket);
    });

    // 6. Error handler — log, do not throw (would crash the process)
    socket.on("error", (err) => {
      console.error("[WS] socket error:", err.message);
    });
  });

  // Heartbeat
  startHeartbeat(wss);

  // Server error handler
  wss.on("error", (err) => {
    console.error("[WS] server error:", err.message);
  });

  console.log("[WS] WebSocket server attached to /ws");
  return wss;
}
