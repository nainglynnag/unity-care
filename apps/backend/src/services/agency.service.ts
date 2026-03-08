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

/**
 * List agencies with optional filters. Used by admin (Volunteer Roles, etc.) and
 * by volunteers (e.g. application form). Non-admin roles only see active
 * agencies so inactive ones are hidden from volunteers and civilians.
 */
export async function listAgencies(
  requesterRole: string,
  query: ListAgenciesQuery,
) {
  const { search, isActive, region, page, perPage } = query;
  const skip = (page - 1) * perPage;

  // Admin can filter by isActive or see all; others only see active agencies
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

/** Get a single agency by id. Non-admin roles cannot see inactive agencies. */
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

  // Non-admin roles cannot see inactive agencies (same policy as listAgencies)
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

/**
 * List volunteers in an agency (for mission assignment, admin Volunteer Roles, etc.).
 * Response includes each member's agency role (MEMBER/COORDINATOR/DIRECTOR) so the
 * UI can show who can be promoted. SUPERADMIN/ADMIN can query any agency;
 * COORDINATOR/DIRECTOR are restricted to their own agency.
 */
export async function listAvailableVolunteers(
  requester: RequesterContext,
  agencyId: string,
  query: ListAvailableVolunteersQuery,
) {
  const { search, skillId, page, perPage } = query;
  const skip = (page - 1) * perPage;

  let effectiveAgencyId = agencyId;

  if (requester.role !== "SUPERADMIN" && requester.role !== "ADMIN") {
    // Updated: look up membership for the *requested* agencyId (not arbitrary first membership).
    // Previously used findFirst({ where: { userId } }) which could return a different agency when
    // the user belongs to multiple agencies, causing agencyId !== membership.agencyId → 403 on Team page.
    //------------------------------------------------------------------------
    // const membership = await prisma.agencyMember.findFirst({
    //   where: { userId: requester.id },
    //   select: { agencyId: true },
    // });
    // if (!membership) throw new ForbiddenError();
    // COORDINATOR/DIRECTOR can only query their own agency (route param ignored)
    // if (agencyId !== membership.agencyId) throw new ForbiddenError();//


    const membership = await prisma.agencyMember.findUnique({
      where: {
        agencyId_userId: { agencyId, userId: requester.id },
      },
      select: { agencyId: true, role: true },
    });
    if (!membership) throw new ForbiddenError();
    if (membership.role !== AgencyRole.COORDINATOR && membership.role !== AgencyRole.DIRECTOR) {
      throw new ForbiddenError();
    }
    effectiveAgencyId = membership.agencyId;
  }

  const agency = await prisma.agency.findUnique({
    where: { id: effectiveAgencyId },
  });
  if (!agency) throw new AgencyNotFoundError();

  const where = {
    user: {
      isActive: true,
      deletedAt: null,
      agencyMemberships: {
        some: { agencyId: effectiveAgencyId },
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
          select: {
            id: true,
            name: true,
            profileImageUrl: true,
            agencyMemberships: {
              where: { agencyId: effectiveAgencyId },
              select: { role: true },
              take: 1,
            },
          },
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
      role: v.user.agencyMemberships[0]?.role ?? AgencyRole.MEMBER,
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

/**
 * Update a member's agency role (MEMBER / COORDINATOR / DIRECTOR). Used by admin
 * (Volunteer Roles) and by agency Directors. Only DIRECTOR (or SUPERADMIN) can
 * change roles; COORDINATOR cannot, so the frontend hides the role dropdown for
 * Coordinators. We block demoting the last director so the agency always has
 * at least one.
 */
export async function updateMemberRole(
  requester: RequesterContext,
  agencyId: string,
  volunteerId: string,
  data: UpdateMemberRoleInput,
) {
  // 1. Agency exists?
  const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
  if (!agency) throw new AgencyNotFoundError();

  // 2. Authorise caller: only SUPERADMIN or DIRECTOR of this agency
  const isSuperadmin = requester.role === "SUPERADMIN";

  if (!isSuperadmin) {
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

  // 3. Cannot change own role (avoid locking yourself out)
  if (requester.id === volunteerId) throw new CannotChangeOwnRoleError();

  // 4. Target must be a member of this agency
  const target = await prisma.agencyMember.findUnique({
    where: { agencyId_userId: { agencyId, userId: volunteerId } },
    select: { role: true },
  });
  if (!target) throw new AgencyMemberNotFoundError();

  // 5. Block demoting the last director so the agency always has at least one
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
