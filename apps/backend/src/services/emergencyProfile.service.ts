import { prisma } from "../lib/prisma";
import { AppError } from "../utils/appError";
import type {
  CreateEmergencyProfileInput,
  UpdateEmergencyProfileInput,
  ListEmergencyProfileQuery,
} from "../validators/emergencyProfile.validator";

// Create Emergency Profile (Civilian)
// Creates a new profile with optional emergency contacts.
// Fails if the civilian already has a profile.
export async function createMyProfile(
  userId: string,
  data: CreateEmergencyProfileInput,
) {
  // Prevent duplicate profiles
  const existing = await prisma.emergencyProfile.findUnique({
    where: { userId },
  });

  if (existing) {
    throw new AppError(
      "PROFILE_ALREADY_EXISTS",
      "You already have an emergency profile.",
      409,
    );
  }

  const { contacts, ...profileData } = data;

  const profile = await prisma.$transaction(async (tx) => {
    const created = await tx.emergencyProfile.create({
      data: {
        userId,
        ...profileData,
      },
    });

    // Attach emergency contacts if provided
    if (contacts && contacts.length > 0) {
      await tx.emergencyContact.createMany({
        data: contacts.map((c) => ({
          profileId: created.id,
          name: c.name,
          phone: c.phone,
          relationship: c.relationship,
          isPrimary: c.isPrimary ?? false,
        })),
      });
    }

    // Re-fetch with contacts for a consistent response shape
    return tx.emergencyProfile.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        contacts: { orderBy: { isPrimary: "desc" } },
      },
    });
  });

  return profile;
}

// Update Emergency Profile (Civilian)
// Partially updates profile fields and optionally replaces emergency contacts.
export async function updateMyProfile(
  userId: string,
  data: UpdateEmergencyProfileInput,
) {
  const existing = await prisma.emergencyProfile.findUnique({
    where: { userId },
  });

  if (!existing) {
    throw new AppError(
      "PROFILE_NOT_FOUND",
      "You have not created an emergency profile yet.",
      404,
    );
  }

  const { contacts, ...profileData } = data;

  const profile = await prisma.$transaction(async (tx) => {
    // Update profile fields (only those provided)
    await tx.emergencyProfile.update({
      where: { userId },
      data: profileData,
    });

    // Replace contacts if a new set is provided
    if (contacts !== undefined) {
      await tx.emergencyContact.deleteMany({
        where: { profileId: existing.id },
      });

      if (contacts.length > 0) {
        await tx.emergencyContact.createMany({
          data: contacts.map((c) => ({
            profileId: existing.id,
            name: c.name,
            phone: c.phone,
            relationship: c.relationship,
            isPrimary: c.isPrimary ?? false,
          })),
        });
      }
    }

    // Re-fetch with contacts for a consistent response shape
    return tx.emergencyProfile.findUniqueOrThrow({
      where: { id: existing.id },
      include: {
        contacts: { orderBy: { isPrimary: "desc" } },
      },
    });
  });

  return profile;
}

// Get My Emergency Profile (Civilian)
export async function getMyProfile(userId: string) {
  const profile = await prisma.emergencyProfile.findUnique({
    where: { userId },
    include: {
      contacts: { orderBy: { isPrimary: "desc" } },
    },
  });

  if (!profile) {
    throw new AppError(
      "PROFILE_NOT_FOUND",
      "You have not created an emergency profile yet.",
      404,
    );
  }

  return profile;
}

// Get Emergency Profile by ID (Admin / Volunteer)
export async function getProfileById(profileId: string) {
  const profile = await prisma.emergencyProfile.findUnique({
    where: { id: profileId },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      contacts: { orderBy: { isPrimary: "desc" } },
    },
  });

  if (!profile) {
    throw new AppError(
      "PROFILE_NOT_FOUND",
      "The requested emergency profile could not be found.",
      404,
    );
  }

  return profile;
}

// List All Emergency Profiles (Admin)
export async function listProfiles(query: ListEmergencyProfileQuery) {
  const { page, perPage } = query;
  const skip = (page - 1) * perPage;

  const [profiles, totalRecords] = await prisma.$transaction([
    prisma.emergencyProfile.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        _count: { select: { contacts: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    prisma.emergencyProfile.count(),
  ]);

  return {
    profiles,
    pagination: {
      totalRecords,
      totalPages: Math.ceil(totalRecords / perPage),
      currentPage: page,
      perPage,
    },
  };
}
