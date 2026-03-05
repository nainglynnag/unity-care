import { prisma } from "../lib/prisma";
import {
  MissionStatus,
  MissionAction,
  MissionPriority,
  MissionRole,
  IncidentStatus,
  NotificationType,
} from "../../generated/prisma/client";
import { isSuperAdmin } from "../middlewares/auth.middleware";
import {
  ForbiddenError,
  MissionNotFoundError,
  IncidentNotFoundError,
  IncidentNotVerifiedError,
  LinkedIncidentInvalidError,
  VolunteersNotAvailableError,
  VolunteersNotInAgencyError,
  InvalidMissionTransitionError,
  MissionNotActionableError,
  NotMissionLeaderError,
  IncidentNotResolvableError,
} from "../utils/errors";
import type {
  CreateMissionInput,
  RejectMissionInput,
  AgencyDecisionInput,
  StartTravelInput,
  ArriveOnSiteInput,
  StartWorkInput,
  SubmitCompletionReportInput,
  ConfirmCompletionInput,
  CancelMissionInput,
  ReportFailureInput,
  ResolveIncidentInput,
  ListMissionsQuery,
} from "../validators/mission.validator";
import {
  broadcastNotification,
  broadcastMissionTerminal,
} from "../ws/broadcast";

// Private helpers

// Strict state machine. Each key is the CURRENT status. Values are allowed target statuses. Terminal states (CLOSED, CANCELLED, FAILED) have no exits.
const MISSION_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  CREATED: [MissionStatus.ASSIGNED, MissionStatus.CANCELLED],
  ASSIGNED: [
    MissionStatus.ACCEPTED,
    MissionStatus.FAILED,
    MissionStatus.CANCELLED,
  ],
  ACCEPTED: [MissionStatus.EN_ROUTE, MissionStatus.CANCELLED],
  EN_ROUTE: [
    MissionStatus.ON_SITE,
    MissionStatus.FAILED,
    MissionStatus.CANCELLED,
  ],
  ON_SITE: [
    MissionStatus.IN_PROGRESS,
    MissionStatus.COMPLETED,
    MissionStatus.FAILED,
    MissionStatus.CANCELLED,
  ],
  IN_PROGRESS: [
    MissionStatus.COMPLETED,
    MissionStatus.FAILED,
    MissionStatus.CANCELLED,
  ],
  COMPLETED: [MissionStatus.CLOSED, MissionStatus.ASSIGNED],
  FAILED: [],
  CANCELLED: [],
  CLOSED: [],
};

function assertTransition(current: MissionStatus, next: MissionStatus): void {
  if (!MISSION_TRANSITIONS[current]?.includes(next)) {
    throw new InvalidMissionTransitionError(current, next);
  }
}

/**
 * Resolves coordinator-level authority: returns agencyId for COORDINATOR/DIRECTOR,
 * null for SUPERADMIN. Used by createMission, assignVolunteers, etc. MEMBER has
 * no coordinator authority, so they get ForbiddenError — the frontend uses
 * listAssignedMissions for MEMBER and hides History/Team from them.
 */
async function resolveCoordinatorAuthority(
  requesterId: string,
  requesterRole: string,
): Promise<string | null> {
  if (isSuperAdmin(requesterRole)) return null;
  if (requesterRole !== "VOLUNTEER") throw new ForbiddenError();

  const membership = await prisma.agencyMember.findFirst({
    where: {
      userId: requesterId,
      role: { in: ["COORDINATOR", "DIRECTOR"] },
    },
    select: { agencyId: true },
  });
  if (!membership) throw new ForbiddenError();
  return membership.agencyId;
}

// Collects unique reporters across primary + all linked incidents.
// Called inside $transaction so notifications are atomic.
// Returns the reporter userIds so callers can broadcast after tx commits.
async function notifyAllReporters(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  missionId: string,
  primaryIncidentId: string,
  linkedIncidentIds: string[],
  type: NotificationType,
  title: string,
  message: string,
): Promise<string[]> {
  const allIds = [primaryIncidentId, ...linkedIncidentIds];
  const incidents = await tx.incident.findMany({
    where: { id: { in: allIds } },
    select: { reportedBy: true },
  });

  // Filter null reporterIds (reporter hard-deleted) to avoid creating
  // notifications with userId: null.
  const uniqueReporterIds = [
    ...new Set(
      incidents
        .map((i) => i.reportedBy)
        .filter((id): id is string => id !== null),
    ),
  ];

  if (uniqueReporterIds.length === 0) return [];

  await tx.notification.createMany({
    data: uniqueReporterIds.map((userId) => ({
      userId,
      type,
      title,
      message,
      referenceType: "MISSION",
      referenceId: missionId,
      isRead: false,
    })),
  });

  return uniqueReporterIds;
}

// WS broadcast helper. Sends a simplified notification payload to each user's
// personal WS room after a transaction commits. id is empty because createMany
// does not return individual rows — the client uses referenceType + referenceId
// to deduplicate and fetches full data via REST if needed.
function broadcastNotificationsToUsers(
  userIds: string[],
  type: string,
  title: string,
  message: string,
  referenceType: string,
  referenceId: string,
): void {
  const now = new Date();
  for (const userId of userIds) {
    broadcastNotification(userId, {
      id: "",
      type,
      title,
      message,
      referenceType,
      referenceId,
      isRead: false,
      createdAt: now,
    });
  }
}

/**
 * Shared fetch + access control for mission detail. ADMIN/SUPERADMIN see any
 * mission; COORDINATOR/DIRECTOR see missions for their agency; MEMBER only
 * sees missions they are personally assigned to (so they can view mission
 * detail when they have an assignment but cannot browse agency-wide).
 */
