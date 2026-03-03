import { WebSocket } from "ws";
import type { ServerMessage } from "./types";

// In-process room registry
// Map<roomKey, Set<WebSocket>>
// Single-server deployment: this Map lives in process memory.
// Multi-server future: replace broadcastToRoom internals with Redis pub/sub.
// The joinRoom / leaveRoom / broadcastToRoom interface does NOT change —
// callers (services) are insulated from the transport swap.

const rooms = new Map<string, Set<WebSocket>>();

export function joinRoom(key: string, ws: WebSocket): void {
  if (!rooms.has(key)) rooms.set(key, new Set());
  rooms.get(key)!.add(ws);
}

export function leaveRoom(key: string, ws: WebSocket): void {
  const room = rooms.get(key);
  if (!room) return;
  room.delete(ws);
  if (room.size === 0) rooms.delete(key); // GC empty rooms immediately
}

export function leaveAllRooms(ws: WebSocket): void {
  // Called on disconnect — removes socket from every room it joined.
  // Iterates all rooms — acceptable since a single client joins at most
  // 1 personal room + N mission rooms (N is typically 1-3).
  for (const [key, room] of rooms) {
    room.delete(ws);
    if (room.size === 0) rooms.delete(key);
  }
}

export function broadcastToRoom(
  key: string,
  payload: ServerMessage,
  exclude?: WebSocket, // optional: skip one socket (e.g. the sender)
): void {
  const room = rooms.get(key);
  if (!room) return;

  const msg = JSON.stringify(payload);

  for (const ws of room) {
    if (ws === exclude) continue;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

// Server-side forced room eviction on mission close.
// Does NOT close the sockets — just removes them from this room.
// Sockets remain open and in their other rooms (e.g. personal userId room).
export function clearRoom(key: string): void {
  rooms.delete(key);
}

// Debug helper (dev only, never call in production paths)
export function getRoomSizes(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, room] of rooms) out[key] = room.size;
  return out;
}
