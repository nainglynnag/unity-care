import { prisma } from "../../lib/prisma";
import {
  Prisma,
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

const TERMINAL_MISSION: MissionStatus[] = [
  MissionStatus.CLOSED,
  MissionStatus.FAILED,
  MissionStatus.CANCELLED,
];

const ACTIVE_INCIDENT: IncidentStatus[] = [
  IncidentStatus.REPORTED,
  IncidentStatus.AWAITING_VERIFICATION,
  IncidentStatus.VERIFIED,
  IncidentStatus.UNREACHABLE,
];

// getPlatformOverview
// Top-level platform KPIs with period deltas.
// Endpoint: GET /dashboard/admin/overview?period=30d&agencyId=...
export async function getPlatformOverview(period: Period, agencyId?: string) {
  const { from } = resolvePeriod(period);
  const curr = periodFilter(from);

  const prevFrom = from
    ? new Date(from.getTime() - (Date.now() - from.getTime()))
    : null;
  const prev = prevFrom ? { gte: prevFrom, lt: from! } : undefined;

  // Conditional agency scoping
  const missionScope = agencyId ? { agencyId } : {};
  const incidentScope = agencyId ? { missions: { some: { agencyId } } } : {};
  const volunteerScope = agencyId
    ? { agencyMemberships: { some: { agencyId } } }
    : {};

  const [
    currCivilians,
    prevCivilians,
    currVolunteers,
    prevVolunteers,
    currIncidents,
    prevIncidents,
    currMissions,
    prevMissions,
    totalAgencies,
    missionOutcomes,
  ] = await Promise.all([
    // Civilians are platform-wide (not agency-scoped)
    prisma.user.count({
      where: {
        roles: { some: { role: { name: "CIVILIAN" } } },
        createdAt: curr,
        deletedAt: null,
      },
    }),
    prev
      ? prisma.user.count({
          where: {
            roles: { some: { role: { name: "CIVILIAN" } } },
            createdAt: prev,
            deletedAt: null,
          },
        })
      : Promise.resolve(0),

    prisma.user.count({
      where: {
        roles: { some: { role: { name: "VOLUNTEER" } } },
        ...volunteerScope,
        createdAt: curr,
        deletedAt: null,
      },
    }),
    prev
      ? prisma.user.count({
          where: {
            roles: { some: { role: { name: "VOLUNTEER" } } },
            ...volunteerScope,
            createdAt: prev,
            deletedAt: null,
          },
        })
      : Promise.resolve(0),

    prisma.incident.count({
      where: { ...incidentScope, createdAt: curr, deletedAt: null },
    }),
    prev
      ? prisma.incident.count({
          where: { ...incidentScope, createdAt: prev, deletedAt: null },
        })
      : Promise.resolve(0),

    prisma.mission.count({ where: { ...missionScope, createdAt: curr } }),
    prev
      ? prisma.mission.count({ where: { ...missionScope, createdAt: prev } })
      : Promise.resolve(0),

    agencyId ? Promise.resolve(1) : prisma.agency.count(),

    prisma.mission.groupBy({
      by: ["status"],
      where: {
        ...missionScope,
        status: { in: TERMINAL_MISSION },
        createdAt: curr,
      },
      _count: { status: true },
    }),
  ]);

  const closed =
    missionOutcomes.find((r) => r.status === MissionStatus.CLOSED)?._count
      .status ?? 0;
  const terminal = missionOutcomes.reduce((s, r) => s + r._count.status, 0);
  const successRate =
    terminal === 0 ? 0 : Math.round((closed / terminal) * 100 * 10) / 10;

  return {
    period,
    civilians: calcDelta(currCivilians, prevCivilians),
    volunteers: calcDelta(currVolunteers, prevVolunteers),
    incidents: calcDelta(currIncidents, prevIncidents),
    missions: calcDelta(currMissions, prevMissions),
    totalAgencies,
    missionSuccessRate: successRate,
  };
}

// getRetentionMetrics
// User retention and engagement health.
// Endpoint: GET /dashboard/admin/retention?period=30d&agencyId=...
export async function getRetentionMetrics(period: Period, agencyId?: string) {
  const { from } = resolvePeriod(period);
  const dateFilter = periodFilter(from);

  const volunteerScope = agencyId
    ? { agencyMemberships: { some: { agencyId } } }
    : {};

  const [
    neverLoggedIn,
    neverReported,
    volunteersNeverCompleted,
    totalCivilians,
    totalVolunteers,
    activeLastPeriod,
  ] = await Promise.all([
    // Registered civilians who never logged in (platform-wide)
    prisma.user.count({
      where: {
        roles: { some: { role: { name: "CIVILIAN" } } },
        lastLoginAt: null,
        deletedAt: null,
        createdAt: dateFilter,
      },
    }),

    // Registered civilians who never reported an incident (platform-wide)
    prisma.user.count({
      where: {
        roles: { some: { role: { name: "CIVILIAN" } } },
        reportedIncidents: { none: {} },
        deletedAt: null,
        createdAt: dateFilter,
      },
    }),

    // Approved volunteers who never completed a mission
    prisma.user.count({
      where: {
        roles: { some: { role: { name: "VOLUNTEER" } } },
        ...volunteerScope,
        assignedMissions: {
          none: {
            mission: { status: MissionStatus.CLOSED },
          },
        },
        deletedAt: null,
      },
    }),

    prisma.user.count({
      where: {
        roles: { some: { role: { name: "CIVILIAN" } } },
        deletedAt: null,
      },
    }),

    prisma.user.count({
      where: {
        roles: { some: { role: { name: "VOLUNTEER" } } },
        ...volunteerScope,
        deletedAt: null,
      },
    }),

    // Active this period (logged in)
    from
      ? prisma.user.count({
          where: {
            lastLoginAt: { gte: from },
            ...volunteerScope,
            deletedAt: null,
          },
        })
      : Promise.resolve(0),
  ]);

  return {
    period,
    civilians: {
      total: totalCivilians,
      neverLoggedIn,
      neverReported,
      neverLoggedInRate:
        totalCivilians === 0
          ? 0
          : Math.round((neverLoggedIn / totalCivilians) * 100 * 10) / 10,
    },
    volunteers: {
      total: totalVolunteers,
      neverCompletedMission: volunteersNeverCompleted,
    },
    activePeriod: activeLastPeriod,
  };
}

// getPlatformHealth
// Incident and mission health signals — stale incidents, stuck missions.
// Endpoint: GET /dashboard/admin/health?period=30d&agencyId=...
export async function getPlatformHealth(period: Period, agencyId?: string) {
  const { from, granularity } = resolvePeriod(period);
  const dateFilter = periodFilter(from);

  const cutoff24h = new Date(Date.now() - 24 * 3_600_000);
  const cutoff48h = new Date(Date.now() - 48 * 3_600_000);

  const dateClause = from
    ? Prisma.sql`AND u."createdAt" >= ${from}`
    : Prisma.empty;

  // Conditional agency scoping
  const missionScope = agencyId ? { agencyId } : {};
  const incidentScope = agencyId ? { missions: { some: { agencyId } } } : {};

  const [
    activeIncidents,
    staleVerified,
    stuckMissions,
    incidentsByStatus,
    missionsByStatus,
    falseReportCount,
    unreachableCount,
    totalIncidents,
    timeSeries,
  ] = await Promise.all([
    prisma.incident.count({
      where: {
        status: { in: ACTIVE_INCIDENT },
        ...incidentScope,
        deletedAt: null,
      },
    }),

    // Verified incidents with no active mission, created >24h ago
    prisma.incident.count({
      where: {
        status: IncidentStatus.VERIFIED,
        createdAt: { lt: cutoff24h },
        missions: agencyId ? { none: { agencyId } } : { none: {} },
        deletedAt: null,
      },
    }),

    // Missions active for >48h
    prisma.mission.count({
      where: {
        ...missionScope,
        status: {
          in: [
            MissionStatus.EN_ROUTE,
            MissionStatus.ON_SITE,
            MissionStatus.IN_PROGRESS,
          ],
        },
        createdAt: { lt: cutoff48h },
      },
    }),

    prisma.incident.groupBy({
      by: ["status"],
      where: { ...incidentScope, deletedAt: null },
      _count: { status: true },
    }),

    prisma.mission.groupBy({
      by: ["status"],
      where: missionScope,
      _count: { status: true },
    }),

    prisma.incident.count({
      where: {
        status: IncidentStatus.FALSE_REPORT,
        ...incidentScope,
        createdAt: dateFilter,
      },
    }),
    prisma.incident.count({
      where: {
        status: IncidentStatus.UNREACHABLE,
        ...incidentScope,
        createdAt: dateFilter,
      },
    }),
    prisma.incident.count({
      where: { ...incidentScope, createdAt: dateFilter, deletedAt: null },
    }),

    // Registration trend (platform-wide — users aren't agency-scoped)
    prisma.$queryRaw<{ bucket: Date; civilians: bigint; volunteers: bigint }[]>`
      SELECT
        date_trunc(${granularity}, u."createdAt") AS bucket,
        COUNT(u.id) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM "UserRole" ur
            JOIN "Role" r ON r.id = ur."roleId"
            WHERE ur."userId" = u.id AND r.name = 'CIVILIAN'
          )
        ) AS civilians,
        COUNT(u.id) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM "UserRole" ur
            JOIN "Role" r ON r.id = ur."roleId"
            WHERE ur."userId" = u.id AND r.name = 'VOLUNTEER'
          )
        ) AS volunteers
      FROM "User" u
      WHERE u."deletedAt" IS NULL
      ${dateClause}
      GROUP BY bucket
      ORDER BY bucket ASC
    `,
  ]);

  return {
    period,
    granularity,
    incidents: {
      active: activeIncidents,
      staleVerified,
      falseReportRate:
        totalIncidents === 0
          ? 0
          : Math.round((falseReportCount / totalIncidents) * 100 * 10) / 10,
      unreachableRate:
        totalIncidents === 0
          ? 0
          : Math.round((unreachableCount / totalIncidents) * 100 * 10) / 10,
      byStatus: incidentsByStatus.map((r) => ({
        status: r.status,
        count: r._count.status,
      })),
    },
    missions: {
      stuckActive: stuckMissions,
      byStatus: missionsByStatus.map((r) => ({
        status: r.status,
        count: r._count.status,
      })),
    },
    registrationTrend: timeSeries.map((r) => ({
      bucket: r.bucket,
      civilians: Number(r.civilians),
      volunteers: Number(r.volunteers),
    })),
  };
}

// getAgencyComparison
// All agencies ranked by key metrics (or single agency when agencyId provided).
// Endpoint: GET /dashboard/admin/agencies?period=30d&agencyId=...
export async function getAgencyComparison(period: Period, agencyId?: string) {
  const { from } = resolvePeriod(period);

  const dateClause = from
    ? Prisma.sql`AND m."createdAt" >= ${from}`
    : Prisma.empty;

  const agencyClause = agencyId
    ? Prisma.sql`AND a.id = ${agencyId}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<
    {
      agencyId: string;
      agencyName: string;
      total: bigint;
      closed: bigint;
      failed: bigint;
      pending: bigint;
      avgHours: number | null;
    }[]
  >`
    SELECT
      a.id                                                    AS "agencyId",
      a.name                                                  AS "agencyName",
      COUNT(m.id)                                             AS total,
      COUNT(m.id) FILTER (WHERE m.status = 'CLOSED')         AS closed,
      COUNT(m.id) FILTER (WHERE m.status = 'FAILED')         AS failed,
      COUNT(m.id) FILTER (
        WHERE m.status NOT IN ('CLOSED','FAILED','CANCELLED')
      )                                                       AS pending,
      AVG(
        EXTRACT(EPOCH FROM (m."completedAt" - m."acceptedAt")) / 3600
      ) FILTER (WHERE m.status = 'CLOSED'
                  AND m."acceptedAt" IS NOT NULL
                  AND m."completedAt" IS NOT NULL)            AS "avgHours"
    FROM "Agency" a
    LEFT JOIN "Mission" m ON m."agencyId" = a.id
    ${dateClause}
    WHERE TRUE
    ${agencyClause}
    GROUP BY a.id, a.name
    ORDER BY closed DESC
  `;

  return {
    period,
    agencies: rows.map((r) => {
      const total = Number(r.total);
      const closed = Number(r.closed);
      const failed = Number(r.failed);
      const terminal = closed + failed;
      return {
        agencyId: r.agencyId,
        agencyName: r.agencyName,
        totalMissions: total,
        closed,
        failed,
        active: Number(r.pending),
        successRate:
          terminal === 0 ? 0 : Math.round((closed / terminal) * 100 * 10) / 10,
        avgDurationHours:
          r.avgHours === null ? 0 : Math.round(r.avgHours * 10) / 10,
      };
    }),
  };
}

// getApplicationPipeline
// Pending application backlog across all agencies (or single agency).
// Endpoint: GET /dashboard/admin/applications?period=30d&agencyId=...
export async function getApplicationPipeline(
  period: Period,
  agencyId?: string,
) {
  const { from } = resolvePeriod(period);

  const dateClause = from
    ? Prisma.sql`AND "submittedAt" >= ${from}`
    : Prisma.empty;

  const agencyClause = agencyId
    ? Prisma.sql`AND a.id = ${agencyId}`
    : Prisma.empty;

  const reviewAgencyClause = agencyId
    ? Prisma.sql`AND "agencyId" = ${agencyId}`
    : Prisma.empty;

  const [byAgency, totalPending, avgDays] = await Promise.all([
    prisma.$queryRaw<
      {
        agencyId: string;
        agencyName: string;
        pending: bigint;
        oldestDays: number | null;
      }[]
    >`
      SELECT
        a.id   AS "agencyId",
        a.name AS "agencyName",
        COUNT(va.id) FILTER (
          WHERE va.status IN ('PENDING','UNDER_REVIEW')
        ) AS pending,
        MAX(
          EXTRACT(EPOCH FROM (NOW() - va."submittedAt")) / 86400
        ) FILTER (WHERE va.status IN ('PENDING','UNDER_REVIEW')) AS "oldestDays"
      FROM "Agency" a
      LEFT JOIN "VolunteerApplication" va ON va."agencyId" = a.id
      WHERE TRUE
      ${agencyClause}
      GROUP BY a.id, a.name
      HAVING COUNT(va.id) FILTER (WHERE va.status IN ('PENDING','UNDER_REVIEW')) > 0
      ORDER BY pending DESC
    `,

    prisma.volunteerApplication.count({
      where: {
        status: {
          in: [ApplicationStatus.PENDING, ApplicationStatus.UNDER_REVIEW],
        },
        ...(agencyId ? { agencyId } : {}),
      },
    }),

    prisma.$queryRaw<{ avg_days: number | null }[]>`
      SELECT
        AVG(EXTRACT(EPOCH FROM ("reviewedAt" - "submittedAt")) / 86400) AS avg_days
      FROM "VolunteerApplication"
      WHERE "reviewedAt" IS NOT NULL
      ${dateClause}
      ${reviewAgencyClause}
    `,
  ]);

  return {
    period,
    totalPending,
    platformAvgReviewDays: avgDays[0]?.avg_days
      ? Math.round(avgDays[0].avg_days * 10) / 10
      : 0,
    byAgency: byAgency.map((r) => ({
      agencyId: r.agencyId,
      agencyName: r.agencyName,
      pending: Number(r.pending),
      oldestDays: r.oldestDays ? Math.round(r.oldestDays * 10) / 10 : 0,
    })),
  };
}
