import { prisma } from "../lib/prisma";
import {
  ForbiddenError,
  CategoryNotFoundError,
  CategoryNameConflictError,
  CannotDeactivateWithActiveDataError,
  CannotDeleteWithLinkedDataError,
} from "../utils/errors";
import {
  resolveWriteAuthority,
  type RequesterContext,
} from "../utils/agencyAuth";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  ListCategoriesQuery,
} from "../validators/category.validator";

export async function listCategories(
  requesterRole: string,
  query: ListCategoriesQuery,
) {
  const { search, isActive, page, perPage } = query;
  const skip = (page - 1) * perPage;

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

  const [categories, total] = await Promise.all([
    prisma.incidentCategory.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: perPage,
    }),
    prisma.incidentCategory.count({ where }),
  ]);

  return {
    categories,
    pagination: {
      totalRecords: total,
      totalPages: Math.ceil(total / perPage),
      currentPage: page,
      perPage,
    },
  };
}

export async function getCategory(id: string) {
  const cat = await prisma.incidentCategory.findUnique({ where: { id } });
  if (!cat) throw new CategoryNotFoundError();
  return cat;
}

export async function createCategory(
  requester: RequesterContext,
  data: CreateCategoryInput,
) {
  await resolveWriteAuthority(requester);

  // Case-insensitive uniqueness check
  const existing = await prisma.incidentCategory.findFirst({
    where: { name: { equals: data.name, mode: "insensitive" } },
  });
  if (existing) throw new CategoryNameConflictError();

  return prisma.incidentCategory.create({ data });
}

export async function updateCategory(
  requester: RequesterContext,
  categoryId: string,
  data: UpdateCategoryInput,
) {
  const category = await prisma.incidentCategory.findUnique({
    where: { id: categoryId },
  });
  if (!category) throw new CategoryNotFoundError();

  const authority = await resolveWriteAuthority(requester);

  if (authority !== null && data.isActive !== undefined)
    throw new ForbiddenError();

  // Guard: cannot deactivate if active (non-terminal) incidents exist
  if (data.isActive === false) {
    const activeIncidents = await prisma.incident.count({
      where: {
        categoryId,
        status: { notIn: ["FALSE_REPORT", "CLOSED", "RESOLVED"] },
        deletedAt: null,
      },
    });
    if (activeIncidents > 0)
      throw new CannotDeactivateWithActiveDataError("category");
  }

  // Case-insensitive name uniqueness
  if (data.name && data.name.toLowerCase() !== category.name.toLowerCase()) {
    const conflict = await prisma.incidentCategory.findFirst({
      where: {
        name: { equals: data.name, mode: "insensitive" },
        id: { not: categoryId },
      },
    });
    if (conflict) throw new CategoryNameConflictError();
  }

  return prisma.incidentCategory.update({
    where: { id: categoryId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
}

// Hard delete blocked if ANY incident (even historical) references this category
// — would orphan incident records. Use deactivation instead.
export async function deleteCategory(
  requester: RequesterContext,
  categoryId: string,
) {
  if (requester.role !== "SUPERADMIN") throw new ForbiddenError();

  const category = await prisma.incidentCategory.findUnique({
    where: { id: categoryId },
  });
  if (!category) throw new CategoryNotFoundError();

  const inUse = await prisma.incident.count({ where: { categoryId } });
  if (inUse > 0) throw new CannotDeleteWithLinkedDataError("category");

  await prisma.incidentCategory.delete({ where: { id: categoryId } });
  return { message: "Category deleted." };
}
