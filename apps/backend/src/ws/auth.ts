import { verifyAccessTokenDetailed } from "../utils/jwt";
import { leaveAllRooms, joinRoom } from "./rooms";
import type { AuthenticatedWs, ClientMessage, ServerMessage } from "./types";

// Auth timeout
// Client has AUTH_TIMEOUT_MS to send { type: "AUTH", token: "..." } after
// connecting. If it doesn't, close with 4005 (auth timeout).
// This prevents unauthenticated sockets from sitting open indefinitely.

const AUTH_TIMEOUT_MS = 5_000;

// Safe send — checks readyState before calling ws.send().
// Used throughout ws/ files.

export function send(ws: AuthenticatedWs, payload: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

// Called immediately after connection is accepted.
// Starts the 5-second unauthenticated window.

export function setupAuthTimeout(ws: AuthenticatedWs): void {
  ws.isAlive = true;
  ws.user = undefined;

  ws.authTimer = setTimeout(() => {
    if (!ws.user) {
      // AUTH message never arrived
      ws.close(
        4005,
        "Auth timeout: no AUTH message received within 5 seconds.",
      );
    }
  }, AUTH_TIMEOUT_MS);
}

// Called from handlers.ts when type === "AUTH".
// Validates the JWT, attaches user to socket, joins personal room.
// Returns true if auth succeeded, false if rejected (socket was closed).

export function handleAuthMessage(
  ws: AuthenticatedWs,
  data: Extract<ClientMessage, { type: "AUTH" }>,
): boolean {
  // Already authenticated — ignore duplicate AUTH messages.
  // A client shouldn't send AUTH twice, but guard against buggy clients.
  if (ws.user) {
    send(ws, {
      type: "ERROR",
      code: 4004,
      message: "Already authenticated.",
    });
    return false;
  }

  const result = verifyAccessTokenDetailed(data.token);

  if (result.status === "expired") {
    ws.close(4003, "Token expired: please refresh and reconnect.");
    return false;
  }

  if (result.status === "invalid") {
    ws.close(4001, "Unauthorized: invalid token.");
    return false;
  }

  // Clear the auth timeout — client authenticated in time
  if (ws.authTimer) {
    clearTimeout(ws.authTimer);
    ws.authTimer = undefined;
  }

  // Attach identity to socket
  ws.user = result.payload;

  // Join personal notification room (userId as key)
  joinRoom(result.payload.sub, ws);

  // Confirm authentication to client
  send(ws, {
    type: "AUTH_SUCCESS",
    userId: result.payload.sub,
    role: result.payload.role,
  });

  return true;
}

// Called in ws.on("close"). Cleans up all state for this socket.

export function handleDisconnect(ws: AuthenticatedWs): void {
  // Cancel auth timer if still pending (client disconnected before authing)
  if (ws.authTimer) {
    clearTimeout(ws.authTimer);
    ws.authTimer = undefined;
  }

  // Remove from every room the socket had joined
  leaveAllRooms(ws);
}
