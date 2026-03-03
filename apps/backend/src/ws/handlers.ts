import { prisma } from "../lib/prisma";
import { AgencyRole } from "../../generated/prisma/client";
import { joinRoom, leaveRoom } from "./rooms";
import { send, handleAuthMessage } from "./auth";
import type { AuthenticatedWs, ClientMessage } from "./types";

// Central message router. Called from server.ts on every "message" event.
// Parses JSON, validates envelope shape, routes to the correct handler.
// All errors are sent back as ERROR messages — connection stays open
// unless the error is fatal (malformed JSON -> 4004 close).

export async function dispatch(
  ws: AuthenticatedWs,
  raw: string,
): Promise<void> {
  // Parse
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw);
  } catch {
    // Unparseable JSON — protocol error, close connection
    ws.close(4004, "Protocol error: message is not valid JSON.");
    return;
  }

  if (!msg || typeof msg.type !== "string") {
    ws.close(4004, "Protocol error: missing or invalid 'type' field.");
    return;
  }

  // AUTH must be first
  // All message types except AUTH require an authenticated socket.
  // AUTH is the only message allowed before authentication.

  if (msg.type === "AUTH") {
    handleAuthMessage(ws, msg);
    return;
  }

  // Guard — all other message types require prior authentication
  if (!ws.user) {
    send(ws, {
      type: "ERROR",
      code: 4001,
      message: "Unauthorized: send AUTH message first.",
    });
    return;
  }

  // Authenticated message routing
  switch (msg.type) {
    case "SUBSCRIBE_MISSION":
      await handleSubscribeMission(ws, msg.missionId);
      break;

    case "UNSUBSCRIBE_MISSION":
      handleUnsubscribeMission(ws, msg.missionId);
      break;

    case "PING":
      send(ws, { type: "PONG" });
      break;

    default:
      // Unknown type — send error but keep connection open
      send(ws, {
        type: "ERROR",
        code: 4004,
        message: `Protocol error: unknown message type '${(msg as any).type}'.`,
      });
  }
}

// Client requests to join a mission tracking room.
// Access rules (mirrors tracking.service.ts assertTrackingReadAccess):
//   ADMIN / SUPERADMIN        -> any mission
//   VOLUNTEER (assigned)      -> missions they are currently assigned to
//   VOLUNTEER (COORDINATOR/DIRECTOR) -> any mission in their agency
//   CIVILIAN                  -> denied always

async function handleSubscribeMission(
  ws: AuthenticatedWs,
  missionId: string,
): Promise<void> {
  const { sub: userId, role } = ws.user!;

  // 1. Mission exists
  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    select: { id: true, status: true, agencyId: true },
  });

  if (!mission) {
    send(ws, { type: "ERROR", code: 4006, message: "Mission not found." });
    return;
  }

  // 2. Civilian — always forbidden
  if (role === "CIVILIAN") {
    send(ws, { type: "ERROR", code: 4007, message: "Mission access denied." });
    return;
  }

  // 3. ADMIN / SUPERADMIN — unrestricted
  if (role === "ADMIN" || role === "SUPERADMIN") {
    joinRoom(`mission:${missionId}`, ws);
    send(ws, { type: "SUBSCRIBED", missionId });
    return;
  }

  // 4. VOLUNTEER — check direct assignment OR agency staff role
  if (role === "VOLUNTEER") {
    const [assignment, agencyMembership] = await Promise.all([
      // Directly assigned to this mission
      prisma.missionAssignment.findFirst({
        where: { missionId, assignedTo: userId, unassignedAt: null },
      }),
      // Coordinator or Director of the agency that owns this mission
      mission.agencyId
        ? prisma.agencyMember.findFirst({
            where: {
              userId,
              agencyId: mission.agencyId,
              role: { in: [AgencyRole.COORDINATOR, AgencyRole.DIRECTOR] },
            },
          })
        : Promise.resolve(null),
    ]);

    if (!assignment && !agencyMembership) {
      send(ws, {
        type: "ERROR",
        code: 4007,
        message: "Mission access denied.",
      });
      return;
    }

    joinRoom(`mission:${missionId}`, ws);
    send(ws, { type: "SUBSCRIBED", missionId });
    return;
  }

  // Catch-all — unknown role
  send(ws, { type: "ERROR", code: 4002, message: "Forbidden." });
}

// Client explicitly leaves a mission tracking room.
// No access check needed — if they're not in the room, leaveRoom is a no-op.

function handleUnsubscribeMission(
  ws: AuthenticatedWs,
  missionId: string,
): void {
  leaveRoom(`mission:${missionId}`, ws);
  send(ws, { type: "UNSUBSCRIBED", missionId });
}
