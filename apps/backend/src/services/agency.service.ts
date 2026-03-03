import { prisma } from "../lib/prisma";
import { AgencyRole } from "../../generated/prisma/client";
import {
  ForbiddenError,
  AgencyNotFoundError,
  AgencyNameConflictError,
  CannotDeactivateWithActiveDataError,
  CannotDeleteWithLinkedDataError,
  AgencyMemberNotFoundError,
  CannotChangeOwnRoleError,
  DirectorRequiredError,
} from "../utils/errors";
import {
  resolveWriteAuthority,
  type RequesterContext,
} from "../utils/agencyAuth";
import type {
  CreateAgencyInput,
  UpdateAgencyInput,
  ListAgenciesQuery,
  ListAvailableVolunteersQuery,
  UpdateMemberRoleInput,
} from "../validators/agency.validator";

export async function listAgencies(
  requesterRole: string,
  query: ListAgenciesQuery,
) {
  const { search, isActive, region, page, perPage } = query;
  const skip = (page - 1) * perPage;

  const activeFilter =
    requesterRole === "SUPERADMIN" || requesterRole === "ADMIN"
      ? isActive !== undefined
        ? { isActive }
        : {}
      : { isActive: true };

  const where = {
    ...activeFilter,
    ...(region && {
      region: { contains: region, mode: "insensitive" as const },
    }),
    ...(search && {
      name: { contains: search, mode: "insensitive" as const },
    }),
  };

  const [agencies, total] = await Promise.all([
    prisma.agency.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        latitude: true,
        longitude: true,
        region: true,
        isActive: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
      orderBy: { name: "asc" },
      skip,
      take: perPage,
    }),
    prisma.agency.count({ where }),
  ]);

  return {
    agencies: agencies.map((a) => ({ ...a, memberCount: a._count.members })),
    pagination: {
      totalRecords: total,
      totalPages: Math.ceil(total / perPage),
      currentPage: page,
      perPage,
    },
  };
}

export async function getAgency(id: string, requesterRole: string) {
  const agency = await prisma.agency.findUnique({
    where: { id },
    include: {
      _count: {
        select: { members: true, missions: true, applications: true },
      },
    },
  });

  if (!agency) throw new AgencyNotFoundError();

  // Non-admin roles cannot see inactive agencies
  if (
    !agency.isActive &&
    requesterRole !== "SUPERADMIN" &&
    requesterRole !== "ADMIN"
  ) {
    throw new AgencyNotFoundError();
  }

  return {
    ...agency,
    memberCount: agency._count.members,
    missionCount: agency._count.missions,
    applicationCount: agency._count.applications,
  };
}

// SUPERADMIN only
export async function createAgency(
  requester: RequesterContext,
  data: CreateAgencyInput,
) {
  if (requester.role !== "SUPERADMIN") throw new ForbiddenError();

  const existing = await prisma.agency.findFirst({
    where: { name: { equals: data.name, mode: "insensitive" } },
  });
  if (existing) throw new AgencyNameConflictError();

  return prisma.agency.create({ data });
}

