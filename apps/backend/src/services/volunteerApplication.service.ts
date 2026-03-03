import { prisma } from "../lib/prisma";
import type {
  SubmitApplicationInput,
  UpdateApplicationInput,
  ReviewApplicationInput,
} from "../validators/volunteerApplication.validator";
import {
  AgencyNotFoundError,
  ApplicationAlreadyActiveError,
  ApplicationNotFoundError,
  ApplicationNotEditableError,
  ApplicationNotReviewableError,
  ApplicationNotStartableError,
  ReviewNotAllowedError,
  CannotWithdrawError,
  ForbiddenError,
  InvalidSkillIdsError,
} from "../utils/errors";
import { isSuperAdmin } from "../middlewares/auth.middleware";
import { emitNotification, emitToMany } from "../utils/notificationEmitter";

// Submit a new volunteer application
export async function submitApplication(
  userId: string,
  data: SubmitApplicationInput,
) {
  // 1. Agency check
  const agency = await prisma.agency.findUnique({
    where: { id: data.agencyId },
  });
  if (!agency) throw new AgencyNotFoundError();

  // 2. Active application check
  const existing = await prisma.volunteerApplication.findFirst({
    where: {
      userId,
      status: { in: ["PENDING", "UNDER_REVIEW", "APPROVED"] },
    },
    include: { agency: { select: { name: true } } },
  });
  if (existing) throw new ApplicationAlreadyActiveError(existing.agency.name);

  // 3. Skill validation
  const foundSkills = await prisma.skill.findMany({
    where: { id: { in: data.skillIds } },
    select: { id: true },
  });
  const unknownIds = data.skillIds.filter(
    (id) => !foundSkills.some((s) => s.id === id),
  );
  if (unknownIds.length > 0) throw new InvalidSkillIdsError(unknownIds);

  // 4. Create application, upsert profile, set skills
  const application = await prisma.$transaction(async (tx) => {
    const app = await tx.volunteerApplication.create({
      data: {
        userId,
        agencyId: data.agencyId,
        status: "PENDING",
        dateOfBirth: new Date(data.dateOfBirth),
        nationalIdNumber: data.nationalIdNumber,
        nationalIdUrl: data.nationalIdUrl,
        address: data.address,
        hasTransport: data.hasTransport,
        experience: data.experience ?? null,
        consentGiven: true,
        consentGivenAt: new Date(),
        certificates: {
          create:
            data.certificates?.map((c) => ({
              name: c.name,
              fileUrl: c.fileUrl,
              issuedBy: c.issuedBy ?? null,
              issuedAt: c.issuedAt ? new Date(c.issuedAt) : null,
            })) ?? [],
        },
      },
      include: {
        certificates: true,
        agency: { select: { id: true, name: true } },
      },
    });

    // Upsert VolunteerProfile
    await tx.volunteerProfile.upsert({
      where: { userId },
      create: { userId, isAvailable: false },
      update: {},
    });

    // Delete existing skills
    await tx.volunteerSkill.deleteMany({ where: { volunteerId: userId } });

    // Insert new skills
    await tx.volunteerSkill.createMany({
      data: data.skillIds.map((skillId) => ({
        volunteerId: userId,
        skillId,
      })),
    });

    return app;
  });

  // Notify agency coordinators/directors of the new application
  const staffMembers = await prisma.agencyMember.findMany({
    where: {
      agencyId: data.agencyId,
      role: { in: ["COORDINATOR", "DIRECTOR"] },
    },
    select: { userId: true },
  });
  emitToMany(
    staffMembers.map((m) => m.userId),
    "APPLICATION_SUBMITTED",
    "New Volunteer Application",
    `A new volunteer application has been submitted for ${agency.name}.`,
    { type: "APPLICATION", id: application.id },
  );

  return application;
}