async function getMissionWithAuthCheck(
  missionId: string,
  requesterId: string,
  requesterRole: string,
) {
  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    include: {
      primaryIncident: {
        select: {
          id: true,
          title: true,
          status: true,
          latitude: true,
          longitude: true,
          addressText: true,
          description: true,
          category: { select: { id: true, name: true } },
        },
      },
      linkedIncidents: {
        include: {
          incident: {
            select: { id: true, title: true, status: true },
          },
        },
      },
      assignments: {
        where: { unassignedAt: null },
        include: {
          assignee: { select: { id: true, name: true } },
        },
      },
      agency: { select: { id: true, name: true } },
      logs: {
        include: { actor: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" as const },
      },
      report: true,
      tracking: {
        orderBy: { recordedAt: "desc" as const },
        take: 50,
        include: { volunteer: { select: { id: true, name: true } } },
      },
    },
  });

  if (!mission) throw new MissionNotFoundError();

  if (requesterRole === "SUPERADMIN" || requesterRole === "ADMIN") {
    return mission;
  }

  if (requesterRole === "VOLUNTEER") {
    const membership = await prisma.agencyMember.findFirst({
      where: { userId: requesterId },
      select: { agencyId: true, role: true },
    });

    // COORDINATOR/DIRECTOR: can see any mission for their agency
    if (membership && ["COORDINATOR", "DIRECTOR"].includes(membership.role)) {
      if (mission.agencyId && mission.agencyId !== membership.agencyId) {
        throw new MissionNotFoundError();
      }
      return mission;
    }

    // MEMBER: only missions they are personally assigned to (no agency-wide view)
    const isAssigned = mission.assignments.some(
      (a) => a.assignedTo === requesterId,
    );
    if (!isAssigned) throw new MissionNotFoundError();
    return mission;
  }

  throw new MissionNotFoundError();
}

// Helper to collect all linked incident IDs for a mission.
function getLinkedIds(
  mission: Awaited<ReturnType<typeof getMissionWithAuthCheck>>,
): string[] {
  return mission.linkedIncidents.map((l) => l.incidentId);
}

// Public service functions ──────────────────────────────────────────────

// createMission
export async function createMission(
  creatorId: string,
  creatorRole: string,
  data: CreateMissionInput,
) {
  // 1. Authority
  const agencyId = await resolveCoordinatorAuthority(creatorId, creatorRole);

  // 2. Validate primary incident
  const primaryIncident = await prisma.incident.findFirst({
    where: { id: data.primaryIncidentId, deletedAt: null },
    select: { id: true, title: true, status: true },
  });
  if (!primaryIncident) throw new IncidentNotFoundError();
  if (primaryIncident.status !== IncidentStatus.VERIFIED) {
    throw new IncidentNotVerifiedError();
  }

  // 3. Validate linked incidents
  const linkedIncidentIds = data.linkedIncidentIds ?? [];

  if (linkedIncidentIds.length > 0) {
    const linkable = await prisma.incident.findMany({
      where: {
        id: { in: linkedIncidentIds },
        deletedAt: null,
        status: {
          notIn: [IncidentStatus.CLOSED, IncidentStatus.FALSE_REPORT],
        },
      },
      select: { id: true },
    });

    const foundIds = new Set(linkable.map((i) => i.id));
    const invalidIds = linkedIncidentIds.filter((id) => !foundIds.has(id));
    if (invalidIds.length > 0) throw new LinkedIncidentInvalidError(invalidIds);
  }

  // 4. Validate volunteers
  const volunteerIds = data.volunteers.map((v) => v.volunteerId);

  const availableProfiles = await prisma.volunteerProfile.findMany({
    where: { userId: { in: volunteerIds }, isAvailable: true },
    select: { userId: true },
  });
  const availableSet = new Set(availableProfiles.map((p) => p.userId));
  const unavailable = volunteerIds.filter((id) => !availableSet.has(id));
  if (unavailable.length > 0)
    throw new VolunteersNotAvailableError(unavailable);

  if (agencyId) {
    const members = await prisma.agencyMember.findMany({
      where: { userId: { in: volunteerIds }, agencyId },
      select: { userId: true },
    });
    const memberSet = new Set(members.map((m) => m.userId));
    const notInAgency = volunteerIds.filter((id) => !memberSet.has(id));
    if (notInAgency.length > 0)
      throw new VolunteersNotInAgencyError(notInAgency);
  }

  // 5. Atomic transaction
  const result = await prisma.$transaction(async (tx) => {
    // 5a. Create Mission — status ASSIGNED (never stays CREATED externally)
    const mission = await tx.mission.create({
      data: {
        primaryIncidentId: data.primaryIncidentId,
        createdBy: creatorId,
        agencyId: agencyId ?? undefined,
        missionType: data.missionType,
        priority: data.priority as MissionPriority,
        status: MissionStatus.ASSIGNED,
      },
    });

    // 5b. Link duplicate incident reports
    if (linkedIncidentIds.length > 0) {
      await tx.missionIncident.createMany({
        data: linkedIncidentIds.map((incidentId) => ({
          missionId: mission.id,
          incidentId,
          linkedBy: creatorId,
        })),
      });
    }

    // 5c. Assign team
    await tx.missionAssignment.createMany({
      data: data.volunteers.map((v) => ({
        missionId: mission.id,
        assignedTo: v.volunteerId,
        assignedBy: creatorId,
        role: v.role as MissionRole,
      })),
    });

    // 5d. Audit logs
    const leader = data.volunteers.find((v) => v.role === "LEADER")!;
    await tx.missionLog.createMany({
      data: [
        {
          missionId: mission.id,
          actorId: creatorId,
          action: MissionAction.CREATED,
          note: `Mission created for: "${primaryIncident.title}".`,
        },
        {
          missionId: mission.id,
          actorId: creatorId,
          action: MissionAction.ASSIGNED,
          note: `Team of ${data.volunteers.length} assigned. Leader: ${leader.volunteerId}.`,
        },
      ],
    });

    // 5e. Notify each assigned volunteer
    await tx.notification.createMany({
      data: data.volunteers.map((v) => ({
        userId: v.volunteerId,
        type: NotificationType.MISSION_ASSIGNED,
        title: "Mission Assigned",
        message: `You have been assigned as ${v.role} for mission responding to: "${primaryIncident.title}". Please accept or reject.`,
        referenceType: "MISSION",
        referenceId: mission.id,
        isRead: false,
      })),
    });

    // 5f. Notify all reporters (primary + linked) — deduped
    const reporterIds = await notifyAllReporters(
      tx,
      mission.id,
      data.primaryIncidentId,
      linkedIncidentIds,
      NotificationType.MISSION_CREATED,
      "Help Is On The Way",
      `A volunteer team has been dispatched to assist with your reported incident: "${primaryIncident.title}".`,
    );

    // 5g. Return with full relations + reporter IDs for WS broadcast
    const fullMission = await tx.mission.findUniqueOrThrow({
      where: { id: mission.id },
      include: {
        primaryIncident: {
          select: {
            id: true,
            title: true,
            status: true,
            latitude: true,
            longitude: true,
          },
        },
        linkedIncidents: {
          include: {
            incident: {
              select: { id: true, title: true, status: true },
            },
          },
        },
        assignments: {
          include: {
            assignee: { select: { id: true, name: true } },
          },
        },
        agency: { select: { id: true, name: true } },
        logs: { orderBy: { createdAt: "asc" } },
      },
    });

    return { fullMission, reporterIds };
  }, { timeout: 15000 });

  // WS broadcasts (after transaction committed)
  broadcastNotificationsToUsers(
    volunteerIds,
    NotificationType.MISSION_ASSIGNED,
    "Mission Assigned",
    `You have been assigned for mission responding to: "${primaryIncident.title}".`,
    "MISSION",
    result.fullMission.id,
  );
  broadcastNotificationsToUsers(
    result.reporterIds,
    NotificationType.MISSION_CREATED,
    "Help Is On The Way",
    `A volunteer team has been dispatched to assist with your reported incident: "${primaryIncident.title}".`,
    "MISSION",
    result.fullMission.id,
  );

  return result.fullMission;
}