// SUPERADMIN: any agency, all fields.
// COORDINATOR/DIRECTOR: own agency only, cannot change isActive.
export async function updateAgency(
  requester: RequesterContext,
  agencyId: string,
  data: UpdateAgencyInput,
) {
  const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
  if (!agency) throw new AgencyNotFoundError();

  const authority = await resolveWriteAuthority(requester);

  if (authority !== null) {
    if (authority.agencyId !== agencyId) throw new ForbiddenError();
    if (data.isActive !== undefined) throw new ForbiddenError();
  }

  // Guard: cannot deactivate agency with active missions
  if (data.isActive === false) {
    const activeMissions = await prisma.mission.count({
      where: {
        agencyId,
        status: { notIn: ["CLOSED", "FAILED", "CANCELLED"] },
      },
    });
    if (activeMissions > 0)
      throw new CannotDeactivateWithActiveDataError("agency");
  }

  if (data.name && data.name.toLowerCase() !== agency.name.toLowerCase()) {
    const conflict = await prisma.agency.findFirst({
      where: {
        name: { equals: data.name, mode: "insensitive" },
        id: { not: agencyId },
      },
    });
    if (conflict) throw new AgencyNameConflictError();
  }

  return prisma.agency.update({
    where: { id: agencyId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.latitude !== undefined && { latitude: data.latitude }),
      ...(data.longitude !== undefined && { longitude: data.longitude }),
      ...(data.region !== undefined && { region: data.region }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
}

// SUPERADMIN only. Hard delete blocked if any missions or applications exist.
export async function deleteAgency(
  requester: RequesterContext,
  agencyId: string,
) {
  if (requester.role !== "SUPERADMIN") throw new ForbiddenError();

  const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
  if (!agency) throw new AgencyNotFoundError();

  const [missionCount, appCount] = await Promise.all([
    prisma.mission.count({ where: { agencyId } }),
    prisma.volunteerApplication.count({ where: { agencyId } }),
  ]);
  if (missionCount > 0 || appCount > 0) {
    throw new CannotDeleteWithLinkedDataError("agency");
  }

  await prisma.$transaction([
    prisma.agencyMember.deleteMany({ where: { agencyId } }),
    prisma.agency.delete({ where: { id: agencyId } }),
  ]);

  return { message: "Agency deleted." };
}

// SUPERADMIN/ADMIN: query any agencyId.
// COORDINATOR/DIRECTOR: always scoped to own agency — route param is ignored.
export async function listAvailableVolunteers(
  requester: RequesterContext,
  agencyId: string,
  query: ListAvailableVolunteersQuery,
) {
  const { search, skillId, page, perPage } = query;
  const skip = (page - 1) * perPage;

  let effectiveAgencyId = agencyId;

  if (requester.role !== "SUPERADMIN" && requester.role !== "ADMIN") {
    const membership = await prisma.agencyMember.findFirst({
      where: {
        userId: requester.id,
        role: { in: [AgencyRole.COORDINATOR, AgencyRole.DIRECTOR] },
      },
      select: { agencyId: true },
    });
    if (!membership) throw new ForbiddenError();
    // COORDINATOR/DIRECTOR can only query their own agency
    if (agencyId !== membership.agencyId) throw new ForbiddenError();
    effectiveAgencyId = membership.agencyId;
  }

  const agency = await prisma.agency.findUnique({
    where: { id: effectiveAgencyId },
  });
  if (!agency) throw new AgencyNotFoundError();

  const where = {
    isAvailable: true,
    user: {
      isActive: true,
      deletedAt: null,
      agencyMemberships: {
        some: { agencyId: effectiveAgencyId, role: AgencyRole.MEMBER },
      },
      ...(search && {
        name: { contains: search, mode: "insensitive" as const },
      }),
    },
    ...(skillId && { skills: { some: { skillId } } }),
  };

  const [volunteers, total] = await Promise.all([
    prisma.volunteerProfile.findMany({
      where,
      select: {
        userId: true,
        isAvailable: true,
        availabilityRadiusKm: true,
        lastKnownLatitude: true,
        lastKnownLongitude: true,
        user: {
          select: { id: true, name: true, profileImageUrl: true },
        },
        skills: {
          select: { skill: { select: { id: true, name: true } } },
        },
      },
      skip,
      take: perPage,
    }),
    prisma.volunteerProfile.count({ where }),
  ]);

  return {
    agencyId: effectiveAgencyId,
    volunteers: volunteers.map((v) => ({
      userId: v.userId,
      name: v.user.name,
      profileImageUrl: v.user.profileImageUrl,
      isAvailable: v.isAvailable,
      availabilityRadiusKm: v.availabilityRadiusKm,
      lastKnownLatitude: v.lastKnownLatitude,
      lastKnownLongitude: v.lastKnownLongitude,
      skills: v.skills.map((s) => ({ id: s.skill.id, name: s.skill.name })),
    })),
    pagination: {
      totalRecords: total,
      totalPages: Math.ceil(total / perPage),
      currentPage: page,
      perPage,
    },
  };
}

// SUPERADMIN: any agency.
// DIRECTOR: own agency only — cannot demote self (must always have ≥1 director).
export async function updateMemberRole(
  requester: RequesterContext,
  agencyId: string,
  volunteerId: string,
  data: UpdateMemberRoleInput,
) {
  // 1. Agency exists?
  const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
  if (!agency) throw new AgencyNotFoundError();

  // 2. Authorise caller
  const isSuperadmin = requester.role === "SUPERADMIN";

  if (!isSuperadmin) {
    // Must be DIRECTOR of this exact agency
    const callerMembership = await prisma.agencyMember.findUnique({
      where: {
        agencyId_userId: { agencyId, userId: requester.id },
      },
      select: { role: true },
    });
    if (!callerMembership || callerMembership.role !== AgencyRole.DIRECTOR) {
      throw new ForbiddenError();
    }
  }

  // 3. Cannot change own role
  if (requester.id === volunteerId) throw new CannotChangeOwnRoleError();

  // 4. Target must be a member of this agency
  const target = await prisma.agencyMember.findUnique({
    where: { agencyId_userId: { agencyId, userId: volunteerId } },
    select: { role: true },
  });
  if (!target) throw new AgencyMemberNotFoundError();

  // 5. If demoting the only director → block
  if (target.role === AgencyRole.DIRECTOR && data.role !== "DIRECTOR") {
    const directorCount = await prisma.agencyMember.count({
      where: { agencyId, role: AgencyRole.DIRECTOR },
    });
    if (directorCount <= 1) throw new DirectorRequiredError();
  }

  // 6. Update
  const updated = await prisma.agencyMember.update({
    where: { agencyId_userId: { agencyId, userId: volunteerId } },
    data: { role: data.role as AgencyRole },
    select: {
      agencyId: true,
      userId: true,
      role: true,
      joinedAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return {
    agencyId: updated.agencyId,
    userId: updated.userId,
    role: updated.role,
    joinedAt: updated.joinedAt,
    user: updated.user,
  };
}