// Update an application (only while PENDING)
export async function updateApplication(
  applicationId: string,
  userId: string,
  data: UpdateApplicationInput,
) {
  // 1. Find application
  const application = await prisma.volunteerApplication.findUnique({
    where: { id: applicationId },
  });
  if (!application) throw new ApplicationNotFoundError();

  // 2. Ownership check
  if (application.userId !== userId) throw new ForbiddenError();

  // 3. Status check
  if (application.status !== "PENDING") throw new ApplicationNotEditableError();

  // 4. Skill validation (only if provided)
  if (data.skillIds) {
    const foundSkills = await prisma.skill.findMany({
      where: { id: { in: data.skillIds } },
      select: { id: true },
    });
    const unknownIds = data.skillIds.filter(
      (id) => !foundSkills.some((s) => s.id === id),
    );
    if (unknownIds.length > 0) throw new InvalidSkillIdsError(unknownIds);
  }

  // 5. Update application, replace certificates & skills
  await prisma.$transaction(async (tx) => {
    // Update application fields
    await tx.volunteerApplication.update({
      where: { id: applicationId },
      data: {
        ...(data.dateOfBirth && { dateOfBirth: new Date(data.dateOfBirth) }),
        ...(data.nationalIdNumber && {
          nationalIdNumber: data.nationalIdNumber,
        }),
        ...(data.nationalIdUrl && { nationalIdUrl: data.nationalIdUrl }),
        ...(data.address && { address: data.address }),
        ...(data.hasTransport !== undefined && {
          hasTransport: data.hasTransport,
        }),
        ...(data.experience && { experience: data.experience }),
      },
    });

    // Replace certificates if provided
    if (data.certificates) {
      await tx.applicationCertificate.deleteMany({
        where: { applicationId },
      });
      await tx.applicationCertificate.createMany({
        data: data.certificates.map((c) => ({
          applicationId,
          name: c.name,
          fileUrl: c.fileUrl,
          issuedBy: c.issuedBy ?? null,
          issuedAt: c.issuedAt ? new Date(c.issuedAt) : null,
        })),
      });
    }

    // Replace skills if provided
    if (data.skillIds) {
      await tx.volunteerSkill.deleteMany({ where: { volunteerId: userId } });
      await tx.volunteerSkill.createMany({
        data: data.skillIds.map((skillId) => ({
          volunteerId: userId,
          skillId,
        })),
      });
    }
  });

  // 6. Re-fetch with certificates + agency included
  return prisma.volunteerApplication.findUnique({
    where: { id: applicationId },
    include: {
      certificates: true,
      agency: { select: { id: true, name: true } },
    },
  });
}

// Withdraw an application (only while PENDING)
export async function withdrawApplication(
  applicationId: string,
  userId: string,
) {
  // 1. Find application
  const application = await prisma.volunteerApplication.findUnique({
    where: { id: applicationId },
  });
  if (!application) throw new ApplicationNotFoundError();

  // 2. Ownership check
  if (application.userId !== userId) throw new ForbiddenError();

  // 3. Status check
  if (application.status !== "PENDING") throw new CannotWithdrawError();

  // 4. Update status
  const updated = await prisma.volunteerApplication.update({
    where: { id: applicationId },
    data: { status: "WITHDRAWN" },
  });

  return {
    application: updated,
    message: "Application withdrawn successfully.",
  };
}

// Get all applications for the current user
export async function getMyApplications(userId: string) {
  return prisma.volunteerApplication.findMany({
    where: { userId },
    include: {
      agency: { select: { id: true, name: true, region: true } },
      certificates: true,
      _count: { select: { certificates: true } },
    },
    orderBy: { submittedAt: "desc" },
  });
}

// PII select / omit helpers
// Full PII: SUPERADMIN, COORDINATOR, DIRECTOR (own agency), CIVILIAN (own)
const FULL_PII_APPLICANT_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  profileImageUrl: true,
} as const;

// No PII: ADMIN (oversight only)
const LIMITED_APPLICANT_SELECT = {
  id: true,
  name: true,
} as const;