// acceptMission — UC-V-05
export async function acceptMission(
  missionId: string,
  requesterId: string,
  requesterRole: string,
) {
  const mission = await getMissionWithAuthCheck(
    missionId,
    requesterId,
    requesterRole,
  );

  assertTransition(mission.status as MissionStatus, MissionStatus.ACCEPTED);

  const assignment = mission.assignments.find(
    (a) => a.assignedTo === requesterId,
  );
  if (!assignment) throw new ForbiddenError();

  let coordinatorIds: string[] = [];

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.mission.update({
      where: { id: missionId },
      data: {
        status: MissionStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    });

    await tx.missionLog.create({
      data: {
        missionId,
        actorId: requesterId,
        action: MissionAction.ACCEPTED,
        note: "Volunteer accepted the mission.",
      },
    });

    if (mission.agencyId) {
      const coordinators = await tx.agencyMember.findMany({
        where: {
          agencyId: mission.agencyId,
          role: { in: ["COORDINATOR", "DIRECTOR"] },
        },
        select: { userId: true },
      });
      coordinatorIds = coordinators.map((c) => c.userId);
      await tx.notification.createMany({
        data: coordinators.map((c) => ({
          userId: c.userId,
          type: NotificationType.MISSION_ACCEPTED,
          title: "Mission Accepted",
          message: `A volunteer accepted the mission for: "${mission.primaryIncident.title}".`,
          referenceType: "MISSION",
          referenceId: missionId,
          isRead: false,
        })),
      });
    }

    return result;
  });

  // WS broadcast (after transaction committed)
  broadcastNotificationsToUsers(
    coordinatorIds,
    NotificationType.MISSION_ACCEPTED,
    "Mission Accepted",
    `A volunteer accepted the mission for: "${mission.primaryIncident.title}".`,
    "MISSION",
    missionId,
  );

  return updated;
}

// rejectMission — UC-V-05 alternate flow
// Volunteer rejects → mission stays ASSIGNED, REJECTED logged, coordinator notified.
export async function rejectMission(
  missionId: string,
  requesterId: string,
  requesterRole: string,
  data: RejectMissionInput,
) {
  const mission = await getMissionWithAuthCheck(
    missionId,
    requesterId,
    requesterRole,
  );

  if (mission.status !== MissionStatus.ASSIGNED) {
    throw new MissionNotActionableError("rejectMission", mission.status);
  }

  const assignment = mission.assignments.find(
    (a) => a.assignedTo === requesterId,
  );
  if (!assignment) throw new ForbiddenError();

  let coordinatorIds: string[] = [];

  const result = await prisma.$transaction(async (tx) => {
    await tx.missionLog.create({
      data: {
        missionId,
        actorId: requesterId,
        action: MissionAction.REJECTED,
        note: data.note,
      },
    });

    if (mission.agencyId) {
      const coordinators = await tx.agencyMember.findMany({
        where: {
          agencyId: mission.agencyId,
          role: { in: ["COORDINATOR", "DIRECTOR"] },
        },
        select: { userId: true },
      });
      coordinatorIds = coordinators.map((c) => c.userId);
      await tx.notification.createMany({
        data: coordinators.map((c) => ({
          userId: c.userId,
          type: NotificationType.MISSION_REJECTED,
          title: "Mission Rejected — Action Required",
          message: `A volunteer rejected the mission for: "${mission.primaryIncident.title}". Please reassign or close the mission.`,
          referenceType: "MISSION",
          referenceId: missionId,
          isRead: false,
        })),
      });
    }

    return tx.mission.findUniqueOrThrow({ where: { id: missionId } });
  });

  // WS broadcast (after transaction committed)
  broadcastNotificationsToUsers(
    coordinatorIds,
    NotificationType.MISSION_REJECTED,
    "Mission Rejected — Action Required",
    `A volunteer rejected the mission for: "${mission.primaryIncident.title}". Please reassign or close the mission.`,
    "MISSION",
    missionId,
  );

  return result;
}

