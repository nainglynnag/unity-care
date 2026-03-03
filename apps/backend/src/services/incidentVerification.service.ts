import { prisma } from "../lib/prisma";
import {
  IncidentStatus,
  VerificationDecision,
} from "../../generated/prisma/client";
import { broadcastNotification } from "../ws/broadcast";
import { emitNotification } from "../utils/notificationEmitter";
import { isSuperAdmin } from "../middlewares/auth.middleware";
import {
  IncidentNotFoundError,
  IncidentNotAssignableError,
  IncidentNotRetryableError,
  IncidentNotAwaitingVerificationError,
  VerificationNotFoundError,
  VerificationAlreadyAssignedError,
  NotAssignedVerifierError,
  VolunteerNotAvailableError,
  VolunteerNotInAgencyError,
  ForbiddenError,
} from "../utils/errors";
import type {
  AssignVerifierInput,
  SubmitVerificationInput,
  ConfirmVerificationInput,
} from "../validators/incidentVerification.validator";

// Returns agencyId for COORDINATOR/DIRECTOR, null for SUPERADMIN.
// Throws ForbiddenError for ADMIN, CIVILIAN, MEMBER, or unauthenticated.
async function resolveAgencyAuthority(
  requesterId: string,
  requesterRole: string,
): Promise<string | null> {
  if (isSuperAdmin(requesterRole)) return null;

  if (requesterRole === "VOLUNTEER") {
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

  // ADMIN has oversight only, CIVILIAN has no authority
  throw new ForbiddenError();
}

// Validates the target volunteer is available and belongs to the assigning agency.
// agencyId is null for SUPERADMIN (skip agency scope check).
async function validateVolunteerForAssignment(
  volunteerId: string,
  agencyId: string | null,
): Promise<void> {
  const profile = await prisma.volunteerProfile.findUnique({
    where: { userId: volunteerId },
  });

  if (!profile || !profile.isAvailable) {
    throw new VolunteerNotAvailableError();
  }

  if (agencyId) {
    const membership = await prisma.agencyMember.findFirst({
      where: { userId: volunteerId, agencyId },
    });
    if (!membership) throw new VolunteerNotInAgencyError();
  }
}

// Maps volunteer's VerificationDecision to IncidentStatus
const DECISION_TO_STATUS: Record<VerificationDecision, IncidentStatus> = {
  VERIFIED: IncidentStatus.VERIFIED,
  UNREACHABLE: IncidentStatus.UNREACHABLE,
  FALSE_REPORT: IncidentStatus.FALSE_REPORT,
};

// Assign a volunteer to verify an incident (from REPORTED status)
export async function assignVerifier(
  incidentId: string,
  assignerId: string,
  assignerRole: string,
  data: AssignVerifierInput,
) {
  // 1. Resolve authority
  const agencyId = await resolveAgencyAuthority(assignerId, assignerRole);

  // 2. Find incident
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, deletedAt: null },
  });
  if (!incident) throw new IncidentNotFoundError();

  // Only from REPORTED (retryVerification handles UNREACHABLE)
  if (incident.status !== IncidentStatus.REPORTED) {
    throw new IncidentNotAssignableError(incident.status);
  }

  // 3. No active (unsubmitted) assignment already exists
  const existing = await prisma.incidentVerification.findFirst({
    where: { incidentId, submittedAt: null },
  });
  if (existing) throw new VerificationAlreadyAssignedError();

  // 4. Validate volunteer
  await validateVolunteerForAssignment(data.volunteerId, agencyId);

  // 5. $transaction: create assignment + advance status + notify
  const [verification] = await prisma.$transaction([
    prisma.incidentVerification.create({
      data: {
        incidentId,
        assignedTo: data.volunteerId,
        assignedBy: assignerId,
        assignedAt: new Date(),
      },
      include: {
        assignee: { select: { id: true, name: true } },
        assigner: { select: { id: true, name: true } },
        incident: { select: { id: true, title: true, status: true } },
      },
    }),

    prisma.incident.update({
      where: { id: incidentId },
      data: { status: IncidentStatus.AWAITING_VERIFICATION },
    }),

    prisma.notification.create({
      data: {
        userId: data.volunteerId,
        type: "VERIFICATION_REQUESTED",
        title: "Verification Assignment",
        message: `You have been assigned to verify incident: "${incident.title}". Please go on-site and submit your result.`,
        referenceType: "INCIDENT",
        referenceId: incidentId,
      },
    }),
  ]);

  // WS broadcast (after transaction committed)
  broadcastNotification(data.volunteerId, {
    id: "",
    type: "VERIFICATION_REQUESTED",
    title: "Verification Assignment",
    message: `You have been assigned to verify incident: "${incident.title}". Please go on-site and submit your result.`,
    referenceType: "INCIDENT",
    referenceId: incidentId,
    isRead: false,
    createdAt: new Date(),
  });

  // Notify the reporter that their incident is being verified
  if (incident.reportedBy) {
    emitNotification({
      userId: incident.reportedBy,
      type: "INCIDENT_STATUS_UPDATED",
      title: "Incident Verification Started",
      message: `A volunteer has been assigned to verify your incident: "${incident.title}". We will update you with the result.`,
      referenceType: "INCIDENT",
      referenceId: incidentId,
    });
  }

  return verification;
}