// Application-level PII fields — omit for ADMIN via Prisma `omit`
const APPLICATION_PII_OMIT = {
  dateOfBirth: true,
  nationalIdNumber: true,
  nationalIdUrl: true,
  address: true,
} as const;

// List applications (agency / admin view) with role-based scoping & PII
export async function listApplications(
  requesterId: string,
  requesterRole: string,
  query: {
    agencyId?: string;
    status?: string;
    page: number;
    perPage: number;
  },
) {
  const { page, perPage } = query;
  const skip = (page - 1) * perPage;

  // Step 1: Determine scope & PII level
  let scopedAgencyId: string | null = null;
  let applicantSelect: Record<string, boolean>;
  let stripPii = false;

  if (isSuperAdmin(requesterRole)) {
    // All agencies, full PII
    scopedAgencyId = query.agencyId ?? null;
    applicantSelect = { ...FULL_PII_APPLICANT_SELECT };
  } else if (requesterRole === "ADMIN") {
    // All agencies, no PII
    scopedAgencyId = query.agencyId ?? null;
    applicantSelect = { ...LIMITED_APPLICANT_SELECT };
    stripPii = true;
  } else if (requesterRole === "VOLUNTEER") {
    // Must be COORDINATOR or DIRECTOR — scoped to own agency
    const membership = await prisma.agencyMember.findFirst({
      where: { userId: requesterId, role: { in: ["COORDINATOR", "DIRECTOR"] } },
    });

    if (
      !membership ||
      (query.agencyId && query.agencyId !== membership.agencyId)
    ) {
      throw new ForbiddenError();
    }

    scopedAgencyId = membership.agencyId;
    applicantSelect = { ...FULL_PII_APPLICANT_SELECT };
  } else {
    // CIVILIAN or unknown
    throw new ForbiddenError();
  }

  // Step 2: Build where clause
  const where: Record<string, unknown> = {};

  if (scopedAgencyId) {
    where.agencyId = scopedAgencyId;
  }

  if (query.status) {
    where.status = query.status;
  }

  // Step 3: Query with pagination
  // PII fields on the application itself are excluded via Prisma `omit`
  // so they never reach the Node process for unauthorised roles.
  const includeArgs = {
    applicant: { select: applicantSelect },
    agency: { select: { id: true, name: true, region: true } },
    _count: { select: { certificates: true } },
  };

  const [applications, totalRecords] = await Promise.all([
    stripPii
      ? prisma.volunteerApplication.findMany({
          where,
          omit: APPLICATION_PII_OMIT,
          include: includeArgs,
          orderBy: { submittedAt: "desc" },
          skip,
          take: perPage,
        })
      : prisma.volunteerApplication.findMany({
          where,
          include: includeArgs,
          orderBy: { submittedAt: "desc" },
          skip,
          take: perPage,
        }),
    prisma.volunteerApplication.count({ where }),
  ]);

  return {
    applications,
    pagination: {
      totalRecords,
      totalPages: Math.ceil(totalRecords / perPage),
      currentPage: page,
      perPage,
    },
  };
}

