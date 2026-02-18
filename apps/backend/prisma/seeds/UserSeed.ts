import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type Role,
  ApplicationStatus,
} from "../../generated/prisma/client";
import { faker } from "@faker-js/faker";

const adapter = new PrismaPg({
  connectionString: `${process.env.DATABASE_URL}`,
});
const prisma = new PrismaClient({ adapter });

faker.seed(12345);

// User Roles
type RoleMap = {
  CIVILIAN: Role;
  VOLUNTEER: Role;
  ADMIN: Role;
};

async function ensureRoles(): Promise<RoleMap> {
  const roleNames = ["CIVILIAN", "VOLUNTEER", "ADMIN"] as const;

  for (const roleName of roleNames) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }

  const roles = await prisma.role.findMany({
    where: { name: { in: roleNames as any } },
  });

  const roleMap = Object.fromEntries(
    roles.map((role) => [role.name, role]),
  ) as RoleMap;

  return roleMap;
}

// Skills
const SKILL_NAMES = [
  "CPR",
  "First Aid",
  "Fire Rescue",
  "Medical Support",
  "Driving",
];

async function ensureSkills() {
  for (const name of SKILL_NAMES) {
    await prisma.skill.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  return prisma.skill.findMany();
}

async function createUserBase() {
  return prisma.user.create({
    data: {
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      phone: faker.phone.number(),
      passwordHash: faker.internet.password(),
      isActive: true,
    },
  });
}

async function assignRole(userId: string, roleId: string) {
  await prisma.userRole.create({ data: { userId, roleId } });
}

// Emergency Profile & Contacts
async function createEmergencyProfile(userId: string) {
  if (Math.random() < 0.6) {
    const profile = await prisma.emergencyProfile.create({
      data: {
        userId,
        fullName: faker.person.fullName(),
        dateOfBirth: faker.date.birthdate(),
        bloodType: faker.helpers.arrayElement([
          "A+",
          "A-",
          "B+",
          "B-",
          "AB+",
          "AB-",
          "O+",
          "O-",
        ]),
        allergies: faker.helpers.maybe(() => faker.lorem.word()),
        medicalConditions: faker.helpers.maybe(() => faker.lorem.words()),
        medications: faker.helpers.maybe(() => faker.lorem.words()),
        consentGivenAt: new Date(),
      },
    });

    await createEmergencyContacts(profile.id);
  }
}

async function createEmergencyContacts(profileId: string) {
  const contactCount = faker.number.int({ min: 1, max: 3 });
  const contacts = Array.from({ length: contactCount }, (_, i) => ({
    profileId,
    name: faker.person.fullName(),
    phone: faker.phone.number(),
    relationship: faker.helpers.arrayElement([
      "Parent",
      "Sibling",
      "Friend",
      "Spouse",
      "Partner",
    ]),
    isPrimary: i === 0,
  }));

  await prisma.emergencyContact.createMany({ data: contacts });
}

// Volunteer
async function createVolunteerProfile(
  userId: string,
  skills: Awaited<ReturnType<typeof ensureSkills>>,
) {
  await prisma.volunteerProfile.create({
    data: {
      userId,
      isAvailable: faker.datatype.boolean(),
      availabilityRadiusKm: faker.number.int({ min: 5, max: 50 }),
      lastKnownLatitude: faker.location.latitude(),
      lastKnownLongitude: faker.location.longitude(),
    },
  });

  const selectedSkills = faker.helpers.arrayElements(skills, {
    min: 1,
    max: 3,
  });

  for (const skill of selectedSkills) {
    await prisma.volunteerSkill.create({
      data: {
        volunteerId: userId, // references VolunteerProfile.userId
        skillId: skill.id,
      },
    });
  }
}

async function createVolunteerApplication(
  userId: string,
  agencyId: string,
  reviewerId: string,
) {
  await prisma.volunteerApplication.create({
    data: {
      userId,
      agencyId,
      status: ApplicationStatus.APPROVED,
      reviewedBy: reviewerId,
      submittedAt: faker.date.past(),
      reviewedAt: new Date(),
      reviewNote: "Approved after document review.",
    },
  });
}

export async function userSeed() {
  console.log("Seeding users is starting...");

  const roles = await ensureRoles();
  const skills = await ensureSkills();

  // ── 2 Admins (created first so they can act as reviewers)
  const admins = [];
  for (let i = 0; i < 2; i++) {
    const user = await createUserBase();
    await assignRole(user.id, roles.ADMIN.id);
    admins.push(user);
  }
  const defaultReviewer = admins[0]!;

  // We need at least one agency to attach volunteer applications.
  // A placeholder agency is created here; AgencySeed will create the real ones.
  // This avoids a circular dependency (AgencySeed needs volunteers to exist).
  const placeholderAgency = await prisma.agency.upsert({
    where: { id: "placeholder-agency" },
    update: {},
    create: {
      id: "placeholder-agency",
      name: "Default Agency",
      region: "Central",
    },
  });

  // ── 10 Civilians
  for (let i = 0; i < 10; i++) {
    const user = await createUserBase();
    await assignRole(user.id, roles.CIVILIAN.id);
    await createEmergencyProfile(user.id);
  }

  // ── 20 Volunteers
  for (let i = 0; i < 20; i++) {
    const user = await createUserBase();
    await assignRole(user.id, roles.VOLUNTEER.id);
    await createVolunteerProfile(user.id, skills);
    await createVolunteerApplication(
      user.id,
      placeholderAgency.id,
      defaultReviewer.id,
    );
  }

  console.log("User seeding successfully completed.");
}