// agencyDecision — COORDINATOR response to volunteer rejection
export async function agencyDecision(
  missionId: string,
  requesterId: string,
  requesterRole: string,
  data: AgencyDecisionInput,
) {
  const agencyId = await resolveCoordinatorAuthority(
    requesterId,
    requesterRole,
  );
  const mission = await getMissionWithAuthCheck(
    missionId,
    requesterId,
    requesterRole,
  );

  // Must be ASSIGNED with a REJECTED log entry
  if (mission.status !== MissionStatus.ASSIGNED) {
    throw new MissionNotActionableError("agencyDecision", mission.status);
  }

  const rejectedLog = await prisma.missionLog.findFirst({
    where: { missionId, action: MissionAction.REJECTED },
    orderBy: { createdAt: "desc" },
  });
  if (!rejectedLog) {
    throw new MissionNotActionableError("agencyDecision", mission.status);
  }

  let reporterIds: string[] = [];
  let isFailed = false;
  let newVolunteerIdForBroadcast: string | null = null;

  const result = await prisma.$transaction(async (tx) => {
    if (data.decision === "FAIL") {
      assertTransition(mission.status as MissionStatus, MissionStatus.FAILED);

      const updated = await tx.mission.update({
        where: { id: missionId },
        data: { status: MissionStatus.FAILED },
      });

      await tx.missionLog.create({
        data: {
          missionId,
          actorId: requesterId,
          action: MissionAction.FAILED,
          note: data.note ?? "Agency closed mission after volunteer rejection.",
        },
      });

      const linkedIds = getLinkedIds(mission);
      reporterIds = await notifyAllReporters(
        tx,
        missionId,
        mission.primaryIncident.id,
        linkedIds,
        NotificationType.MISSION_FAILED,
        "Mission Could Not Be Completed",
        `We were unable to dispatch a team for: "${mission.primaryIncident.title}". The agency has been notified.`,
      );

      isFailed = true;
      return updated;
    }

    // CONTINUE -> reassign to new volunteer
    const newVolunteerId = data.volunteerId!;

    const profile = await tx.volunteerProfile.findUnique({
      where: { userId: newVolunteerId },
      select: { isAvailable: true },
    });
    if (!profile?.isAvailable)
      throw new VolunteersNotAvailableError([newVolunteerId]);

    if (agencyId) {
      const membership = await tx.agencyMember.findFirst({
        where: { userId: newVolunteerId, agencyId },
      });
      if (!membership) throw new VolunteersNotInAgencyError([newVolunteerId]);
    }

    // Soft-unassign existing volunteers
    await tx.missionAssignment.updateMany({
      where: { missionId, unassignedAt: null },
      data: { unassignedAt: new Date() },
    });

    // Create new assignment as LEADER
    await tx.missionAssignment.create({
      data: {
        missionId,
        assignedTo: newVolunteerId,
        assignedBy: requesterId,
        role: MissionRole.LEADER,
      },
    });

    await tx.missionLog.create({
      data: {
        missionId,
        actorId: requesterId,
        action: MissionAction.REASSIGNED,
        note:
          data.note ?? "Mission reassigned to new volunteer after rejection.",
      },
    });

    await tx.notification.create({
      data: {
        userId: newVolunteerId,
        type: NotificationType.MISSION_ASSIGNED,
        title: "Mission Assigned",
        message: `You have been assigned to a mission for: "${mission.primaryIncident.title}". Please accept or reject.`,
        referenceType: "MISSION",
        referenceId: missionId,
        isRead: false,
      },
    });

    newVolunteerIdForBroadcast = newVolunteerId;
    return tx.mission.findUniqueOrThrow({ where: { id: missionId } });
  });

  // WS broadcasts (after transaction committed)
  if (isFailed) {
    broadcastNotificationsToUsers(
      reporterIds,
      NotificationType.MISSION_FAILED,
      "Mission Could Not Be Completed",
      `We were unable to dispatch a team for: "${mission.primaryIncident.title}". The agency has been notified.`,
      "MISSION",
      missionId,
    );
    broadcastMissionTerminal(missionId);
  } else if (newVolunteerIdForBroadcast) {
    broadcastNotificationsToUsers(
      [newVolunteerIdForBroadcast],
      NotificationType.MISSION_ASSIGNED,
      "Mission Assigned",
      `You have been assigned to a mission for: "${mission.primaryIncident.title}". Please accept or reject.`,
      "MISSION",
      missionId,
    );
  }

  return result;
}

// startTravel
export async function startTravel(
  missionId: string,
  requesterId: string,
  requesterRole: string,
  data: StartTravelInput,
) {
  const mission = await getMissionWithAuthCheck(
    missionId,
    requesterId,
    requesterRole,
  );

  assertTransition(mission.status as MissionStatus, MissionStatus.EN_ROUTE);

  const isLeader = mission.assignments.some(
    (a) => a.assignedTo === requesterId && a.role === MissionRole.LEADER,
  );
  if (!isLeader) throw new NotMissionLeaderError();

  let reporterIds: string[] = [];

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.mission.update({
      where: { id: missionId },
      data: { status: MissionStatus.EN_ROUTE },
    });

    // GPS tracking — departure location
    await tx.missionTracking.create({
      data: {
        missionId,
        volunteerId: requesterId,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });

    await tx.missionLog.create({
      data: {
        missionId,
        actorId: requesterId,
        action: MissionAction.EN_ROUTE,
        note: `Team is en route to the incident location. GPS: (${data.latitude}, ${data.longitude}).`,
      },
    });

    const linkedIds = getLinkedIds(mission);
    reporterIds = await notifyAllReporters(
      tx,
      missionId,
      mission.primaryIncident.id,
      linkedIds,
      NotificationType.MISSION_EN_ROUTE,
      "Volunteers Are On Their Way",
      `A volunteer team is now en route to your incident: "${mission.primaryIncident.title}".`,
    );

    return result;
  });

  // WS broadcast (after transaction committed)
  broadcastNotificationsToUsers(
    reporterIds,
    NotificationType.MISSION_EN_ROUTE,
    "Volunteers Are On Their Way",
    `A volunteer team is now en route to your incident: "${mission.primaryIncident.title}".`,
    "MISSION",
    missionId,
  );

  return updated;
}

