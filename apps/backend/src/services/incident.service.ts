import { prisma } from "../lib/prisma";
import { IncidentStatus, Prisma } from "../../generated/prisma/client";
import {
  IncidentNotFoundError,
  CategoryNotFoundError,
  CategoryInactiveError,
  InvalidStatusTransitionError,
  AgencyLocationRequiredError,
  ForbiddenError,
} from "../utils/errors";
import { isSuperAdmin } from "../middlewares/auth.middleware";
import { emitNotification, emitToMany } from "../utils/notificationEmitter";
import type {
  CreateIncidentInput,
  ListMyIncidentQuery,
  ListIncidentQuery,
  ListAssignedIncidentsQuery,
} from "../validators/incident.validator";

// Haversine formula as raw SQL fragment.
// Calculates great-circle distance in km between a fixed point (lat/lng params)
// and each incident's stored (latitude, longitude).
// Earth radius = 6371 km.
// LEAST(1.0, ...) guards against floating-point errors where acos receives
// a value slightly above 1.0 due to rounding — without it, acos returns NaN on edge cases where the two points are identical or very close.
const HAVERSINE_SQL = (lat: number, lng: number) => `
  (6371 * acos(
    LEAST(1.0,
      cos(radians(${lat}))
      * cos(radians(i."latitude"))
      * cos(radians(i."longitude") - radians(${lng}))
      + sin(radians(${lat}))
      * sin(radians(i."latitude"))
    )
  ))
`;

// Shared include for listIncidents — used by both the Prisma and raw-SQL
// branches so the response shape is identical regardless of geo filtering.
const LIST_INCIDENT_INCLUDE = {
  category: true,
  reporter: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      emergencyProfile: {
        include: {
          contacts: { orderBy: { isPrimary: "desc" as const } },
        },
      },
    },
  },
  media: true,
  verifications: {
    include: {
      verifier: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
  missions: {
    include: {
      assignments: {
        include: {
          assignee: {
            select: { id: true, name: true, email: true, phone: true },
          },
        },
      },
      tracking: {
        orderBy: { recordedAt: "desc" as const },
        select: {
          latitude: true,
          longitude: true,
          recordedAt: true,
          volunteer: { select: { id: true, name: true } },
        },
      },
      logs: {
        include: { actor: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" as const },
      },
      report: true,
    },
  },
  _count: {
    select: { verifications: true, media: true, missions: true },
  },
} satisfies Prisma.IncidentInclude;

// Pagination result builder — shared across list functions
function buildPaginatedResult<T>(
  data: T[],
  totalRecords: number,
  page: number,
  perPage: number,
) {
  return {
    incidents: data,
    pagination: {
      totalRecords,
      totalPages: Math.ceil(totalRecords / perPage),
      currentPage: page,
      perPage,
    },
  };
}

// Create Incident
export async function createIncident(
  reportedBy: string,
  data: CreateIncidentInput,
) {
  // Verify the category exists and is active
  const category = await prisma.incidentCategory.findUnique({
    where: { id: data.categoryId },
  });

  if (!category) {
    throw new CategoryNotFoundError();
  }

  if (!category.isActive) {
    throw new CategoryInactiveError();
  }

  let emergencyProfile = null;

  // Reporting for self
  // Not having a profile is allowed — civilian may not have set one up yet.
  if (data.forSelf) {
    emergencyProfile = await prisma.emergencyProfile.findUnique({
      where: { userId: reportedBy },
      include: {
        contacts: {
          orderBy: { isPrimary: "desc" },
        },
      },
    });
  }

  const incident = await prisma.$transaction(async (tx) => {
    const created = await tx.incident.create({
      data: {
        title: data.title,
        description: data.forSelf
          ? data.description
          : [data.description, data.reporterNote].filter(Boolean).join(" | "),
        latitude: data.latitude,
        longitude: data.longitude,
        addressText: data.addressText,
        landmark: data.landmark,
        accuracy: data.accuracy,
        categoryId: data.categoryId,
        reportedBy,
        status: IncidentStatus.REPORTED,
      },
    });

    // Attach media if provided
    if (data.media && data.media.length > 0) {
      await tx.incidentMedia.createMany({
        data: data.media.map((m) => ({
          incidentId: created.id,
          uploadedBy: reportedBy,
          url: m.url,
          mediaType: m.mediaType,
        })),
      });
    }

    // Re-fetch with full relations so the response shape is consistent
    return tx.incident.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        category: true,
        reporter: { select: { id: true, name: true, email: true } },
        media: true,
      },
    });
  });

  // Notify reporter that their SOS was received
  emitNotification({
    userId: reportedBy,
    type: "INCIDENT_CREATED",
    title: "Incident Reported",
    message: `Your incident "${incident.title}" has been received and is being processed.`,
    referenceType: "INCIDENT",
    referenceId: incident.id,
  });

  // Notify all ADMIN/SUPERADMIN users of the new incident
  const admins = await prisma.userRole.findMany({
    where: { role: { name: { in: ["ADMIN", "SUPERADMIN"] } } },
    select: { userId: true },
  });
  const adminIds = admins
    .map((a) => a.userId)
    .filter((id) => id !== reportedBy);
  emitToMany(
    adminIds,
    "INCIDENT_CREATED",
    "New Incident Reported",
    `A new incident "${incident.title}" has been reported on the platform.`,
    { type: "INCIDENT", id: incident.id },
  );

  return { incident, emergencyProfile };
}

