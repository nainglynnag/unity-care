import { prisma } from "../lib/prisma";
import type {
  UpdateVolunteerProfileInput,
  UpdateAvailabilityInput,
} from "../validators/volunteerProfile.validator";
import {
  ProfileNotFoundError,
  InvalidSkillIdsError,
  NotAnApprovedVolunteerError,
} from "../utils/errors";

// Get the volunteer profile for the current user
export async function getVolunteerProfile(userId: string) {
  const profile = await prisma.volunteerProfile.findUnique({
    where: { userId },
    include: {
      skills: {
        select: { skill: true },
      },
    },
  });

  if (!profile) throw new ProfileNotFoundError();

  return profile;
}

// Update the volunteer profile (fields + skills)
export async function updateVolunteerProfile(
  userId: string,
  data: UpdateVolunteerProfileInput,
) {
  // Profile exists check
  const existing = await prisma.volunteerProfile.findUnique({
    where: { userId },
  });
  if (!existing) throw new ProfileNotFoundError();

  const { skillIds, ...profileData } = data;

  // Skill validation if provided
  if (skillIds) {
    const foundSkills = await prisma.skill.findMany({
      where: { id: { in: skillIds } },
      select: { id: true },
    });
    const unknownIds = skillIds.filter(
      (id) => !foundSkills.some((s) => s.id === id),
    );
    if (unknownIds.length > 0) throw new InvalidSkillIdsError(unknownIds);
  }

  await prisma.$transaction(async (tx) => {
    // Update profile fields
    await tx.volunteerProfile.update({
      where: { userId },
      data: profileData,
    });

    // Replace skills if provided
    if (skillIds) {
      await tx.volunteerSkill.deleteMany({ where: { volunteerId: userId } });
      await tx.volunteerSkill.createMany({
        data: skillIds.map((skillId) => ({
          volunteerId: userId,
          skillId,
        })),
      });
    }
  });

  // Re-fetch with skills included
  return getVolunteerProfile(userId);
}

// Update availability status
export async function updateAvailability(
  userId: string,
  data: UpdateAvailabilityInput,
) {
  // Profile exists check
  const existing = await prisma.volunteerProfile.findUnique({
    where: { userId },
  });
  if (!existing) throw new ProfileNotFoundError();

  // Approved application check
  const approvedApplication = await prisma.volunteerApplication.findFirst({
    where: { userId, status: "APPROVED" },
  });
  if (!approvedApplication) throw new NotAnApprovedVolunteerError();

  // Update
  const updated = await prisma.volunteerProfile.update({
    where: { userId },
    data: {
      isAvailable: data.isAvailable,
      ...(data.latitude !== undefined && {
        lastKnownLatitude: data.latitude,
      }),
      ...(data.longitude !== undefined && {
        lastKnownLongitude: data.longitude,
      }),
    },
  });

  // Return updated profile
  return updated;
}
