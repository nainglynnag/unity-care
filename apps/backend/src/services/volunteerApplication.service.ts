import { prisma } from "../lib/prisma";
import type {
  SubmitApplicationInput,
  UpdateApplicationInput,
} from "../validators/volunteerApplication.validator";
import {
  AgencyNotFoundError,
  ApplicationAlreadyActiveError,
  ApplicationNotFoundError,
  ApplicationNotEditableError,
  CannotWithdrawError,
  ForbiddenError,
  InvalidSkillIdsError,
} from "../utils/errors";

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

// Get a single application by ID (scoped by role)
export async function getApplicationById(
  applicationId: string,
  requesterId: string,
  requesterRole: string,
) {
  // 1. Fetch application
  const application = await prisma.volunteerApplication.findUnique({
    where: { id: applicationId },
    include: {
      certificates: true,
      agency: { select: { id: true, name: true } },
      applicant: { select: { id: true, name: true, email: true } },
    },
  });
  if (!application) throw new ApplicationNotFoundError();

  // 2. Role-scoped access
  if (requesterRole === "CIVILIAN" && application.userId !== requesterId) {
    throw new ForbiddenError();
  }

  return application;
}
