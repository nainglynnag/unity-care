import { prisma } from "../lib/prisma";
import {
  ForbiddenError,
  SkillNotFoundError,
  SkillNameConflictError,
  CannotDeleteWithLinkedDataError,
} from "../utils/errors";
import {
  resolveWriteAuthority,
  type RequesterContext,
} from "../utils/agencyAuth";
import type {
  CreateSkillInput,
  UpdateSkillInput,
  ListSkillsQuery,
} from "../validators/skill.validator";

export async function listSkills(
  requesterRole: string,
  query: ListSkillsQuery,
) {
  const { search, isActive, page, perPage } = query;
  const skip = (page - 1) * perPage;

  // Non-admin roles always see active skills only (isActive param ignored)
  const activeFilter =
    requesterRole === "SUPERADMIN" || requesterRole === "ADMIN"
      ? isActive !== undefined
        ? { isActive }
        : {}
      : { isActive: true };

  const where = {
    ...activeFilter,
    ...(search && {
      name: { contains: search, mode: "insensitive" as const },
    }),
  };

  const [skills, total] = await Promise.all([
    prisma.skill.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: perPage,
    }),
    prisma.skill.count({ where }),
  ]);

  return {
    skills,
    pagination: {
      totalRecords: total,
      totalPages: Math.ceil(total / perPage),
      currentPage: page,
      perPage,
    },
  };
}

export async function getSkill(id: string) {
  const skill = await prisma.skill.findUnique({ where: { id } });
  if (!skill) throw new SkillNotFoundError();
  return skill;
}

// SUPERADMIN, COORDINATOR, DIRECTOR
export async function createSkill(
  requester: RequesterContext,
  data: CreateSkillInput,
) {
  await resolveWriteAuthority(requester);

  // Case-insensitive uniqueness check
  const existing = await prisma.skill.findFirst({
    where: { name: { equals: data.name, mode: "insensitive" } },
  });
  if (existing) throw new SkillNameConflictError();

  return prisma.skill.create({ data });
}

// SUPERADMIN: all fields. COORDINATOR/DIRECTOR: name + description only.
export async function updateSkill(
  requester: RequesterContext,
  skillId: string,
  data: UpdateSkillInput,
) {
  const skill = await prisma.skill.findUnique({ where: { id: skillId } });
  if (!skill) throw new SkillNotFoundError();

  const authority = await resolveWriteAuthority(requester);

  // COORDINATOR/DIRECTOR cannot toggle isActive
  if (authority !== null && data.isActive !== undefined)
    throw new ForbiddenError();

  // Case-insensitive name uniqueness if name is being changed
  if (data.name && data.name.toLowerCase() !== skill.name.toLowerCase()) {
    const conflict = await prisma.skill.findFirst({
      where: {
        name: { equals: data.name, mode: "insensitive" },
        id: { not: skillId },
      },
    });
    if (conflict) throw new SkillNameConflictError();
  }

  return prisma.skill.update({
    where: { id: skillId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
}

// SUPERADMIN only. Hard delete blocked if any volunteer has this skill.
export async function deleteSkill(
  requester: RequesterContext,
  skillId: string,
) {
  if (requester.role !== "SUPERADMIN") throw new ForbiddenError();

  const skill = await prisma.skill.findUnique({ where: { id: skillId } });
  if (!skill) throw new SkillNotFoundError();

  const inUse = await prisma.volunteerSkill.count({ where: { skillId } });
  if (inUse > 0) throw new CannotDeleteWithLinkedDataError("skill");

  await prisma.skill.delete({ where: { id: skillId } });
  return { message: "Skill deleted." };
}