// arriveOnSite
export async function arriveOnSite(
  missionId: string,
  requesterId: string,
  requesterRole: string,
  data: ArriveOnSiteInput,
) {
  const mission = await getMissionWithAuthCheck(
    missionId,
    requesterId,
    requesterRole,
  );

  assertTransition(mission.status as MissionStatus, MissionStatus.ON_SITE);

  const isLeader = mission.assignments.some(
    (a) => a.assignedTo === requesterId && a.role === MissionRole.LEADER,
  );
  if (!isLeader) throw new NotMissionLeaderError();

  let reporterIds: string[] = [];

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.mission.update({
      where: { id: missionId },
      data: { status: MissionStatus.ON_SITE, onSiteAt: new Date() },
    });

    // GPS tracking — arrival location
    await tx.missionTracking.create({
      data: {
        missionId,
        volunteerId: requesterId,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });

    await tx.missionLog.create({
      data: {
        missionId,
        actorId: requesterId,
        action: MissionAction.ON_SITE,
        note: `Team has arrived on site. GPS: (${data.latitude}, ${data.longitude}).`,
      },
    });

    const linkedIds = getLinkedIds(mission);
    reporterIds = await notifyAllReporters(
      tx,
      missionId,
      mission.primaryIncident.id,
      linkedIds,
      NotificationType.MISSION_ON_SITE,
      "Volunteers Have Arrived",
      `The volunteer team has arrived at the scene of your incident: "${mission.primaryIncident.title}".`,
    );

    return result;
  });

  // WS broadcast (after transaction committed)
  broadcastNotificationsToUsers(
    reporterIds,
    NotificationType.MISSION_ON_SITE,
    "Volunteers Have Arrived",
    `The volunteer team has arrived at the scene of your incident: "${mission.primaryIncident.title}".`,
    "MISSION",
    missionId,
  );

  return updated;
}

// startWork — (ON_SITE → IN_PROGRESS)
export async function startWork(
  missionId: string,
  requesterId: string,
  requesterRole: string,
  data: StartWorkInput,
) {
  const mission = await getMissionWithAuthCheck(
    missionId,
    requesterId,
    requesterRole,
  );

  assertTransition(mission.status as MissionStatus, MissionStatus.IN_PROGRESS);

  const isLeader = mission.assignments.some(
    (a) => a.assignedTo === requesterId && a.role === MissionRole.LEADER,
  );
  if (!isLeader) throw new NotMissionLeaderError();

  let reporterIds: string[] = [];

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.mission.update({
      where: { id: missionId },
      data: { status: MissionStatus.IN_PROGRESS },
    });

    // GPS tracking — work start location
    await tx.missionTracking.create({
      data: {
        missionId,
        volunteerId: requesterId,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });

    await tx.missionLog.create({
      data: {
        missionId,
        actorId: requesterId,
        action: MissionAction.STARTED,
        note: `Team has started working on the mission. GPS: (${data.latitude}, ${data.longitude}).`,
      },
    });

    const linkedIds = getLinkedIds(mission);
    reporterIds = await notifyAllReporters(
      tx,
      missionId,
      mission.primaryIncident.id,
      linkedIds,
      NotificationType.MISSION_IN_PROGRESS,
      "Volunteers Working on Your Case",
      `The volunteer team has started working on your incident: "${mission.primaryIncident.title}".`,
    );

    return result;
  });

  // WS broadcast (after transaction committed)
  broadcastNotificationsToUsers(
    reporterIds,
    NotificationType.MISSION_IN_PROGRESS,
    "Volunteers Working on Your Case",
    `The volunteer team has started working on your incident: "${mission.primaryIncident.title}".`,
    "MISSION",
    missionId,
  );

  return updated;
}

