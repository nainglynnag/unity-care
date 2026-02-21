import { prisma } from "../lib/prisma";
import { AppError } from "../utils/appError";
import { IncidentStatus } from "../../generated/prisma/client";
import type {
  CreateIncidentInput,
  ListIncidentQuery,
} from "../validators/incident.validator";
import { includes } from "zod";

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
    throw new AppError(
      "CATEGORY_NOT_FOUND",
      "The selected incident category does not exist.",
      404,
    );
  }

  if (!category.isActive) {
    throw new AppError(
      "CATEGORY_INACTIVE",
      "The selected incident category is no longer active.",
      400,
    );
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

  return { incident, emergencyProfile };
}

// Get Single Incident
// Any authenticated user can view an incident they have access to Admin/Volunteer can view all incidents, Civilians can only view their own incidents
export async function getIncidentById(
  incidentId: string,
  requesterId: string,
  requesterRole: string,
) {
  const where = {
    id: incidentId,
    deletedAt: null,
    // Civilians are scoped to their own incidents only
    ...(requesterRole === "CIVILIAN" && { reportedBy: requesterId }),
  };

  const incident = await prisma.incident.findFirst({
    where,
    include: {
      category: true,
      reporter: {
        select: {
          id: true,
          name: true,
          emergencyProfile: {
            include: {
              contacts: {
                orderBy: { isPrimary: "desc" },
              },
            },
          },
        },
      },
      verifications: {
        include: {
          verifier: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      media: true,
    },
  });

  if (!incident) {
    throw new AppError(
      "INCIDENT_NOT_FOUND",
      "The requested incident could not be found.",
      404,
    );
  }

  return incident;
}

// List My Incidents
export async function listMyIncidents(
  reportedBy: string,
  query: ListIncidentQuery,
) {
  const { status, page, perPage } = query;
  const skip = (page - 1) * perPage;

  const where = {
    reportedBy,
    deletedAt: null,
    ...(status && { status }),
  };

  const [incidents, totalRecords] = await prisma.$transaction([
    prisma.incident.findMany({
      where,
      include: {
        category: true,
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

// List Incidents
export async function listIncidents(query: ListIncidentQuery) {
  const { status, categoryId, page, perPage } = query;
  const skip = (page - 1) * perPage;

  const where = {
    deletedAt: null,
    ...(status && { status }),
    ...(categoryId && { categoryId }),
  };

  const [incidents, totalRecords] = await prisma.$transaction([
    prisma.incident.findMany({
      where,
      include: {
        category: true,
        reporter: { select: { id: true, name: true } },
        _count: {
          select: { verifications: true, media: true, missions: true },
        },
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
    throw new AppError(
      "INCIDENT_NOT_FOUND",
      "The requested incident could not be found.",
      404,
    );
  }

  if (incident.reportedBy !== reportedBy) {
    throw new AppError(
      "FORBIDDEN",
      "You can only close incidents you reported.",
      403,
    );
  }

  const REPORTER_CLOSEABLE: IncidentStatus[] = [
    IncidentStatus.REPORTED,
    IncidentStatus.AWAITING_VERIFICATION,
    IncidentStatus.VERIFIED,
  ];

  if (!REPORTER_CLOSEABLE.includes(incident.status)) {
    throw new AppError(
      "INVALID_STATUS_TRANSITION",
      `You cannot close an incident at the current ${incident.status} stage.`,
      400,
    );
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

// By Admin
export async function updateIncidentStatus(
  incidentId: string,
  newStatus: IncidentStatus,
) {
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, deletedAt: null },
  });

  if (!incident) {
    throw new AppError(
      "INCIDENT_NOT_FOUND",
      "The requested incident could not be found.",
      404,
    );
  }

  validateStatusTransition(incident.status, newStatus);

  return prisma.incident.update({
    where: { id: incidentId },
    data: { status: newStatus },
  });
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
    throw new AppError(
      "INVALID_STATUS_TRANSITION",
      `Cannot transition incident from ${current} to ${next}.`,
      400,
    );
  }
}