// Volunteer submits on-site verification result (no incident status change yet)
export async function submitVerification(
  incidentId: string,
  verifierId: string,
  data: SubmitVerificationInput,
) {
  // 1. Find active assignment (exists + not yet submitted)
  const verification = await prisma.incidentVerification.findFirst({
    where: { incidentId, submittedAt: null },
    include: {
      incident: { select: { id: true, title: true, status: true } },
      assignee: { select: { id: true, name: true } },
    },
  });
  if (!verification) throw new VerificationNotFoundError();

  // 2. Only the assigned volunteer can submit
  if (verification.assignedTo !== verifierId) {
    throw new NotAssignedVerifierError();
  }

  // 3. Incident must still be AWAITING_VERIFICATION (guard against closed/advanced)
  if (verification.incident.status !== IncidentStatus.AWAITING_VERIFICATION) {
    throw new IncidentNotAwaitingVerificationError(
      verification.incident.status,
    );
  }

  // 4. $transaction: record submission + attach media + notify assigner
  // Incident status does NOT change here.
  // The coordinator confirms the submission -> that triggers the status change.
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.incidentVerification.update({
      where: { id: verification.id },
      data: {
        decision: data.decision as VerificationDecision,
        verifiedBy: verifierId,
        submittedAt: new Date(),
        comment: data.comment ?? null,
      },
      include: {
        assignee: { select: { id: true, name: true } },
        assigner: { select: { id: true, name: true } },
        incident: { select: { id: true, title: true, status: true } },
      },
    });

    // Attach evidence media if provided
    if (data.media && data.media.length > 0) {
      await tx.incidentMedia.createMany({
        data: data.media.map((m) => ({
          incidentId,
          uploadedBy: verifierId,
          url: m.url,
          mediaType: m.mediaType,
        })),
      });
    }

    // Notify the COORDINATOR/DIRECTOR who assigned this verification
    if (verification.assignedBy) {
      await tx.notification.create({
        data: {
          userId: verification.assignedBy,
          type: "VERIFICATION_COMPLETED",
          title: "Verification Result Submitted",
          message: `${verification.assignee?.name} submitted result for "${verification.incident.title}": ${data.decision}.${data.comment ? ` Note: ${data.comment}` : ""}`,
          referenceType: "INCIDENT",
          referenceId: incidentId,
        },
      });
    }

    return result;
  });

  // WS broadcast (after transaction committed)
  if (verification.assignedBy) {
    broadcastNotification(verification.assignedBy, {
      id: "",
      type: "VERIFICATION_COMPLETED",
      title: "Verification Result Submitted",
      message: `${verification.assignee?.name} submitted result for "${verification.incident.title}": ${data.decision}.${data.comment ? ` Note: ${data.comment}` : ""}`,
      referenceType: "INCIDENT",
      referenceId: incidentId,
      isRead: false,
      createdAt: new Date(),
    });
  }

  return updated;
}

