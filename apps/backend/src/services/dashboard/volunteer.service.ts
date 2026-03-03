import { prisma } from "../../lib/prisma";
import { MissionStatus, MissionAction } from "../../../generated/prisma/client";
import {
  resolvePeriod,
  periodFilter,
  calcDelta,
  type Period,
} from "../../utils/period";

// Terminal statuses where time was spent (for hours served calculation)
const TERMINAL_STATUSES: MissionStatus[] = [
  MissionStatus.CLOSED,
  MissionStatus.FAILED,
  MissionStatus.CANCELLED,
];

// Active statuses (currently in progress)
const ACTIVE_STATUSES: MissionStatus[] = [
  MissionStatus.ASSIGNED,
  MissionStatus.ACCEPTED,
  MissionStatus.EN_ROUTE,
  MissionStatus.ON_SITE,
  MissionStatus.IN_PROGRESS,
];

// Resolve "end time" for a mission in a terminal state.
// CLOSED missions have closedAt (preferred) or completedAt.
// FAILED / CANCELLED missions have no timestamp on the Mission row,
// so we fall back to the MissionLog entry for the terminal action.
async function resolveEndTime(
  mission: {
    status: MissionStatus;
    acceptedAt: Date | null;
    completedAt: Date | null;
    closedAt: Date | null;
  },
  missionId: string,
): Promise<Date | null> {
  if (!mission.acceptedAt) return null;

  if (mission.status === MissionStatus.CLOSED) {
    return mission.closedAt ?? mission.completedAt ?? null;
  }

  // FAILED or CANCELLED — look up the terminal log entry
  const terminalAction =
    mission.status === MissionStatus.FAILED
      ? MissionAction.FAILED
      : MissionAction.CANCELLED;

  const log = await prisma.missionLog.findFirst({
    where: { missionId, action: terminalAction },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  return log?.createdAt ?? null;
}

// getSummary
// Personal KPIs — top-level volunteer performance card.
// Endpoint: GET /dashboard/volunteer/summary?period=30d
export async function getSummary(volunteerId: string, period: Period) {
  const { from } = resolvePeriod(period);
  const dateFilter = periodFilter(from);

  // Previous period for delta calculation
  const prevFrom = from
    ? new Date(from.getTime() - (new Date().getTime() - from.getTime()))
    : null;

  const [currentAssignments, prevAssignments, profile] = await Promise.all([
    prisma.missionAssignment.findMany({
      where: {
        assignedTo: volunteerId,
        assignedAt: dateFilter,
      },
      include: {
        mission: {
          select: {
            id: true,
            status: true,
            acceptedAt: true,
            completedAt: true,
            closedAt: true,
            missionType: true,
            priority: true,
          },
        },
      },
    }),

    prevFrom
      ? prisma.missionAssignment.findMany({
          where: {
            assignedTo: volunteerId,
            assignedAt: { gte: prevFrom, lt: from! },
          },
          include: { mission: { select: { status: true } } },
        })
      : Promise.resolve([]),

    prisma.volunteerProfile.findUnique({
      where: { userId: volunteerId },
      select: { isAvailable: true },
    }),
  ]);

  // Current period metrics
  const missions = currentAssignments.map((a) => a.mission);
  const total = missions.length;
  const closed = missions.filter(
    (m) => m.status === MissionStatus.CLOSED,
  ).length;
  const failed = missions.filter(
    (m) => m.status === MissionStatus.FAILED,
  ).length;
  const cancelled = missions.filter(
    (m) => m.status === MissionStatus.CANCELLED,
  ).length;
  const active = missions.filter((m) =>
    ACTIVE_STATUSES.includes(m.status),
  ).length;
  const terminal = closed + failed + cancelled;
  const successRate =
    terminal === 0 ? 0 : Math.round((closed / terminal) * 100 * 10) / 10;

  // Hours served = sum of (endTime - acceptedAt) for terminal missions
  // where acceptedAt IS NOT NULL. Uses MissionLog timestamp as end time
  // for FAILED/CANCELLED missions (which lack completedAt).
  const terminalMissions = missions.filter(
    (m) => TERMINAL_STATUSES.includes(m.status) && m.acceptedAt !== null,
  );

  let hoursServedMs = 0;
  for (const m of terminalMissions) {
    const endTime = await resolveEndTime(m, m.id);
    if (endTime) {
      hoursServedMs += endTime.getTime() - m.acceptedAt!.getTime();
    }
  }
  const hoursServed = Math.round((hoursServedMs / 3_600_000) * 10) / 10;

  // Average mission duration (CLOSED missions only — confirmed complete)
  const closedWithTimes = missions.filter(
    (m) => m.status === MissionStatus.CLOSED && m.acceptedAt && m.completedAt,
  );
  const avgDurationHours =
    closedWithTimes.length === 0
      ? 0
      : Math.round(
          (closedWithTimes.reduce(
            (sum, m) =>
              sum + (m.completedAt!.getTime() - m.acceptedAt!.getTime()),
            0,
          ) /
            closedWithTimes.length /
            3_600_000) *
            10,
        ) / 10;

  // Previous period metrics (for delta)
  const prevTotal = prevAssignments.length;
  const prevClosed = prevAssignments.filter(
    (a) => a.mission.status === MissionStatus.CLOSED,
  ).length;
  const prevTerminal = prevAssignments.filter((a) =>
    TERMINAL_STATUSES.includes(a.mission.status),
  ).length;
  const prevSuccessRate =
    prevTerminal === 0
      ? 0
      : Math.round((prevClosed / prevTerminal) * 100 * 10) / 10;

  return {
    period,
    isAvailable: profile?.isAvailable ?? false,
    missions: {
      ...calcDelta(total, prevTotal),
      breakdown: { closed, failed, cancelled, active },
    },
    successRate: calcDelta(successRate, prevSuccessRate),
    hoursServed,
    avgMissionDurationHours: avgDurationHours,
  };
}

// getMissionBreakdown
// Detailed mission breakdown by type and priority.
// Endpoint: GET /dashboard/volunteer/missions?period=30d
export async function getMissionBreakdown(volunteerId: string, period: Period) {
  const { from } = resolvePeriod(period);
  const dateFilter = periodFilter(from);

  const assignments = await prisma.missionAssignment.findMany({
    where: { assignedTo: volunteerId, assignedAt: dateFilter },
    include: {
      mission: {
        select: {
          id: true,
          status: true,
          missionType: true,
          priority: true,
          acceptedAt: true,
          completedAt: true,
          closedAt: true,
          createdAt: true,
          primaryIncident: {
            select: {
              title: true,
              category: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { assignedAt: "desc" },
  });

  // Group by missionType
  const byType: Record<
    string,
    { total: number; closed: number; failed: number }
  > = {};
  for (const a of assignments) {
    const t = a.mission.missionType;
    if (!byType[t]) byType[t] = { total: 0, closed: 0, failed: 0 };
    byType[t].total++;
    if (a.mission.status === MissionStatus.CLOSED) byType[t].closed++;
    if (a.mission.status === MissionStatus.FAILED) byType[t].failed++;
  }

  // Group by priority
  const byPriority: Record<string, number> = {};
  for (const a of assignments) {
    const p = a.mission.priority;
    byPriority[p] = (byPriority[p] ?? 0) + 1;
  }

  // Recent 10 missions
  const recent = assignments.slice(0, 10).map((a) => ({
    missionId: a.mission.id,
    status: a.mission.status,
    missionType: a.mission.missionType,
    priority: a.mission.priority,
    incidentTitle: a.mission.primaryIncident?.title ?? null,
    category: a.mission.primaryIncident?.category?.name ?? null,
    acceptedAt: a.mission.acceptedAt,
    completedAt: a.mission.completedAt,
    assignedAt: a.assignedAt,
  }));

  return {
    period,
    byType: Object.entries(byType).map(([type, stats]) => ({
      type,
      ...stats,
      successRate:
        stats.total === 0
          ? 0
          : Math.round(
              (stats.closed / (stats.closed + stats.failed)) * 100 * 10,
            ) / 10,
    })),
    byPriority: Object.entries(byPriority).map(([priority, count]) => ({
      priority,
      count,
    })),
    recentMissions: recent,
  };
}

// getVerificationStats
// Volunteer's verification performance.
// Endpoint: GET /dashboard/volunteer/verifications?period=30d
export async function getVerificationStats(
  volunteerId: string,
  period: Period,
) {
  const { from } = resolvePeriod(period);
  const dateFilter = periodFilter(from);

  const verifications = await prisma.incidentVerification.findMany({
    where: {
      assignedTo: volunteerId,
      assignedAt: dateFilter,
    },
    select: {
      id: true,
      decision: true,
      isConfirmed: true,
      assignedAt: true,
      submittedAt: true,
      confirmedAt: true,
      incident: {
        select: {
          title: true,
          category: { select: { name: true } },
        },
      },
    },
    orderBy: { assignedAt: "desc" },
  });

  const total = verifications.length;
  const submitted = verifications.filter((v) => v.submittedAt !== null).length;
  const confirmed = verifications.filter((v) => v.isConfirmed === true).length;
  const rejected = verifications.filter((v) => v.isConfirmed === false).length;

  // Accuracy = how often agency confirms the volunteer's field decision
  const reviewed = confirmed + rejected;
  const accuracy =
    reviewed === 0 ? 0 : Math.round((confirmed / reviewed) * 100 * 10) / 10;

  // Average response time (assignedAt -> submittedAt) in hours
  const withBoth = verifications.filter((v) => v.assignedAt && v.submittedAt);
  const avgResponseHours =
    withBoth.length === 0
      ? 0
      : Math.round(
          (withBoth.reduce(
            (sum, v) =>
              sum + (v.submittedAt!.getTime() - v.assignedAt!.getTime()),
            0,
          ) /
            withBoth.length /
            3_600_000) *
            10,
        ) / 10;

  // Decision breakdown
  const byDecision = {
    VERIFIED: verifications.filter((v) => v.decision === "VERIFIED").length,
    UNREACHABLE: verifications.filter((v) => v.decision === "UNREACHABLE")
      .length,
    FALSE_REPORT: verifications.filter((v) => v.decision === "FALSE_REPORT")
      .length,
    pending: verifications.filter((v) => v.decision === null).length,
  };

  return {
    period,
    total,
    submitted,
    accuracyRate: accuracy,
    avgResponseHours,
    byDecision,
    recentVerifications: verifications.slice(0, 10).map((v) => ({
      id: v.id,
      decision: v.decision,
      isConfirmed: v.isConfirmed,
      incidentTitle: v.incident.title,
      category: v.incident.category?.name ?? null,
      assignedAt: v.assignedAt,
      submittedAt: v.submittedAt,
    })),
  };
}
