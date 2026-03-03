import { prisma } from "../../lib/prisma";
import {
  Prisma,
  AgencyRole,
  MissionStatus,
  IncidentStatus,
  ApplicationStatus,
} from "../../../generated/prisma/client";
import {
  resolvePeriod,
  periodFilter,
  calcDelta,
  type Period,
} from "../../utils/period";
import { ForbiddenError } from "../../utils/errors";

// Authority resolver
// Resolves agencyId from the requester's AgencyMember record.
// COORDINATOR and DIRECTOR can access agency dashboard.
// SUPERADMIN can optionally pass agencyId to view any agency.
export async function resolveAgencyId(
  requesterId: string,
  requesterRole: string,
  targetAgencyId?: string,
): Promise<string> {
  if (requesterRole === "SUPERADMIN") {
    if (!targetAgencyId) throw new ForbiddenError();
    return targetAgencyId;
  }

  if (requesterRole !== "VOLUNTEER") throw new ForbiddenError();

  const membership = await prisma.agencyMember.findFirst({
    where: {
      userId: requesterId,
      role: { in: [AgencyRole.COORDINATOR, AgencyRole.DIRECTOR] },
    },
    select: { agencyId: true, role: true },
  });

  if (!membership) throw new ForbiddenError();
  return membership.agencyId;
}

// Returns requester's AgencyRole for endpoints that need DIRECTOR-only access
export async function resolveAgencyMembership(requesterId: string) {
  if (!requesterId) throw new ForbiddenError();
  const m = await prisma.agencyMember.findFirst({
    where: {
      userId: requesterId,
      role: { in: [AgencyRole.COORDINATOR, AgencyRole.DIRECTOR] },
    },
    select: { agencyId: true, role: true },
  });
  if (!m) throw new ForbiddenError();
  return m;
}

// Active incident statuses (not yet resolved)
const ACTIVE_INCIDENT_STATUSES: IncidentStatus[] = [
  IncidentStatus.REPORTED,
  IncidentStatus.AWAITING_VERIFICATION,
  IncidentStatus.VERIFIED,
  IncidentStatus.UNREACHABLE,
];

const ACTIVE_MISSION_STATUSES: MissionStatus[] = [
  MissionStatus.ASSIGNED,
  MissionStatus.ACCEPTED,
  MissionStatus.EN_ROUTE,
  MissionStatus.ON_SITE,
  MissionStatus.IN_PROGRESS,
];

const TERMINAL_MISSION_STATUSES: MissionStatus[] = [
  MissionStatus.CLOSED,
  MissionStatus.FAILED,
  MissionStatus.CANCELLED,
];

// getLiveSnapshot
// Real-time operational snapshot. No period filter — always current state.
// Endpoint: GET /dashboard/agency/live
export async function getLiveSnapshot(agencyId: string) {
  const [
    activeIncidents,
    activeMissions,
    awaitingVerification,
    verifiedNoMission,
    totalVolunteers,
    availableVolunteers,
    volunteersOnMission,
  ] = await Promise.all([
    // Active incidents in this agency's missions
    prisma.incident.count({
      where: {
        status: { in: ACTIVE_INCIDENT_STATUSES },
        missions: { some: { agencyId } },
      },
    }),

    // Active missions right now
    prisma.mission.count({
      where: { agencyId, status: { in: ACTIVE_MISSION_STATUSES } },
    }),

    // Incidents awaiting verification (agency assigned verifier)
    prisma.incident.count({
      where: {
        status: IncidentStatus.AWAITING_VERIFICATION,
        verifications: { some: { assignedBy: { not: undefined } } },
        missions: { some: { agencyId } },
      },
    }),

    // Verified incidents with no active mission (need action)
    prisma.incident.count({
      where: {
        status: IncidentStatus.VERIFIED,
        missions: {
          none: {
            agencyId,
            status: { in: ACTIVE_MISSION_STATUSES },
          },
        },
      },
    }),

    // Total approved volunteers in agency
    prisma.agencyMember.count({
      where: { agencyId, role: AgencyRole.MEMBER },
    }),

    // Available volunteers (isAvailable=true in this agency)
    prisma.volunteerProfile.count({
      where: {
        isAvailable: true,
        user: {
          agencyMemberships: {
            some: { agencyId, role: AgencyRole.MEMBER },
          },
        },
      },
    }),

    // Volunteers currently on an active mission
    prisma.missionAssignment.count({
      where: {
        unassignedAt: null,
        mission: {
          agencyId,
          status: { in: ACTIVE_MISSION_STATUSES },
        },
      },
    }),
  ]);

  return {
    activeIncidents,
    activeMissions,
    awaitingVerification,
    verifiedNoMission,
    workforce: {
      total: totalVolunteers,
      available: availableVolunteers,
      onMission: volunteersOnMission,
      offline: Math.max(
        0,
        totalVolunteers - availableVolunteers - volunteersOnMission,
      ),
    },
    generatedAt: new Date(),
  };
}

