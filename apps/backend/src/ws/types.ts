import type { WebSocket } from "ws";
import type { JwtPayload } from "../utils/jwt";

// Extended interface attached to each ws socket after successful AUTH.
// isAlive tracks heartbeat state — set to true on pong, false before each ping.
// authTimer holds the 5s unauthenticated timeout handle so it can be cleared
// on successful AUTH.

export interface AuthenticatedWs extends WebSocket {
  user?: JwtPayload; // undefined until AUTH succeeds
  isAlive: boolean;
  authTimer?: ReturnType<typeof setTimeout>;
}

// Client -> Server messages

export type ClientMessage =
  | { type: "AUTH"; token: string }
  | { type: "SUBSCRIBE_MISSION"; missionId: string }
  | { type: "UNSUBSCRIBE_MISSION"; missionId: string }
  | { type: "PING" };

// Server -> Client messages

export interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  message: string;
  referenceType: string | null;
  referenceId: string | null;
  isRead: boolean;
  createdAt: Date;
}

export interface TrackingPayload {
  volunteerId: string;
  latitude: number;
  longitude: number;
  recordedAt: Date;
}

export type ServerMessage =
  | { type: "AUTH_SUCCESS"; userId: string; role: string }
  | { type: "SUBSCRIBED"; missionId: string }
  | { type: "UNSUBSCRIBED"; missionId: string }
  | { type: "NOTIFICATION"; data: NotificationPayload }
  | { type: "TRACKING_UPDATE"; data: TrackingPayload }
  | { type: "MISSION_CLOSED"; missionId: string }
  | { type: "PONG" }
  | { type: "ERROR"; code: number; message: string };

// Room keys
// Personal notification rooms:  userId          (e.g. "a1b2c3d4-...")
// Mission tracking rooms:       "mission:<id>"  (e.g. "mission:e5f6g7h8-...")
// Prefixing mission rooms avoids collision if a missionId ever matches a userId.
