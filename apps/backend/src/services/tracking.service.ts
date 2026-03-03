import { prisma } from "../lib/prisma";
import { MissionStatus, AgencyRole } from "../../generated/prisma/client";
import {
  MissionNotFoundError,
  NotAssignedToMissionError,
  TrackingNotAllowedError,
  TrackingRateLimitError,
  ForbiddenError,
} from "../utils/errors";
import type {
  PushTrackingInput,
  GetTrackingQuery,
} from "../validators/tracking.validator";

// Statuses where GPS tracking pushes are accepted.
// ACCEPTED is excluded — volunteer hasn't started moving yet.
// COMPLETED/CLOSED/FAILED — mission is over.
const TRACKABLE_STATUSES: MissionStatus[] = [
  MissionStatus.EN_ROUTE,
  MissionStatus.ON_SITE,
  MissionStatus.IN_PROGRESS,
];

// Minimum milliseconds between GPS pushes per volunteer per mission.
// Enforced at service level (not just the HTTP rate limiter) so it
// always applies even if the rate limiter is bypassed.
const MIN_TRACKING_INTERVAL_MS = 15_000; // 15 seconds

// Volunteer pushes their current GPS position for an active mission.
// Guards:
//   1. Mission must exist
//   2. Volunteer must be currently assigned (unassignedAt IS NULL)
//   3. Mission must be in a trackable status
//   4. Minimum 15 seconds since last push (anti-flood)
export async function pushTracking(
  volunteerId: string,
  missionId: string,
  data: PushTrackingInput,
) {
  // 1. Mission exists
  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    select: { id: true, status: true },
  });
  if (!mission) throw new MissionNotFoundError();

  // 2. Volunteer is currently assigned
  const assignment = await prisma.missionAssignment.findFirst({
    where: {
      missionId,
      assignedTo: volunteerId,
      unassignedAt: null,
    },
  });
  if (!assignment) throw new NotAssignedToMissionError();

  // 3. Mission must be in a trackable status
  if (!TRACKABLE_STATUSES.includes(mission.status)) {
    throw new TrackingNotAllowedError();
  }

  // 4. Rate limit: check last push for this volunteer on this mission.
  // Uses the composite index (missionId, volunteerId, recordedAt).
  const lastPoint = await prisma.missionTracking.findFirst({
    where: { missionId, volunteerId },
    orderBy: { recordedAt: "desc" },
    select: { recordedAt: true },
  });

  if (lastPoint) {
    const msSinceLast = Date.now() - lastPoint.recordedAt.getTime();
    if (msSinceLast < MIN_TRACKING_INTERVAL_MS) {
      throw new TrackingRateLimitError();
    }
  }

  // Write the tracking point
  const point = await prisma.missionTracking.create({
    data: {
      missionId,
      volunteerId,
      latitude: data.latitude,
      longitude: data.longitude,
      recordedAt: data.recordedAt,
    },
  });

  // Side effect: update VolunteerProfile.lastKnownLatitude/Longitude
  // so the available-volunteers list always shows current position.
  await prisma.volunteerProfile.update({
    where: { userId: volunteerId },
    data: {
      lastKnownLatitude: data.latitude,
      lastKnownLongitude: data.longitude,
    },
  });

  return point;
}

// Returns GPS tracking points for a mission.
// Access rules:
//   VOLUNTEER: only if currently assigned OR agency staff (COORDINATOR/DIRECTOR)
//   ADMIN/SUPERADMIN: any mission
//   CIVILIAN: forbidden
export async function getTrackingHistory(
  requesterId: string,
  requesterRole: string,
  missionId: string,
  query: GetTrackingQuery,
) {
  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    select: { id: true, status: true, agencyId: true },
  });
  if (!mission) throw new MissionNotFoundError();

  await assertTrackingReadAccess(requesterId, requesterRole, mission);

  const { volunteerId, since, limit } = query;

  const points = await prisma.missionTracking.findMany({
    where: {
      missionId,
      ...(volunteerId && { volunteerId }),
      ...(since && { recordedAt: { gt: since } }),
    },
    orderBy: { recordedAt: "asc" }, // chronological for route rendering
    take: limit,
    select: {
      id: true,
      volunteerId: true,
      latitude: true,
      longitude: true,
      recordedAt: true,
    },
  });

  return {
    missionId,
    missionStatus: mission.status,
    points,
    count: points.length,
  };
}