// submitCompletionReport
export async function submitCompletionReport(
  missionId: string,
  requesterId: string,
  requesterRole: string,
  data: SubmitCompletionReportInput,
) {
  const mission = await getMissionWithAuthCheck(
    missionId,
    requesterId,
    requesterRole,
  );

  assertTransition(mission.status as MissionStatus, MissionStatus.COMPLETED);

  const isLeader = mission.assignments.some(
    (a) => a.assignedTo === requesterId && a.role === MissionRole.LEADER,
  );
  if (!isLeader) throw new NotMissionLeaderError();

  let coordinatorIds: string[] = [];

  const updated = await prisma.$transaction(async (tx) => {
    await tx.missionReport.create({
      data: {
        missionId,
        submittedBy: requesterId,
        summary: data.summary,
        actionsTaken: data.actionsTaken,
        resourcesUsed: data.resourcesUsed,
        casualties: data.casualties,
        propertyDamage: data.propertyDamage,
      },
    });

    const result = await tx.mission.update({
      where: { id: missionId },
      data: {
        status: MissionStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    // GPS tracking — completion location
    await tx.missionTracking.create({
      data: {
        missionId,
        volunteerId: requesterId,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });

    await tx.missionLog.create({
      data: {
        missionId,
        actorId: requesterId,
        action: MissionAction.COMPLETED,
        note: `Completion report submitted. GPS: (${data.latitude}, ${data.longitude}). Awaiting coordinator confirmation.`,
      },
    });

    if (mission.agencyId) {
      const coordinators = await tx.agencyMember.findMany({
        where: {
          agencyId: mission.agencyId,
          role: { in: ["COORDINATOR", "DIRECTOR"] },
        },
        select: { userId: true },
      });
      coordinatorIds = coordinators.map((c) => c.userId);
      await tx.notification.createMany({
        data: coordinators.map((c) => ({
          userId: c.userId,
          type: NotificationType.MISSION_COMPLETED,
          title: "Mission Completion Report Submitted",
          message: `The LEADER has submitted a completion report for the mission on: "${mission.primaryIncident.title}". Please review and confirm or reject.`,
          referenceType: "MISSION",
          referenceId: missionId,
          isRead: false,
        })),
      });
    }

    return result;
  });

  // WS broadcast (after transaction committed)
  broadcastNotificationsToUsers(
    coordinatorIds,
    NotificationType.MISSION_COMPLETED,
    "Mission Completion Report Submitted",
    `The LEADER has submitted a completion report for the mission on: "${mission.primaryIncident.title}". Please review and confirm or reject.`,
    "MISSION",
    missionId,
  );

  return updated;
}

// confirmCompletion
export async function confirmCompletion(
  missionId: string,
  requesterId: string,
  requesterRole: string,
  data: ConfirmCompletionInput,
) {
  await resolveCoordinatorAuthority(requesterId, requesterRole);
  const mission = await getMissionWithAuthCheck(
    missionId,
    requesterId,
    requesterRole,
  );

  if (mission.status !== MissionStatus.COMPLETED) {
    throw new MissionNotActionableError("confirmCompletion", mission.status);
  }

  let reporterIds: string[] = [];
  let isClosed = false;

  const updated = await prisma.$transaction(async (tx) => {
    const linkedIds = getLinkedIds(mission);

    if (data.confirmed) {
      assertTransition(MissionStatus.COMPLETED, MissionStatus.CLOSED);

      const result = await tx.mission.update({
        where: { id: missionId },
        data: { status: MissionStatus.CLOSED, closedAt: new Date() },
      });

      await tx.missionLog.create({
        data: {
          missionId,
          actorId: requesterId,
          action: MissionAction.CLOSED,
          note: data.note ?? "Mission confirmed and closed by coordinator.",
        },
      });

      await tx.incident.update({
        where: { id: mission.primaryIncident.id },
        data: { status: IncidentStatus.RESOLVED },
      });

      reporterIds = await notifyAllReporters(
        tx,
        missionId,
        mission.primaryIncident.id,
        linkedIds,
        NotificationType.MISSION_CLOSED,
        "Mission Completed",
        `The volunteer team has successfully completed their mission for your incident: "${mission.primaryIncident.title}".`,
      );

      // Notify assigned volunteers that the mission is officially closed
      const volunteerIds = mission.assignments.map((a) => a.assignedTo);
      if (volunteerIds.length > 0) {
        await tx.notification.createMany({
          data: volunteerIds.map((vid) => ({
            userId: vid,
            type: NotificationType.MISSION_CLOSED,
            title: "Mission Closed \u2014 Thank You",
            message: `The mission for "${mission.primaryIncident.title}" has been confirmed and closed. Thank you for your service.`,
            referenceType: "MISSION",
            referenceId: missionId,
            isRead: false,
          })),
        });
      }

      isClosed = true;
      return result;
    } else {
      // Rejected -> back to ASSIGNED (more work needed)
      assertTransition(MissionStatus.COMPLETED, MissionStatus.ASSIGNED);

      const result = await tx.mission.update({
        where: { id: missionId },
        data: { status: MissionStatus.ASSIGNED, completedAt: null },
      });

      await tx.missionLog.create({
        data: {
          missionId,
          actorId: requesterId,
          action: MissionAction.REASSIGNED,
          note: data.note!,
        },
      });

      const assignedVolunteerIds = mission.assignments.map((a) => a.assignedTo);
      await tx.notification.createMany({
        data: assignedVolunteerIds.map((vid) => ({
          userId: vid,
          type: NotificationType.MISSION_ASSIGNED,
          title: "Completion Report Rejected",
          message: `Your completion report for the mission on: "${mission.primaryIncident.title}" was not accepted. Reason: ${data.note}. Please continue the mission.`,
          referenceType: "MISSION",
          referenceId: missionId,
          isRead: false,
        })),
      });

      return result;
    }
  });

  // WS broadcasts (after transaction committed)
  if (isClosed) {
    broadcastNotificationsToUsers(
      reporterIds,
      NotificationType.MISSION_CLOSED,
      "Mission Completed",
      `The volunteer team has successfully completed their mission for your incident: "${mission.primaryIncident.title}".`,
      "MISSION",
      missionId,
    );
    // Notify assigned volunteers that the mission is officially closed
    const assignedVolunteerIds = mission.assignments.map((a) => a.assignedTo);
    broadcastNotificationsToUsers(
      assignedVolunteerIds,
      NotificationType.MISSION_CLOSED,
      "Mission Closed — Thank You",
      `The mission for "${mission.primaryIncident.title}" has been confirmed and closed. Thank you for your service.`,
      "MISSION",
      missionId,
    );
    broadcastMissionTerminal(missionId);
  } else {
    const assignedVolunteerIds = mission.assignments.map((a) => a.assignedTo);
    broadcastNotificationsToUsers(
      assignedVolunteerIds,
      NotificationType.MISSION_ASSIGNED,
      "Completion Report Rejected",
      `Your completion report for the mission on: "${mission.primaryIncident.title}" was not accepted. Reason: ${data.note}. Please continue the mission.`,
      "MISSION",
      missionId,
    );
  }

  return updated;
}

// cancelMission — COORDINATOR/DIRECTOR/SUPERADMIN cancels an active mission
export async function cancelMission(
  missionId: string,
  requesterId: string,
  requesterRole: string,
  data: CancelMissionInput,
) {
  await resolveCoordinatorAuthority(requesterId, requesterRole);
  const mission = await getMissionWithAuthCheck(
    missionId,
    requesterId,
    requesterRole,
  );

  assertTransition(mission.status as MissionStatus, MissionStatus.CANCELLED);

  let reporterIds: string[] = [];

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.mission.update({
      where: { id: missionId },
      data: { status: MissionStatus.CANCELLED },
    });

    await tx.missionLog.create({
      data: {
        missionId,
        actorId: requesterId,
        action: MissionAction.CANCELLED,
        note: data.note,
      },
    });

    // Notify assigned volunteers
    const assignedVolunteerIds = mission.assignments.map((a) => a.assignedTo);
    if (assignedVolunteerIds.length > 0) {
      await tx.notification.createMany({
        data: assignedVolunteerIds.map((vid) => ({
          userId: vid,
          type: NotificationType.MISSION_FAILED,
          title: "Mission Cancelled",
          message: `The mission for: "${mission.primaryIncident.title}" has been cancelled. Reason: ${data.note}`,
          referenceType: "MISSION",
          referenceId: missionId,
          isRead: false,
        })),
      });
    }

    // Notify reporters
    const linkedIds = getLinkedIds(mission);
    reporterIds = await notifyAllReporters(
      tx,
      missionId,
      mission.primaryIncident.id,
      linkedIds,
      NotificationType.MISSION_FAILED,
      "Mission Cancelled",
      `The mission responding to your incident: "${mission.primaryIncident.title}" has been cancelled.`,
    );

    return result;
  });

  // WS broadcasts (after transaction committed)
  const assignedVolunteerIds = mission.assignments.map((a) => a.assignedTo);
  broadcastNotificationsToUsers(
    assignedVolunteerIds,
    NotificationType.MISSION_FAILED,
    "Mission Cancelled",
    `The mission for: "${mission.primaryIncident.title}" has been cancelled. Reason: ${data.note}`,
    "MISSION",
    missionId,
  );
  broadcastNotificationsToUsers(
    reporterIds,
    NotificationType.MISSION_FAILED,
    "Mission Cancelled",
    `The mission responding to your incident: "${mission.primaryIncident.title}" has been cancelled.`,
    "MISSION",
    missionId,
  );
  broadcastMissionTerminal(missionId);

  return updated;
}

// reportFailure — Volunteer or COORDINATOR reports site inaccessible / mission failed
export async function reportFailure(
  missionId: string,
  requesterId: string,
  requesterRole: string,
  data: ReportFailureInput,
) {
  const mission = await getMissionWithAuthCheck(
    missionId,
    requesterId,
    requesterRole,
  );

  assertTransition(mission.status as MissionStatus, MissionStatus.FAILED);

  let coordinatorIds: string[] = [];
  let reporterIds: string[] = [];

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.mission.update({
      where: { id: missionId },
      data: { status: MissionStatus.FAILED },
    });

    // GPS tracking — failure location (optional; coordinator may report remotely)
    if (data.latitude !== undefined && data.longitude !== undefined) {
      await tx.missionTracking.create({
        data: {
          missionId,
          volunteerId: requesterId,
          latitude: data.latitude,
          longitude: data.longitude,
        },
      });
    }

    await tx.missionLog.create({
      data: {
        missionId,
        actorId: requesterId,
        action: MissionAction.FAILED,
        note:
          data.latitude !== undefined
            ? `${data.reason} GPS: (${data.latitude}, ${data.longitude}).`
            : data.reason,
      },
    });

    // Notify agency coordinators
    if (mission.agencyId) {
      const coordinators = await tx.agencyMember.findMany({
        where: {
          agencyId: mission.agencyId,
          role: { in: ["COORDINATOR", "DIRECTOR"] },
        },
        select: { userId: true },
      });
      coordinatorIds = coordinators.map((c) => c.userId);
      await tx.notification.createMany({
        data: coordinators.map((c) => ({
          userId: c.userId,
          type: NotificationType.MISSION_FAILED,
          title: "Mission Failed",
          message: `A mission for: "${mission.primaryIncident.title}" has been reported as failed. Reason: ${data.reason}`,
          referenceType: "MISSION",
          referenceId: missionId,
          isRead: false,
        })),
      });
    }

    // Notify reporters
    const linkedIds = getLinkedIds(mission);
    reporterIds = await notifyAllReporters(
      tx,
      missionId,
      mission.primaryIncident.id,
      linkedIds,
      NotificationType.MISSION_FAILED,
      "Mission Could Not Be Completed",
      `We were unable to complete the mission for your incident: "${mission.primaryIncident.title}". The agency has been notified.`,
    );

    return result;
  });

  // WS broadcasts (after transaction committed)
  broadcastNotificationsToUsers(
    coordinatorIds,
    NotificationType.MISSION_FAILED,
    "Mission Failed",
    `A mission for: "${mission.primaryIncident.title}" has been reported as failed. Reason: ${data.reason}`,
    "MISSION",
    missionId,
  );
  broadcastNotificationsToUsers(
    reporterIds,
    NotificationType.MISSION_FAILED,
    "Mission Could Not Be Completed",
    `We were unable to complete the mission for your incident: "${mission.primaryIncident.title}". The agency has been notified.`,
    "MISSION",
    missionId,
  );
  broadcastMissionTerminal(missionId);

  return updated;
}

