import bcrypt from "bcrypt";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import {
  UserNotFoundError,
  AccountAlreadyDeletedError,
  CannotTargetSelfError,
  CannotTargetSuperAdminError,
  IncorrectPasswordError,
  SamePasswordError,
  CannotDeleteVolunteerOnMissionError,
} from "../utils/errors";

import type {
  UpdateProfileInput,
  UpdatePasswordInput,
  ResetPasswordInput,
  UpdateAccountStatusInput,
  ListUsersQuery,
} from "../validators/account.validator";

// SHA-256 hash helper — mirrors auth.service.ts
function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Self-service

// GET /auth/me — returns full user profile from DB.
// Richer than the minimal JWT payload the old handler returned.
export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      profileImageUrl: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      roles: { select: { role: { select: { name: true } } } },
      agencyMemberships: {
        select: {
          role: true,
          agency: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!user) throw new UserNotFoundError();

  return {
    ...user,
    role: user.roles[0]?.role.name ?? "CIVILIAN",
    roles: undefined,
  };
}

// PATCH /account/profile — update name / profileImageUrl
export async function updateProfile(userId: string, data: UpdateProfileInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UserNotFoundError();

  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.profileImageUrl !== undefined && {
        profileImageUrl: data.profileImageUrl,
      }),
      ...(data.phone !== undefined && { phone: data.phone }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      profileImageUrl: true,
    },
  });
}

// PATCH /account/password — self-service password change
// Keeps the current session alive, revokes all others.
export async function updatePassword(
  userId: string,
  data: UpdatePasswordInput,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UserNotFoundError();

  // Verify current password
  const isMatch = await bcrypt.compare(data.currentPassword, user.passwordHash);
  if (!isMatch) throw new IncorrectPasswordError();

  // Double-check: validator already catches this, but belt-and-suspenders.
  const isSame = await bcrypt.compare(data.newPassword, user.passwordHash);
  if (isSame) throw new SamePasswordError();

  const newHash = await bcrypt.hash(data.newPassword, 12);
  const currentTokenHash = hashToken(data.refreshToken);

  // Atomic: update password + revoke all tokens EXCEPT the current session.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    }),
    prisma.refreshToken.updateMany({
      where: {
        userId,
        tokenHash: { not: currentTokenHash },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    }),
  ]);
}

// POST /auth/signout — revoke single refresh token (current device)
export async function signOut(userId: string, rawRefreshToken: string) {
  const tokenHash = hashToken(rawRefreshToken);

  const result = await prisma.refreshToken.updateMany({
    where: { userId, tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  // If no token matched, it was already revoked or invalid — no error needed.
  // The client should still clear its local storage.
  return { revokedCount: result.count };
}

// POST /auth/signout-all — revoke ALL refresh tokens for the user
export async function signOutAll(userId: string) {
  const result = await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return { revokedCount: result.count };
}

// DELETE /account — soft delete own account
// Blocked if user is assigned to an active mission (ACCEPTED / EN_ROUTE / ON_SITE / IN_PROGRESS).
export async function softDeleteAccount(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UserNotFoundError();
  if (user.deletedAt !== null) throw new AccountAlreadyDeletedError();

  // Check for active mission assignments
  const activeMission = await prisma.missionAssignment.findFirst({
    where: {
      assignedTo: userId,
      unassignedAt: null,
      mission: {
        status: { in: ["ACCEPTED", "EN_ROUTE", "ON_SITE", "IN_PROGRESS"] },
      },
    },
  });

  if (activeMission) throw new CannotDeleteVolunteerOnMissionError();

  // Soft delete + deactivate + revoke all tokens
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), isActive: false },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

// SUPERADMIN Management

// Guard helpers used by all SUPERADMIN functions.
// Throws if caller targets themselves or another SUPERADMIN.
async function guardTarget(
  callerId: string,
  targetUserId: string,
  action: string,
) {
  if (callerId === targetUserId) throw new CannotTargetSelfError(action);

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { roles: { include: { role: true } } },
  });

  if (!target) throw new UserNotFoundError();

  const targetRole = target.roles[0]?.role.name;
  if (targetRole === "SUPERADMIN") throw new CannotTargetSuperAdminError();

  return target;
}

// GET /users — paginated list of all users (including soft-deleted)
export async function listUsers(query: ListUsersQuery) {
  const { role, isActive, search, page, perPage } = query;

  const where: any = {};

  if (role) {
    where.roles = {
      some: { role: { name: role } },
    };
  }

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        profileImageUrl: true,
        isActive: true,
        createdAt: true,
        deletedAt: true,
        updatedAt: true,
        roles: { select: { role: { select: { name: true } } } },
        agencyMemberships: {
          select: {
            role: true,
            agency: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.user.count({ where }),
  ]);

  const mapped = users.map((u) => ({
    ...u,
    role: u.roles[0]?.role.name ?? "CIVILIAN",
    roles: undefined,
  }));

  const totalPages = Math.ceil(total / perPage);

  return {
    data: mapped,
    pagination: {
      totalRecords: total,
      totalPages,
      currentPage: page,
      perPage,
    },
    links: {
      self: `/api/v1/users?page=${page}&perPage=${perPage}`,
      ...(page > 1 && {
        prev: `/api/v1/users?page=${page - 1}&perPage=${perPage}`,
      }),
      ...(page < totalPages && {
        next: `/api/v1/users?page=${page + 1}&perPage=${perPage}`,
      }),
    },
  };
}