// Returns only the most recent tracking point per assigned volunteer.
// Used by coordinator live map — no need to load full history.
// Uses PostgreSQL DISTINCT ON to avoid N+1 queries.
export async function getLatestTracking(
  requesterId: string,
  requesterRole: string,
  missionId: string,
) {
  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    select: { id: true, status: true, agencyId: true },
  });
  if (!mission) throw new MissionNotFoundError();

  await assertTrackingReadAccess(requesterId, requesterRole, mission);

  // Get current assignees for this mission
  const assignments = await prisma.missionAssignment.findMany({
    where: { missionId, unassignedAt: null },
    select: {
      assignedTo: true,
      role: true,
      assignee: { select: { id: true, name: true, profileImageUrl: true } },
    },
  });

  if (assignments.length === 0) {
    return { missionId, missionStatus: mission.status, volunteers: [] };
  }

  const assigneeIds = assignments.map((a) => a.assignedTo);

  // Single query using DISTINCT ON instead of N+1
  const latestPoints: Array<{
    volunteerId: string;
    latitude: number;
    longitude: number;
    recordedAt: Date;
  }> = await prisma.$queryRaw`
    SELECT DISTINCT ON ("volunteerId")
      "volunteerId", "latitude", "longitude", "recordedAt"
    FROM "MissionTracking"
    WHERE "missionId" = ${missionId}
      AND "volunteerId" = ANY(${assigneeIds})
    ORDER BY "volunteerId", "recordedAt" DESC
  `;

  // Index latest points by volunteerId for O(1) lookup
  const pointMap = new Map(latestPoints.map((p) => [p.volunteerId, p]));

  const volunteers = assignments.map((a) => {
    const point = pointMap.get(a.assignedTo);
    return {
      volunteerId: a.assignedTo,
      name: a.assignee.name,
      profileImageUrl: a.assignee.profileImageUrl,
      missionRole: a.role,
      lastPoint: point
        ? {
            latitude: point.latitude,
            longitude: point.longitude,
            recordedAt: point.recordedAt,
          }
        : null,
    };
  });

  return {
    missionId,
    missionStatus: mission.status,
    volunteers,
  };
}

// Centralised access control for both tracking read endpoints.
async function assertTrackingReadAccess(
  requesterId: string,
  requesterRole: string,
  mission: { id: string; agencyId: string | null },
): Promise<void> {
  if (requesterRole === "ADMIN" || requesterRole === "SUPERADMIN") return;

  if (requesterRole === "CIVILIAN") throw new ForbiddenError();

  // VOLUNTEER JWT role covers MEMBER, COORDINATOR, DIRECTOR
  if (requesterRole === "VOLUNTEER") {
    // Check if directly assigned to this mission
    const assignment = await prisma.missionAssignment.findFirst({
      where: {
        missionId: mission.id,
        assignedTo: requesterId,
        unassignedAt: null,
      },
    });
    if (assignment) return;

    // Check if agency staff for the mission's agency
    if (mission.agencyId) {
      const agencyMembership = await prisma.agencyMember.findFirst({
        where: {
          userId: requesterId,
          agencyId: mission.agencyId,
          role: { in: [AgencyRole.COORDINATOR, AgencyRole.DIRECTOR] },
        },
      });
      if (agencyMembership) return;
    }

    throw new ForbiddenError();
  }

  throw new ForbiddenError();
}