// resolveIncident — explicit COORDINATOR/DIRECTOR action (VERIFIED → RESOLVED)
// Guards: ≥1 CLOSED mission AND zero active missions (primary + linked).
export async function resolveIncident(
  incidentId: string,
  requesterId: string,
  requesterRole: string,
  data: ResolveIncidentInput,
) {
  await resolveCoordinatorAuthority(requesterId, requesterRole);

  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, deletedAt: null },
    include: {
      missions: { select: { id: true, status: true } },
      linkedMissions: {
        include: {
          mission: { select: { id: true, status: true } },
        },
      },
    },
  });

  if (!incident) throw new IncidentNotFoundError();

  if (incident.status !== IncidentStatus.VERIFIED) {
    throw new IncidentNotResolvableError(
      `Incident must be VERIFIED to resolve. Current status: ${incident.status}.`,
    );
  }

  const TERMINAL_STATUSES: MissionStatus[] = [
    MissionStatus.CLOSED,
    MissionStatus.CANCELLED,
    MissionStatus.FAILED,
  ];

  // Collect all missions: primary + linked
  const allMissions = [
    ...incident.missions,
    ...incident.linkedMissions.map((lm) => lm.mission),
  ];

  // Deduplicate by mission id
  const uniqueMissions = [
    ...new Map(allMissions.map((m) => [m.id, m])).values(),
  ];

  const hasClosedMission = uniqueMissions.some(
    (m) => m.status === MissionStatus.CLOSED,
  );
  const hasActiveMission = uniqueMissions.some(
    (m) => !TERMINAL_STATUSES.includes(m.status as MissionStatus),
  );

  if (!hasClosedMission) {
    throw new IncidentNotResolvableError(
      "At least one mission must be CLOSED before resolving the incident.",
    );
  }

  if (hasActiveMission) {
    throw new IncidentNotResolvableError(
      "Cannot resolve incident while one or more missions are still active. " +
        "Close or cancel all active missions first.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.incident.update({
      where: { id: incidentId },
      data: { status: IncidentStatus.RESOLVED },
    });

    await tx.auditLog.create({
      data: {
        actorId: requesterId,
        action: "RESOLVE",
        entityType: "INCIDENT",
        entityId: incidentId,
        metadata: { note: data.note, resolvedBy: requesterId },
      },
    });

    // Notify the reporter that their incident has been fully resolved
    if (incident.reportedBy) {
      await tx.notification.create({
        data: {
          userId: incident.reportedBy,
          type: NotificationType.INCIDENT_STATUS_UPDATED,
          title: "Incident Resolved",
          message: `Your incident "${incident.title}" has been fully resolved. Thank you for reporting.`,
          referenceType: "INCIDENT",
          referenceId: incidentId,
          isRead: false,
        },
      });
    }

    // WS broadcast to reporter (inside tx, but tx commits immediately after)
    if (incident.reportedBy) {
      broadcastNotificationsToUsers(
        [incident.reportedBy],
        NotificationType.INCIDENT_STATUS_UPDATED,
        "Incident Resolved",
        `Your incident "${incident.title}" has been fully resolved. Thank you for reporting.`,
        "INCIDENT",
        incidentId,
      );
    }

    return updated;
  });
}