// getIncidentMetrics
// Incident funnel with average times between states.
// Endpoint: GET /dashboard/agency/incidents?period=30d
export async function getIncidentMetrics(agencyId: string, period: Period) {
  const { from, granularity } = resolvePeriod(period);
  const dateFilter = periodFilter(from);

  // All incidents this agency handled in the period
  const incidents = await prisma.incident.findMany({
    where: {
      createdAt: dateFilter,
      missions: { some: { agencyId } },
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      verifications: {
        select: {
          assignedAt: true,
          submittedAt: true,
          confirmedAt: true,
          decision: true,
          isConfirmed: true,
        },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
      missions: {
        where: { agencyId },
        select: {
          createdAt: true,
          acceptedAt: true,
          closedAt: true,
          status: true,
        },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  const total = incidents.length;
  const falseReports = incidents.filter(
    (i) => i.status === IncidentStatus.FALSE_REPORT,
  ).length;
  const unreachable = incidents.filter(
    (i) => i.status === IncidentStatus.UNREACHABLE,
  ).length;
  const verified = incidents.filter((i) =>
    (
      [
        IncidentStatus.VERIFIED,
        IncidentStatus.RESOLVED,
        IncidentStatus.CLOSED,
      ] as IncidentStatus[]
    ).includes(i.status),
  ).length;
  const resolved = incidents.filter((i) =>
    (
      [IncidentStatus.RESOLVED, IncidentStatus.CLOSED] as IncidentStatus[]
    ).includes(i.status),
  ).length;

  // Average time: createdAt -> first verification assignedAt (hours)
  const toVerifAssign = incidents
    .filter((i) => i.verifications[0]?.assignedAt)
    .map(
      (i) => i.verifications[0]!.assignedAt!.getTime() - i.createdAt.getTime(),
    );

  const avgHoursToVerifAssign =
    toVerifAssign.length === 0
      ? 0
      : Math.round(
          (toVerifAssign.reduce((a, b) => a + b, 0) /
            toVerifAssign.length /
            3_600_000) *
            10,
        ) / 10;

  // Average time: createdAt -> verif confirmedAt (total verification time)
  const toVerifConfirm = incidents
    .filter((i) => i.verifications[0]?.confirmedAt)
    .map(
      (i) => i.verifications[0]!.confirmedAt!.getTime() - i.createdAt.getTime(),
    );

  const avgHoursToVerified =
    toVerifConfirm.length === 0
      ? 0
      : Math.round(
          (toVerifConfirm.reduce((a, b) => a + b, 0) /
            toVerifConfirm.length /
            3_600_000) *
            10,
        ) / 10;

  // Average time: verif confirmedAt -> first mission createdAt (time to action)
  const toMission = incidents
    .filter((i) => i.verifications[0]?.confirmedAt && i.missions[0]?.createdAt)
    .map(
      (i) =>
        i.missions[0]!.createdAt.getTime() -
        i.verifications[0]!.confirmedAt!.getTime(),
    );

  const avgHoursToMission =
    toMission.length === 0
      ? 0
      : Math.round(
          (toMission.reduce((a, b) => a + b, 0) /
            toMission.length /
            3_600_000) *
            10,
        ) / 10;

  // Time series: incidents created per day/week/month
  const dateClause = from
    ? Prisma.sql`AND i."createdAt" >= ${from}`
    : Prisma.empty;

  const timeSeries = await prisma.$queryRaw<{ bucket: Date; count: bigint }[]>`
    SELECT
      date_trunc(${granularity}, i."createdAt") AS bucket,
      COUNT(*)::int AS count
    FROM "Incident" i
    WHERE EXISTS (
      SELECT 1 FROM "Mission" m
      WHERE m."primaryIncidentId" = i.id
        AND m."agencyId" = ${agencyId}
    )
    ${dateClause}
    GROUP BY bucket
    ORDER BY bucket ASC
  `;

  return {
    period,
    granularity,
    totals: {
      total,
      verified,
      resolved,
      falseReports,
      unreachable,
      falseReportRate:
        total === 0 ? 0 : Math.round((falseReports / total) * 100 * 10) / 10,
      unreachableRate:
        total === 0 ? 0 : Math.round((unreachable / total) * 100 * 10) / 10,
    },
    avgTimes: {
      hoursToVerifierAssigned: avgHoursToVerifAssign,
      hoursToVerified: avgHoursToVerified,
      hoursToMissionCreated: avgHoursToMission,
    },
    timeSeries: timeSeries.map((r) => ({
      bucket: r.bucket,
      count: Number(r.count),
    })),
  };
}

// getMissionMetrics
// Mission funnel with outcomes and durations.
// Endpoint: GET /dashboard/agency/missions?period=30d
export async function getMissionMetrics(agencyId: string, period: Period) {
  const { from, granularity } = resolvePeriod(period);
  const dateFilter = periodFilter(from);

  const missions = await prisma.mission.findMany({
    where: { agencyId, createdAt: dateFilter },
    select: {
      id: true,
      status: true,
      priority: true,
      missionType: true,
      acceptedAt: true,
      onSiteAt: true,
      completedAt: true,
      closedAt: true,
      createdAt: true,
    },
  });

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
    ACTIVE_MISSION_STATUSES.includes(m.status),
  ).length;
  const terminal = closed + failed + cancelled;

  const successRate =
    terminal === 0 ? 0 : Math.round((closed / terminal) * 100 * 10) / 10;

  // Average time: acceptedAt -> onSiteAt (volunteer response time, hours)
  const responseMs = missions
    .filter((m) => m.acceptedAt && m.onSiteAt)
    .map((m) => m.onSiteAt!.getTime() - m.acceptedAt!.getTime());

  const avgResponseHours =
    responseMs.length === 0
      ? 0
      : Math.round(
          (responseMs.reduce((a, b) => a + b, 0) /
            responseMs.length /
            3_600_000) *
            10,
        ) / 10;

  // Average duration: acceptedAt -> completedAt (CLOSED missions only)
  const durationMs = missions
    .filter(
      (m) => m.status === MissionStatus.CLOSED && m.acceptedAt && m.completedAt,
    )
    .map((m) => m.completedAt!.getTime() - m.acceptedAt!.getTime());

  const avgDurationHours =
    durationMs.length === 0
      ? 0
      : Math.round(
          (durationMs.reduce((a, b) => a + b, 0) /
            durationMs.length /
            3_600_000) *
            10,
        ) / 10;

  // By priority breakdown
  const byPriority: Record<string, { total: number; closed: number }> = {};
  for (const m of missions) {
    if (!byPriority[m.priority])
      byPriority[m.priority] = { total: 0, closed: 0 };
    const bucket = byPriority[m.priority]!;
    bucket.total++;
    if (m.status === MissionStatus.CLOSED) bucket.closed++;
  }

  // Time series: missions created per bucket
  const dateClause = from
    ? Prisma.sql`AND "createdAt" >= ${from}`
    : Prisma.empty;

  const timeSeries = await prisma.$queryRaw<{ bucket: Date; count: bigint }[]>`
    SELECT
      date_trunc(${granularity}, "createdAt") AS bucket,
      COUNT(*)::int AS count
    FROM "Mission"
    WHERE "agencyId" = ${agencyId}
    ${dateClause}
    GROUP BY bucket
    ORDER BY bucket ASC
  `;

  return {
    period,
    granularity,
    totals: {
      total,
      closed,
      failed,
      cancelled,
      active,
      successRate,
    },
    avgTimes: {
      responseHours: avgResponseHours,
      durationHours: avgDurationHours,
    },
    byPriority: Object.entries(byPriority).map(([priority, s]) => ({
      priority,
      total: s.total,
      closed: s.closed,
      successRate:
        s.total === 0 ? 0 : Math.round((s.closed / s.total) * 100 * 10) / 10,
    })),
    timeSeries: timeSeries.map((r) => ({
      bucket: r.bucket,
      count: Number(r.count),
    })),
  };
}

// getVolunteerMetrics
// Workforce performance for agency coordinators.
// Endpoint: GET /dashboard/agency/volunteers?period=30d
export async function getVolunteerMetrics(agencyId: string, period: Period) {
  const { from } = resolvePeriod(period);
  const dateFilter = periodFilter(from);

  const [totalVolunteers, activeVolunteers, topPerformers, dormant] =
    await Promise.all([
      prisma.agencyMember.count({
        where: { agencyId, role: AgencyRole.MEMBER },
      }),

      // Active = completed >=1 mission in period
      prisma.missionAssignment.groupBy({
        by: ["assignedTo"],
        where: {
          assignedAt: dateFilter,
          mission: {
            agencyId,
            status: MissionStatus.CLOSED,
          },
        },
      }),

      // Top 5 by missions closed this period
      prisma.missionAssignment.groupBy({
        by: ["assignedTo"],
        where: {
          assignedAt: dateFilter,
          mission: { agencyId, status: MissionStatus.CLOSED },
        },
        _count: { assignedTo: true },
        orderBy: { _count: { assignedTo: "desc" } },
        take: 5,
      }),

      // Dormant: approved but 0 missions in last 30 days (always 30d regardless of period)
      prisma.agencyMember.findMany({
        where: {
          agencyId,
          role: AgencyRole.MEMBER,
          user: {
            assignedMissions: {
              none: {
                assignedAt: {
                  gte: new Date(Date.now() - 30 * 86_400_000),
                },
                mission: { agencyId },
              },
            },
          },
        },
        select: {
          user: {
            select: { id: true, name: true, lastLoginAt: true },
          },
        },
        take: 20,
      }),
    ]);

  // Enrich top performers with names
  const topPerformerIds = topPerformers.map((t) => t.assignedTo);
  const topNames = await prisma.user.findMany({
    where: { id: { in: topPerformerIds } },
    select: { id: true, name: true },
  });
  const nameMap = Object.fromEntries(topNames.map((u) => [u.id, u.name]));

  return {
    period,
    totals: {
      total: totalVolunteers,
      active: activeVolunteers.length,
      dormant: dormant.length,
    },
    topPerformers: topPerformers.map((t) => ({
      volunteerId: t.assignedTo,
      name: nameMap[t.assignedTo] ?? "Unknown",
      missionsClosed: t._count.assignedTo,
    })),
    dormantVolunteers: dormant.map((d) => ({
      volunteerId: d.user.id,
      name: d.user.name,
      lastLoginAt: d.user.lastLoginAt,
    })),
  };
}

// getCategoryBreakdown
// Incidents by category with outcome rates.
// Endpoint: GET /dashboard/agency/categories?period=30d
export async function getCategoryBreakdown(agencyId: string, period: Period) {
  const { from } = resolvePeriod(period);

  const dateClause = from
    ? Prisma.sql`AND i."createdAt" >= ${from}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<
    {
      categoryName: string;
      total: bigint;
      falseReport: bigint;
      unreachable: bigint;
      resolved: bigint;
    }[]
  >`
    SELECT
      ic.name                                               AS "categoryName",
      COUNT(i.id)                                           AS total,
      COUNT(i.id) FILTER (WHERE i.status = 'FALSE_REPORT') AS "falseReport",
      COUNT(i.id) FILTER (WHERE i.status = 'UNREACHABLE')  AS unreachable,
      COUNT(i.id) FILTER (
        WHERE i.status IN ('RESOLVED','CLOSED')
      )                                                     AS resolved
    FROM "Incident" i
    JOIN "IncidentCategory" ic ON ic.id = i."categoryId"
    WHERE EXISTS (
      SELECT 1 FROM "Mission" m
      WHERE m."primaryIncidentId" = i.id AND m."agencyId" = ${agencyId}
    )
    ${dateClause}
    GROUP BY ic.name
    ORDER BY total DESC
  `;

  return {
    period,
    categories: rows.map((r) => {
      const total = Number(r.total);
      const falseReport = Number(r.falseReport);
      const unreachable = Number(r.unreachable);
      const resolved = Number(r.resolved);
      return {
        categoryName: r.categoryName,
        total,
        resolved,
        falseReport,
        unreachable,
        falseReportRate:
          total === 0 ? 0 : Math.round((falseReport / total) * 100 * 10) / 10,
        unreachableRate:
          total === 0 ? 0 : Math.round((unreachable / total) * 100 * 10) / 10,
      };
    }),
  };
}

// getApplicationMetrics (DIRECTOR only)
// Volunteer pipeline health.
// Endpoint: GET /dashboard/agency/applications?period=30d
export async function getApplicationMetrics(agencyId: string, period: Period) {
  const { from } = resolvePeriod(period);
  const dateFilter = periodFilter(from);

  const dateClause = from
    ? Prisma.sql`AND "submittedAt" >= ${from}`
    : Prisma.empty;

  const [submitted, approved, rejected, pending, avgReviewMs] =
    await Promise.all([
      prisma.volunteerApplication.count({
        where: { agencyId, submittedAt: dateFilter },
      }),
      prisma.volunteerApplication.count({
        where: {
          agencyId,
          status: ApplicationStatus.APPROVED,
          reviewedAt: dateFilter,
        },
      }),
      prisma.volunteerApplication.count({
        where: {
          agencyId,
          status: ApplicationStatus.REJECTED,
          reviewedAt: dateFilter,
        },
      }),
      prisma.volunteerApplication.count({
        where: {
          agencyId,
          status: {
            in: [ApplicationStatus.PENDING, ApplicationStatus.UNDER_REVIEW],
          },
        },
      }),

      // Average days from submittedAt -> reviewedAt
      prisma.$queryRaw<{ avg_ms: number | null }[]>`
        SELECT AVG(EXTRACT(EPOCH FROM ("reviewedAt" - "submittedAt")) * 1000) AS avg_ms
        FROM "VolunteerApplication"
        WHERE "agencyId" = ${agencyId}
          AND "reviewedAt" IS NOT NULL
          ${dateClause}
      `,
    ]);

  const avgReviewDays =
    avgReviewMs[0]?.avg_ms == null
      ? 0
      : Math.round((avgReviewMs[0].avg_ms / 86_400_000) * 10) / 10;

  const reviewed = approved + rejected;
  const approvalRate =
    reviewed === 0 ? 0 : Math.round((approved / reviewed) * 100 * 10) / 10;

  return {
    period,
    submitted,
    approved,
    rejected,
    pending,
    approvalRate,
    avgReviewDays,
  };
}
