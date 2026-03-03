import { broadcastToRoom, clearRoom } from "./rooms";
import type { NotificationPayload, TrackingPayload } from "./types";

// Centralised broadcast helpers called by service functions AFTER DB writes.
// Each helper is a thin wrapper that builds the ServerMessage envelope and
// delegates to broadcastToRoom. Services never import rooms.ts directly —
// they go through these helpers so the message shape is enforced in one place.

// Push a real-time notification to a user's personal WS room.
// No-op if the user has no open WS connection — they will catch up
// via GET /notifications on next app open.
//
// For createMany (batch) writes that don't return individual rows,
// pass a partial payload with id set to empty string. The client uses
// referenceType + referenceId for de-duplication and fetches full data via REST.
export function broadcastNotification(
  userId: string,
  notification: NotificationPayload,
): void {
  broadcastToRoom(userId, {
    type: "NOTIFICATION",
    data: notification,
  });
}

// Push a GPS tracking update to all subscribers of a mission room.
export function broadcastTrackingUpdate(
  missionId: string,
  tracking: TrackingPayload,
): void {
  broadcastToRoom(`mission:${missionId}`, {
    type: "TRACKING_UPDATE",
    data: tracking,
  });
}

// Notify all mission room subscribers that the mission has reached a terminal
// state (CLOSED, CANCELLED, or FAILED). After broadcasting, the room is
// forcefully cleared server-side so sockets are removed immediately.
export function broadcastMissionTerminal(missionId: string): void {
  broadcastToRoom(`mission:${missionId}`, {
    type: "MISSION_CLOSED",
    missionId,
  });
  clearRoom(`mission:${missionId}`);
}