// Coordinator confirms or rejects volunteer's verification result
export async function confirmVerification(
  incidentId: string,
  confirmerId: string,
  confirmerRole: string,
  data: ConfirmVerificationInput,
) {
  // 1. Resolve authority
  const agencyId = await resolveAgencyAuthority(confirmerId, confirmerRole);

  // 2. Find submitted-but-unconfirmed verification
  const verification = await prisma.incidentVerification.findFirst({
    where: {
      incidentId,
      submittedAt: { not: null },
      isConfirmed: null,
    },
    include: {
      incident: { select: { id: true, title: true, status: true } },
      assignee: { select: { id: true, name: true } },
    },
  });

  if (!verification) throw new VerificationNotFoundError();

  // 3. Agency scope check (non-SUPERADMIN)
  if (agencyId && verification.assignedBy) {
    const assignerMembership = await prisma.agencyMember.findFirst({
      where: { userId: verification.assignedBy, agencyId },
    });
    if (!assignerMembership) throw new VerificationNotFoundError();
  }

  // 4. Branch: confirmed vs rejected
  if (data.confirmed) {
    // confirmed=true -> advance incident status based on volunteer's decision
    const newStatus = DECISION_TO_STATUS[verification.decision!];

    const [updated] = await prisma.$transaction([
      prisma.incidentVerification.update({
        where: { id: verification.id },
        data: {
          isConfirmed: true,
          confirmedBy: confirmerId,
          confirmedAt: new Date(),
          confirmNote: data.confirmNote ?? null,
        },
        include: {
          assignee: { select: { id: true, name: true } },
          incident: { select: { id: true, title: true, status: true } },
        },
      }),

      // Incident status NOW changes
      prisma.incident.update({
        where: { id: incidentId },
        data: { status: newStatus },
      }),

      // Notify volunteer their result was accepted
      prisma.notification.create({
        data: {
          userId: verification.assignedTo!,
          type: "INCIDENT_STATUS_UPDATED",
          title: "Verification Confirmed",
          message: `Your verification result for "${verification.incident.title}" has been confirmed as ${verification.decision}.`,
          referenceType: "INCIDENT",
          referenceId: incidentId,
        },
      }),
    ]);

    // WS broadcast (after transaction committed)
    broadcastNotification(verification.assignedTo!, {
      id: "",
      type: "INCIDENT_STATUS_UPDATED",
      title: "Verification Confirmed",
      message: `Your verification result for "${verification.incident.title}" has been confirmed as ${verification.decision}.`,
      referenceType: "INCIDENT",
      referenceId: incidentId,
      isRead: false,
      createdAt: new Date(),
    });

    // Notify the reporter of the verification outcome
    const confirmedIncident = await prisma.incident.findUnique({
      where: { id: incidentId },
      select: { reportedBy: true, title: true },
    });
    if (confirmedIncident?.reportedBy) {
      emitNotification({
        userId: confirmedIncident.reportedBy,
        type: "INCIDENT_STATUS_UPDATED",
        title: "Incident Verification Result",
        message: `Your incident "${confirmedIncident.title}" has been verified as ${verification.decision}.`,
        referenceType: "INCIDENT",
        referenceId: incidentId,
      });
    }

    return updated;
  }

  // confirmed=false -> reject submission, create new assignment for same volunteer
  // Incident status stays AWAITING_VERIFICATION
  const [, created] = await prisma.$transaction([
    // Mark old record as rejected
    prisma.incidentVerification.update({
      where: { id: verification.id },
      data: {
        isConfirmed: false,
        confirmedBy: confirmerId,
        confirmedAt: new Date(),
        confirmNote: data.confirmNote,
      },
    }),

    // Create a new blank assignment for the same volunteer so they can resubmit
    prisma.incidentVerification.create({
      data: {
        incidentId,
        assignedTo: verification.assignedTo,
        assignedBy: confirmerId,
        assignedAt: new Date(),
      },
      include: {
        assignee: { select: { id: true, name: true } },
        assigner: { select: { id: true, name: true } },
        incident: { select: { id: true, title: true, status: true } },
      },
    }),

    // Notify volunteer their submission was rejected with the reason
    prisma.notification.create({
      data: {
        userId: verification.assignedTo!,
        type: "VERIFICATION_COMPLETED",
        title: "Verification Result Rejected",
        message: `Your verification result for "${verification.incident.title}" was not accepted. Reason: ${data.confirmNote}. Please re-assess and resubmit.`,
        referenceType: "INCIDENT",
        referenceId: incidentId,
      },
    }),
  ]);

  // WS broadcast (after transaction committed)
  broadcastNotification(verification.assignedTo!, {
    id: "",
    type: "VERIFICATION_COMPLETED",
    title: "Verification Result Rejected",
    message: `Your verification result for "${verification.incident.title}" was not accepted. Reason: ${data.confirmNote}. Please re-assess and resubmit.`,
    referenceType: "INCIDENT",
    referenceId: incidentId,
    isRead: false,
    createdAt: new Date(),
  });

  return created;
}