// List active incident categories (for civilian report form)
export async function listIncidentCategories() {
  const categories = await prisma.incidentCategory.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, description: true },
  });
  const other = categories.filter((c) => c.name === "Other");
  const rest = categories.filter((c) => c.name !== "Other");
  return [...rest, ...other];
}

// Get Single Incident
// Any authenticated user can view an incident they have access to.
// Admin/Volunteer can view all incidents with full details.
// Civilians can only view their own incidents with limited information.
export async function getIncidentById(
  incidentId: string,
  requesterId: string,
  requesterRole: string,
) {
  const isCivilian = requesterRole === "CIVILIAN";

  const where = {
    id: incidentId,
    deletedAt: null,
    // Civilians are scoped to their own incidents only
    ...(isCivilian && { reportedBy: requesterId }),
  };

  const incident = await prisma.incident.findFirst({
    where,
    include: {
      category: true,
      reporter: {
        select: {
          id: true,
          name: true,
          ...(!isCivilian && {
            email: true,
            phone: true,
            emergencyProfile: {
              include: {
                contacts: { orderBy: { isPrimary: "desc" } },
              },
            },
          }),
        },
      },
      verifications: isCivilian
        ? {
            select: {
              id: true,
              decision: true,
              createdAt: true,
              verifier: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
          }
        : {
            include: {
              verifier: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
      media: true,
      missions: isCivilian
        ? {
            select: {
              id: true,
              status: true,
              priority: true,
              missionType: true,
              createdAt: true,
              acceptedAt: true,
              onSiteAt: true,
              completedAt: true,
              assignments: {
                select: {
                  role: true,
                  assignee: { select: { id: true, name: true } },
                },
              },
              tracking: {
                where: {
                  volunteer: {
                    assignedMissions: {
                      some: {
                        role: "LEADER",
                      },
                    },
                  },
                },
                orderBy: { recordedAt: "desc" },
                select: {
                  latitude: true,
                  longitude: true,
                  recordedAt: true,
                  volunteer: { select: { id: true, name: true } },
                },
              },
            },
          }
        : {
            include: {
              assignments: {
                include: {
                  assignee: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      phone: true,
                    },
                  },
                },
              },
              tracking: {
                orderBy: { recordedAt: "desc" },
                select: {
                  latitude: true,
                  longitude: true,
                  recordedAt: true,
                  volunteer: { select: { id: true, name: true } },
                },
              },
              logs: {
                include: { actor: { select: { id: true, name: true } } },
                orderBy: { createdAt: "desc" },
              },
              report: true,
            },
          },
    },
  });

  if (!incident) {
    throw new IncidentNotFoundError();
  }

  return incident;
}

// List My Incidents (Civilian)
export async function listMyIncidents(
  reportedBy: string,
  query: ListMyIncidentQuery,
) {
  const { status, page, perPage } = query;
  const skip = (page - 1) * perPage;

  const where = {
    reportedBy,
    deletedAt: null,
    ...(status && { status }),
  };

  const [incidents, totalRecords] = await Promise.all([
    prisma.incident.findMany({
      where,
      include: {
        category: true,
        media: true,
        verifications: {
          select: {
            id: true,
            decision: true,
            createdAt: true,
            verifier: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        missions: {
          select: {
            id: true,
            status: true,
            priority: true,
            missionType: true,
            createdAt: true,
            acceptedAt: true,
            onSiteAt: true,
            completedAt: true,
            assignments: {
              select: {
                role: true,
                assignee: { select: { id: true, name: true } },
              },
            },
            tracking: {
              where: {
                volunteer: {
                  assignedMissions: {
                    some: {
                      role: "LEADER",
                    },
                  },
                },
              },
              orderBy: { recordedAt: "desc" },
              select: {
                latitude: true,
                longitude: true,
                recordedAt: true,
                volunteer: { select: { id: true, name: true } },
              },
            },
          },
        },
        _count: { select: { verifications: true, missions: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    prisma.incident.count({ where }),
  ]);

  return {
    incidents,
    pagination: {
      totalRecords,
      totalPages: Math.ceil(totalRecords / perPage),
      currentPage: page,
      perPage,
    },
  };
}

// List Incidents (Admin / Volunteer)
// Supports optional Haversine distance filtering.
// When sortBy=distance or radiusKm is provided, geo coordinates are needed.
// If lat/lng are not in query, the requester's agency location is used.
// ADMIN/SUPERADMIN without an agency must provide lat/lng explicitly.
export async function listIncidents(
  requesterId: string,
  requesterRole: string,
  query: ListIncidentQuery,
) {
  const { status, categoryId, page, perPage, radiusKm, sortBy } = query;
  let { lat, lng } = query;
  const skip = (page - 1) * perPage;
  const needsGeo = sortBy === "distance" || radiusKm !== undefined;

  // Resolve lat/lng from agency when not explicitly provided
  if (needsGeo && lat === undefined) {
    const membership = await prisma.agencyMember.findFirst({
      where: { userId: requesterId },
      select: { agency: { select: { latitude: true, longitude: true } } },
    });

    if (!membership) throw new AgencyLocationRequiredError();

    lat = membership.agency.latitude;
    lng = membership.agency.longitude;
  }

  // Branch A: no geo — existing Prisma query, unchanged behaviour
  if (!needsGeo) {
    const where = {
      deletedAt: null,
      ...(status && { status }),
      ...(categoryId && { categoryId }),
    };

    const [incidents, totalRecords] = await Promise.all([
      prisma.incident.findMany({
        where,
        include: LIST_INCIDENT_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip,
        take: perPage,
      }),
      prisma.incident.count({ where }),
    ]);

    return buildPaginatedResult(incidents, totalRecords, page, perPage);
  }

  // Branch B: geo — raw SQL with Haversine
  // lat/lng are guaranteed at this point (either from query or agency lookup)
  const distanceExpr = HAVERSINE_SQL(lat!, lng!);

  // Build dynamic WHERE fragments with numbered params
  // Param slots depend on whether radiusKm is provided
  const params: (string | number)[] = [];
  let paramIdx = 1;

  // radiusKm is optional — when absent, all incidents are returned (sorted by distance)
  let radiusFilter = "";
  if (radiusKm !== undefined) {
    radiusFilter = `AND ${distanceExpr} <= $${paramIdx}`;
    params.push(radiusKm);
    paramIdx++;
  }

  // perPage and skip always present
  const perPageIdx = paramIdx;
  params.push(perPage);
  paramIdx++;
  const skipIdx = paramIdx;
  params.push(skip);
  paramIdx++;

  let statusFilter = "";
  let categoryFilter = "";

  if (status) {
    statusFilter = `AND i."status" = $${paramIdx}::"IncidentStatus"`;
    params.push(status);
    paramIdx++;
  }
  if (categoryId) {
    categoryFilter = `AND i."categoryId" = $${paramIdx}`;
    params.push(categoryId);
  }

  const orderClause =
    sortBy === "distance"
      ? `ORDER BY distance_km ASC`
      : `ORDER BY i."createdAt" DESC`;

  // Fetch matching IDs + distance
  const rawRows = await prisma.$queryRawUnsafe<
    Array<{ id: string; distance_km: number }>
  >(
    `
    SELECT i."id",
           ${distanceExpr} AS distance_km
    FROM   "Incident" i
    WHERE  i."deletedAt" IS NULL
      ${statusFilter}
      ${categoryFilter}
      ${radiusFilter}
    ${orderClause}
    LIMIT  $${perPageIdx}
    OFFSET $${skipIdx}
    `,
    ...params,
  );

  // Count query — same filters, no LIMIT/OFFSET
  // Remove perPage and skip from params for the count query
  const countParams = params.filter(
    (_, i) => i !== perPageIdx - 1 && i !== skipIdx - 1,
  );
  // Re-number the SQL placeholders for count query
  let countParamIdx = 1;
  let countRadiusFilter = "";
  if (radiusKm !== undefined) {
    countRadiusFilter = `AND ${distanceExpr} <= $${countParamIdx}`;
    countParamIdx++;
  }
  let countStatusFilter = "";
  let countCategoryFilter = "";
  if (status) {
    countStatusFilter = `AND i."status" = $${countParamIdx}::"IncidentStatus"`;
    countParamIdx++;
  }
  if (categoryId) {
    countCategoryFilter = `AND i."categoryId" = $${countParamIdx}`;
  }

  const countRows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `
    SELECT COUNT(*) AS count
    FROM   "Incident" i
    WHERE  i."deletedAt" IS NULL
      ${countStatusFilter}
      ${countCategoryFilter}
      ${countRadiusFilter}
    `,
    ...countParams,
  );
  const totalRecords = Number(countRows[0]?.count ?? 0);

  if (rawRows.length === 0) {
    return buildPaginatedResult([], totalRecords, page, perPage);
  }

  // Re-fetch with Prisma for typed relations (same include as non-geo branch)
  const ids = rawRows.map((r) => r.id);
  const distanceMap = new Map(rawRows.map((r) => [r.id, r.distance_km]));

  const incidents = await prisma.incident.findMany({
    where: { id: { in: ids } },
    include: LIST_INCIDENT_INCLUDE,
  });

  // Restore raw query order and attach distanceKm
  const orderedIncidents = ids
    .map((id) => {
      const incident = incidents.find((i) => i.id === id);
      if (!incident) return null;
      return {
        ...incident,
        distanceKm: parseFloat(distanceMap.get(id)!.toFixed(2)),
      };
    })
    .filter(Boolean);

  return buildPaginatedResult(orderedIncidents, totalRecords, page, perPage);
}

// List Assigned Incidents (Volunteer)
// Returns incidents where the requesting volunteer has an IncidentVerification
// assignment (active, submitted, or confirmed — full history).
// Includes the specific verification record so the volunteer sees their
// assignment status, decision, and whether confirmation is pending.
export async function listAssignedIncidents(
  volunteerId: string,
  query: ListAssignedIncidentsQuery,
) {
  const { status, page, perPage } = query;
  const skip = (page - 1) * perPage;

  // Filter by assignedTo + always exclude soft-deleted incidents
  const verificationWhere = {
    assignedTo: volunteerId,
    incident: {
      deletedAt: null,
      ...(status && { status }),
    },
  };

  // Promise.all not $transaction — independent reads
  const [verifications, totalRecords] = await Promise.all([
    prisma.incidentVerification.findMany({
      where: verificationWhere,
      include: {
        incident: {
          include: {
            category: true,
            reporter: { select: { id: true, name: true } },
            media: { select: { id: true, mediaType: true, url: true } },
            _count: { select: { missions: true } },
          },
        },
        assigner: { select: { id: true, name: true } },
      },
      orderBy: { assignedAt: "desc" },
      skip,
      take: perPage,
    }),
    prisma.incidentVerification.count({ where: verificationWhere }),
  ]);

  return {
    assignments: verifications.map((v) => ({
      verificationId: v.id,
      assignedAt: v.assignedAt,
      assignedBy: v.assigner,
      submittedAt: v.submittedAt,
      decision: v.decision,
      comment: v.comment,
      isConfirmed: v.isConfirmed,
      confirmedAt: v.confirmedAt,
      confirmNote: v.confirmNote,
      incident: v.incident,
    })),
    pagination: {
      totalRecords,
      totalPages: Math.ceil(totalRecords / perPage),
      currentPage: page,
      perPage,
    },
  };
}

// Update Incident Status
// Close Incident by Reporter
// Allows the civilian who reported the incident to close it themselves with mandatory note (reason for closing) which will be stored in AuditLog.metadata
export async function closeIncidentByReporter(
  incidentId: string,
  reportedBy: string,
  note: string,
) {
  // Verify ownership
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, deletedAt: null },
  });

  if (!incident) {
    throw new IncidentNotFoundError();
  }

  if (incident.reportedBy !== reportedBy) {
    throw new ForbiddenError();
  }

  const REPORTER_CLOSEABLE: IncidentStatus[] = [
    IncidentStatus.REPORTED,
    IncidentStatus.AWAITING_VERIFICATION,
    IncidentStatus.VERIFIED,
  ];

  if (!REPORTER_CLOSEABLE.includes(incident.status)) {
    throw new InvalidStatusTransitionError(incident.status, "CLOSED");
  }

  const [updated] = await prisma.$transaction([
    prisma.incident.update({
      where: { id: incidentId },
      data: { status: IncidentStatus.CLOSED },
    }),
    // Store the closure note in AuditLog.metadata
    // The note is the reporter's explanation
    prisma.auditLog.create({
      data: {
        actorId: reportedBy,
        action: "CLOSE",
        entityType: "INCIDENT",
        entityId: incidentId,
        metadata: {
          note,
          previousStatus: incident.status,
          closedBy: "REPORTER",
        },
      },
    }),
  ]);

  return updated;
}

// By Coordinator/Director/SUPERADMIN only.
// VOLUNTEER members without COORDINATOR or DIRECTOR agency role are rejected.
export async function updateIncidentStatus(
  incidentId: string,
  newStatus: IncidentStatus,
  requesterId: string,
  requesterRole: string,
) {
  // Authority check
  if (isSuperAdmin(requesterRole)) {
    // SUPERADMIN can update any incident status
  } else if (requesterRole === "VOLUNTEER") {
    const membership = await prisma.agencyMember.findFirst({
      where: {
        userId: requesterId,
        role: { in: ["COORDINATOR", "DIRECTOR"] },
      },
      select: { agencyId: true },
    });
    if (!membership) throw new ForbiddenError();
  } else {
    // ADMIN, CIVILIAN, or any other role → no access
    throw new ForbiddenError();
  }

  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, deletedAt: null },
  });

  if (!incident) {
    throw new IncidentNotFoundError();
  }

  validateStatusTransition(incident.status, newStatus);

  const updated = await prisma.incident.update({
    where: { id: incidentId },
    data: { status: newStatus },
  });

  // Notify the reporter of status change (if reporter exists)
  if (incident.reportedBy) {
    emitNotification({
      userId: incident.reportedBy,
      type: "INCIDENT_STATUS_UPDATED",
      title: "Incident Status Updated",
      message: `Your incident status has been updated to ${newStatus}.`,
      referenceType: "INCIDENT",
      referenceId: incidentId,
    });
  }

  return updated;
}

// Prevents jumping status e.g. REPORTED directly to RESOLVED.
const ALLOWED_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  REPORTED: [IncidentStatus.AWAITING_VERIFICATION, IncidentStatus.CLOSED],
  AWAITING_VERIFICATION: [
    IncidentStatus.VERIFIED,
    IncidentStatus.UNREACHABLE,
    IncidentStatus.FALSE_REPORT,
  ],
  VERIFIED: [IncidentStatus.RESOLVED, IncidentStatus.CLOSED],
  UNREACHABLE: [IncidentStatus.AWAITING_VERIFICATION, IncidentStatus.CLOSED],
  FALSE_REPORT: [IncidentStatus.CLOSED],
  RESOLVED: [IncidentStatus.CLOSED],
  CLOSED: [],
};

function validateStatusTransition(
  current: IncidentStatus,
  next: IncidentStatus,
) {
  const allowed = ALLOWED_TRANSITIONS[current];

  if (!allowed.includes(next)) {
    throw new InvalidStatusTransitionError(current, next);
  }
}