// Get a single application by ID (scoped by role with PII control)
export async function getApplicationById(
  applicationId: string,
  requesterId: string,
  requesterRole: string,
) {
  // Step 1: Determine PII level & scope
  let applicantSelect: Record<string, boolean>;
  let scopedAgencyId: string | null = null;
  let stripPii = false;

  if (isSuperAdmin(requesterRole)) {
    applicantSelect = { ...FULL_PII_APPLICANT_SELECT };
  } else if (requesterRole === "ADMIN") {
    applicantSelect = { ...LIMITED_APPLICANT_SELECT };
    stripPii = true;
  } else if (requesterRole === "VOLUNTEER") {
    const membership = await prisma.agencyMember.findFirst({
      where: { userId: requesterId, role: { in: ["COORDINATOR", "DIRECTOR"] } },
    });

    if (!membership) {
      throw new ForbiddenError();
    }

    scopedAgencyId = membership.agencyId;
    applicantSelect = { ...FULL_PII_APPLICANT_SELECT };
  } else if (requesterRole === "CIVILIAN") {
    // Civilian can only view their own — handled below
    applicantSelect = { ...FULL_PII_APPLICANT_SELECT };
  } else {
    throw new ForbiddenError();
  }

  // Step 2: Fetch application
  // PII fields on the application itself excluded via Prisma `omit` for ADMIN
  const includeArgs = {
    certificates: true as const,
    agency: { select: { id: true, name: true } },
    applicant: { select: applicantSelect },
  };

  const application = stripPii
    ? await prisma.volunteerApplication.findUnique({
        where: { id: applicationId },
        omit: APPLICATION_PII_OMIT,
        include: includeArgs,
      })
    : await prisma.volunteerApplication.findUnique({
        where: { id: applicationId },
        include: includeArgs,
      });
  if (!application) throw new ApplicationNotFoundError();

  // Step 3: Access control
  // Civilian can only view their own — 404 not 403 to avoid leaking existence
  if (requesterRole === "CIVILIAN" && application.userId !== requesterId) {
    throw new ApplicationNotFoundError();
  }

  // COORDINATOR/DIRECTOR can only view their own agency's applications
  if (scopedAgencyId && application.agencyId !== scopedAgencyId) {
    throw new ApplicationNotFoundError();
  }

  return application;
}

// Start review — claim a PENDING application as UNDER_REVIEW
export async function startReview(
  applicationId: string,
  reviewerId: string,
  reviewerRole: string,
) {
  // Step 1: Resolve reviewer authority (same as reviewApplication)
  let scopedAgencyId: string | null = null;

  if (isSuperAdmin(reviewerRole)) {
    scopedAgencyId = null;
  } else if (reviewerRole === "VOLUNTEER") {
    const membership = await prisma.agencyMember.findFirst({
      where: { userId: reviewerId, role: { in: ["COORDINATOR", "DIRECTOR"] } },
    });

    if (!membership) {
      throw new ReviewNotAllowedError();
    }

    scopedAgencyId = membership.agencyId;
  } else {
    // ADMIN has oversight only, CIVILIAN cannot review
    throw new ReviewNotAllowedError();
  }

  // Step 2: Find application
  const application = await prisma.volunteerApplication.findUnique({
    where: { id: applicationId },
  });
  if (!application) throw new ApplicationNotFoundError();

  // Step 3: Agency scope check
  if (scopedAgencyId && application.agencyId !== scopedAgencyId) {
    throw new ApplicationNotFoundError();
  }

  // Step 4: Status guard — only PENDING can be started
  if (application.status !== "PENDING" || application.reviewedBy !== null) {
    throw new ApplicationNotStartableError(application.status);
  }

  // Step 5: Claim application as UNDER_REVIEW
  const updated = await prisma.volunteerApplication.update({
    where: { id: applicationId },
    data: {
      status: "UNDER_REVIEW",
      reviewedBy: reviewerId,
    },
    include: {
      applicant: { select: FULL_PII_APPLICANT_SELECT },
      agency: { select: { id: true, name: true } },
    },
  });

  // Notify applicant that their application is being reviewed
  emitNotification({
    userId: application.userId,
    type: "APPLICATION_REVIEWED",
    title: "Application Under Review",
    message: `Your volunteer application for ${updated.agency.name} is now being reviewed.`,
    referenceType: "APPLICATION",
    referenceId: applicationId,
  });

  return updated;
}