/**
 * List missions (agency-wide or filtered). Used by admin and by Volunteer
 * Mission History for COORDINATOR/DIRECTOR. MEMBER cannot call this — they get
 * 403. The frontend uses listAssignedMissions for MEMBER so they only see their
 * own assigned missions and History is hidden from MEMBER in the UI.
 */
export async function listMissions(
  requesterId: string,
  requesterRole: string,
  query: ListMissionsQuery,
) {
  const { status, priority, agencyId, incidentId, page, perPage } = query;
  const skip = (page - 1) * perPage;

  let scopedAgencyId: string | undefined;

  if (requesterRole === "SUPERADMIN" || requesterRole === "ADMIN") {
    scopedAgencyId = agencyId;
  } else if (requesterRole === "VOLUNTEER") {
    // Only COORDINATOR/DIRECTOR can list agency missions; MEMBER gets 403
    const membership = await prisma.agencyMember.findFirst({
      where: {
        userId: requesterId,
        role: { in: ["COORDINATOR", "DIRECTOR"] },
      },
      select: { agencyId: true },
    });
    if (!membership) throw new ForbiddenError();
    scopedAgencyId = membership.agencyId;
  } else {
    throw new ForbiddenError();
  }

  const where = {
    ...(scopedAgencyId && { agencyId: scopedAgencyId }),
    ...(status && { status }),
    ...(priority && { priority }),
    ...(incidentId && { primaryIncidentId: incidentId }),
  };

  const [missions, totalRecords] = await Promise.all([
    prisma.mission.findMany({
      where,
      include: {
        primaryIncident: {
          select: {
            id: true,
            title: true,
            status: true,
            latitude: true,
            longitude: true,
          },
        },
        agency: { select: { id: true, name: true } },
        assignments: {
          where: { unassignedAt: null },
          include: {
            assignee: { select: { id: true, name: true } },
          },
        },
        _count: { select: { linkedIncidents: true, logs: true } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      skip,
      take: perPage,
    }),
    prisma.mission.count({ where }),
  ]);

  return {
    missions,
    pagination: {
      totalRecords,
      totalPages: Math.ceil(totalRecords / perPage),
      currentPage: page,
      perPage,
    },
  };
}

/** Full mission detail; access scoped by role (COORDINATOR/DIRECTOR by agency, MEMBER only if assigned). */
export async function getMission(
  missionId: string,
  requesterId: string,
  requesterRole: string,
) {
  return getMissionWithAuthCheck(missionId, requesterId, requesterRole);
}

// listMyMissions — volunteer's own assigned missions
export async function listMyMissions(
  volunteerId: string,
  query: ListMissionsQuery,
) {
  const { status, page, perPage } = query;
  const skip = (page - 1) * perPage;

  const where = {
    assignments: {
      some: { assignedTo: volunteerId, unassignedAt: null },
    },
    ...(status && { status }),
  };

  const [missions, totalRecords] = await Promise.all([
    prisma.mission.findMany({
      where,
      include: {
        primaryIncident: {
          select: {
            id: true,
            title: true,
            status: true,
            latitude: true,
            longitude: true,
            addressText: true,
          },
        },
        agency: { select: { id: true, name: true } },
        assignments: {
          where: { unassignedAt: null },
          include: {
            assignee: { select: { id: true, name: true } },
          },
        },
        _count: { select: { linkedIncidents: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    prisma.mission.count({ where }),
  ]);

  return {
    missions,
    pagination: {
      totalRecords,
      totalPages: Math.ceil(totalRecords / perPage),
      currentPage: page,
      perPage,
    },
  };
}