// Retry verification from UNREACHABLE status (new volunteer, new record)
export async function retryVerification(
  incidentId: string,
  assignerId: string,
  assignerRole: string,
  data: AssignVerifierInput,
) {
  // 1. Resolve authority
  const agencyId = await resolveAgencyAuthority(assignerId, assignerRole);

  // 2. Find incident (must be UNREACHABLE)
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, deletedAt: null },
    include: {
      verifications: {
        select: { decision: true, submittedAt: true },
        orderBy: { submittedAt: "desc" },
      },
    },
  });
  if (!incident) throw new IncidentNotFoundError();

  const lastVerification = incident.verifications[0];
  if (
    !lastVerification ||
    lastVerification.decision !== IncidentStatus.UNREACHABLE
  ) {
    throw new IncidentNotRetryableError(incident.status);
  }

  // 3. No active (unsubmitted) assignment
  const existing = await prisma.incidentVerification.findFirst({
    where: { incidentId, submittedAt: null },
  });
  if (existing) throw new VerificationAlreadyAssignedError();

  // 4. Validate new volunteer
  await validateVolunteerForAssignment(data.volunteerId, agencyId);

  // 5. $transaction: new record + reset status + notify
  // Old records preserved as audit history
  const [verification] = await prisma.$transaction([
    prisma.incidentVerification.create({
      data: {
        incidentId,
        assignedTo: data.volunteerId,
        assignedBy: assignerId,
        assignedAt: new Date(),
      },
      include: {
        assignee: { select: { id: true, name: true } },
        assigner: { select: { id: true, name: true } },
        incident: { select: { id: true, title: true, status: true } },
      },
    }),

    prisma.incident.update({
      where: { id: incidentId },
      data: { status: IncidentStatus.AWAITING_VERIFICATION },
    }),

    prisma.notification.create({
      data: {
        userId: data.volunteerId,
        type: "VERIFICATION_REQUESTED",
        title: "Verification Retry Assignment",
        message: `You have been assigned to re-verify incident: "${incident.title}". A previous attempt was marked UNREACHABLE. Please assess and submit your result.`,
        referenceType: "INCIDENT",
        referenceId: incidentId,
      },
    }),
  ]);

  // WS broadcast (after transaction committed)
  broadcastNotification(data.volunteerId, {
    id: "",
    type: "VERIFICATION_REQUESTED",
    title: "Verification Retry Assignment",
    message: `You have been assigned to re-verify incident: "${incident.title}". A previous attempt was marked UNREACHABLE. Please assess and submit your result.`,
    referenceType: "INCIDENT",
    referenceId: incidentId,
    isRead: false,
    createdAt: new Date(),
  });

  return verification;
}

// Get all verification records for an incident (full history)
export async function getVerificationsByIncident(
  incidentId: string,
  requesterId: string,
  requesterRole: string,
) {
  // 1. Incident exists
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, deletedAt: null },
  });
  if (!incident) throw new IncidentNotFoundError();

  // 2. Access control
  if (requesterRole === "CIVILIAN") {
    // Civilians see only their own incidents' verifications (404 not 403)
    if (incident.reportedBy !== requesterId) {
      throw new IncidentNotFoundError();
    }
  }
  // SUPERADMIN, ADMIN, VOLUNTEER -> no further restriction

  // 3. Return all verification records ordered newest first
  return prisma.incidentVerification.findMany({
    where: { incidentId },
    include: {
      assignee: { select: { id: true, name: true } },
      assigner: { select: { id: true, name: true } },
      verifier: { select: { id: true, name: true } },
      confirmer: { select: { id: true, name: true } },
    },
    orderBy: { assignedAt: "desc" },
  });
}