// Review (approve/reject) a volunteer application
export async function reviewApplication(
  applicationId: string,
  reviewerId: string,
  reviewerRole: string,
  data: ReviewApplicationInput,
) {
  // Step 1: Resolve reviewer's agency authority
  let scopedAgencyId: string | null = null;

  if (isSuperAdmin(reviewerRole)) {
    // SUPERADMIN can review any application
    scopedAgencyId = null;
  } else if (reviewerRole === "VOLUNTEER") {
    // Check AgencyMember role
    const membership = await prisma.agencyMember.findFirst({
      where: { userId: reviewerId, role: { in: ["COORDINATOR", "DIRECTOR"] } },
    });

    if (!membership) {
      throw new ReviewNotAllowedError();
    }

    // COORDINATOR or DIRECTOR — allowed, scoped to their agency
    scopedAgencyId = membership.agencyId;
  } else {
    // ADMIN has oversight only — no operational authority. CIVILIAN cannot review.
    throw new ReviewNotAllowedError();
  }

  // Step 2: Find and validate the application
  const application = await prisma.volunteerApplication.findUnique({
    where: { id: applicationId },
    include: {
      applicant: { select: FULL_PII_APPLICANT_SELECT },
      agency: { select: { id: true, name: true } },
    },
  });
  if (!application) throw new ApplicationNotFoundError();

  // Scope check — non-SUPERADMIN can only review their own agency's applications
  if (scopedAgencyId && application.agencyId !== scopedAgencyId) {
    throw new ApplicationNotFoundError();
  }

  // Step 3: Status check — only UNDER_REVIEW can be reviewed
  if (
    application.status !== "UNDER_REVIEW" ||
    application.reviewedBy !== reviewerId
  ) {
    throw new ApplicationNotReviewableError(application.status);
  }

  // Step 4: Branch on decision
  if (data.decision === "REJECTED") {
    const updated = await prisma.volunteerApplication.update({
      where: { id: applicationId },
      data: {
        status: "REJECTED",
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNote: data.reviewNote,
      },
      include: {
        applicant: { select: FULL_PII_APPLICANT_SELECT },
        agency: { select: { id: true, name: true } },
      },
    });

    // Notify applicant of rejection
    emitNotification({
      userId: application.userId,
      type: "APPLICATION_REVIEWED",
      title: "Application Rejected",
      message: `Your volunteer application for ${application.agency.name} has been rejected.`,
      referenceType: "APPLICATION",
      referenceId: applicationId,
    });

    return updated;
  }

  // APPROVED — atomic transaction across multiple tables
  const updated = await prisma.$transaction(async (tx) => {
    // Update application status
    const approvedApp = await tx.volunteerApplication.update({
      where: { id: applicationId },
      data: {
        status: "APPROVED",
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNote: data.reviewNote ?? null,
      },
      include: {
        applicant: { select: FULL_PII_APPLICANT_SELECT },
        agency: { select: { id: true, name: true } },
      },
    });

    // Resolve VOLUNTEER role ID
    const volunteerRole = await tx.role.findUniqueOrThrow({
      where: { name: "VOLUNTEER" },
    });

    // Resolve CIVILIAN role ID
    const civilianRole = await tx.role.findUniqueOrThrow({
      where: { name: "CIVILIAN" },
    });

    // Delete existing CIVILIAN UserRole
    await tx.userRole.delete({
      where: {
        userId_roleId: {
          userId: application.userId,
          roleId: civilianRole.id,
        },
      },
    });

    // Insert VOLUNTEER UserRole
    await tx.userRole.create({
      data: {
        userId: application.userId,
        roleId: volunteerRole.id,
      },
    });

    // Create AgencyMember record
    await tx.agencyMember.create({
      data: {
        agencyId: application.agencyId,
        userId: application.userId,
        role: "MEMBER",
      },
    });

    // Safety upsert VolunteerProfile
    await tx.volunteerProfile.upsert({
      where: { userId: application.userId },
      create: { userId: application.userId, isAvailable: false },
      update: {},
    });

    return approvedApp;
  });

  // Notify applicant of approval
  emitNotification({
    userId: application.userId,
    type: "APPLICATION_REVIEWED",
    title: "Application Approved",
    message: `Your volunteer application for ${application.agency.name} has been approved! Welcome to the team.`,
    referenceType: "APPLICATION",
    referenceId: applicationId,
  });

  return updated;
}