// PATCH /users/:id/password/reset — privileged credential override
export async function resetPassword(
  callerId: string,
  targetUserId: string,
  data: ResetPasswordInput,
) {
  await guardTarget(callerId, targetUserId, "reset password");

  const newHash = await bcrypt.hash(data.newPassword, 12);

  // Atomic: update password, optionally deactivate, and revoke ALL tokens.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: targetUserId },
      data: {
        passwordHash: newHash,
        ...(data.deactivate && { isActive: false }),
      },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

// PATCH /users/:id/status — activate / deactivate
export async function updateAccountStatus(
  callerId: string,
  targetUserId: string,
  data: UpdateAccountStatusInput,
) {
  await guardTarget(callerId, targetUserId, "update account status");

  const updates: any = { isActive: data.isActive };

  // Deactivating ⇒ revoke all tokens immediately
  if (!data.isActive) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUserId },
        data: updates,
      }),
      prisma.refreshToken.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  } else {
    await prisma.user.update({
      where: { id: targetUserId },
      data: updates,
    });
  }
}

// DELETE /users/:id — hard delete (SUPERADMIN only)
// Full cascade: manually deletes all owned rows, then removes the user.
// Relations with onDelete: SetNull (Incident, Mission, MissionLog, AuditLog,
// MissionIncident, VolunteerApplication.reviewer) are handled automatically
// by the DB when user.delete() runs.
export async function hardDeleteAccount(
  callerId: string,
  targetUserId: string,
) {
  await guardTarget(callerId, targetUserId, "hard delete");

  // Block if target has active mission assignments.
  const activeMission = await prisma.missionAssignment.findFirst({
    where: {
      assignedTo: targetUserId,
      unassignedAt: null,
      mission: {
        status: { in: ["ACCEPTED", "EN_ROUTE", "ON_SITE", "IN_PROGRESS"] },
      },
    },
  });

  if (activeMission) throw new CannotDeleteVolunteerOnMissionError();

  await prisma.$transaction(async (tx) => {
    // 1. Refresh tokens
    await tx.refreshToken.deleteMany({ where: { userId: targetUserId } });

    // 2. Notifications
    await tx.notification.deleteMany({ where: { userId: targetUserId } });

    // 3. Mission tracking
    await tx.missionTracking.deleteMany({
      where: { volunteerId: targetUserId },
    });

    // 4. Mission reports
    await tx.missionReport.deleteMany({
      where: { submittedBy: targetUserId },
    });

    // 5. Mission assignments (both sides)
    await tx.missionAssignment.deleteMany({
      where: {
        OR: [{ assignedTo: targetUserId }, { assignedBy: targetUserId }],
      },
    });

    // 6. Incident media
    await tx.incidentMedia.deleteMany({
      where: { uploadedBy: targetUserId },
    });

    // 7. Incident verifications (all 4 FK columns)
    await tx.incidentVerification.deleteMany({
      where: {
        OR: [
          { assignedTo: targetUserId },
          { assignedBy: targetUserId },
          { verifiedBy: targetUserId },
          { confirmedBy: targetUserId },
        ],
      },
    });

    // 8. Emergency contacts → emergency profile
    const profile = await tx.emergencyProfile.findUnique({
      where: { userId: targetUserId },
    });
    if (profile) {
      await tx.emergencyContact.deleteMany({
        where: { profileId: profile.id },
      });
      await tx.emergencyProfile.delete({ where: { userId: targetUserId } });
    }

    // 9. Volunteer skills → volunteer profile
    const volProfile = await tx.volunteerProfile.findUnique({
      where: { userId: targetUserId },
    });
    if (volProfile) {
      await tx.volunteerSkill.deleteMany({
        where: { volunteerId: targetUserId },
      });
      await tx.volunteerProfile.delete({ where: { userId: targetUserId } });
    }

    // 10. Application certificates → volunteer applications
    const apps = await tx.volunteerApplication.findMany({
      where: { userId: targetUserId },
      select: { id: true },
    });
    if (apps.length > 0) {
      const appIds = apps.map((a) => a.id);
      await tx.applicationCertificate.deleteMany({
        where: { applicationId: { in: appIds } },
      });
      await tx.volunteerApplication.deleteMany({
        where: { userId: targetUserId },
      });
    }

    // 11. Agency memberships
    await tx.agencyMember.deleteMany({ where: { userId: targetUserId } });

    // 12. User roles
    await tx.userRole.deleteMany({ where: { userId: targetUserId } });

    // 13. Delete the user — DB handles SetNull FKs automatically:
    //     Incident.reportedBy, Mission.createdBy, MissionLog.actorId,
    //     MissionIncident.linkedBy, AuditLog.actorId,
    //     VolunteerApplication.reviewedBy
    await tx.user.delete({ where: { id: targetUserId } });
  });
}
