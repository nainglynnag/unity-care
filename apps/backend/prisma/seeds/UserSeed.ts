import { type Role, ApplicationStatus } from "../../generated/prisma/client";
import { faker } from "@faker-js/faker";
import { seedPrisma as prisma } from "./client";

faker.seed(12345);

// Thai geo-locations for volunteers (scattered across Thailand)
const THAI_VOLUNTEER_LOCATIONS: Array<{
  lat: number;
  lng: number;
  label: string;
}> = [
  { lat: 13.7563, lng: 100.5018, label: "Bangkok" },
  { lat: 13.69, lng: 100.7501, label: "Samut Prakan" },
  { lat: 13.8443, lng: 100.537, label: "Nonthaburi" },
  { lat: 14.0208, lng: 100.5253, label: "Pathum Thani" },
  { lat: 13.5427, lng: 100.2365, label: "Samut Sakhon" },
  { lat: 18.7883, lng: 98.9853, label: "Chiang Mai" },
  { lat: 18.7956, lng: 99.0072, label: "Chiang Mai Old City" },
  { lat: 7.8804, lng: 98.3923, label: "Phuket" },
  { lat: 8.4304, lng: 99.9631, label: "Surat Thani" },
  { lat: 14.9712, lng: 102.1015, label: "Nakhon Ratchasima" },
  { lat: 16.4419, lng: 102.836, label: "Khon Kaen" },
  { lat: 12.9236, lng: 100.8825, label: "Pattaya" },
  { lat: 9.1382, lng: 99.3211, label: "Ko Samui" },
  { lat: 14.3553, lng: 100.5683, label: "Ayutthaya" },
  { lat: 6.8691, lng: 101.2502, label: "Pattani" },
  { lat: 17.0068, lng: 99.0048, label: "Sukhothai" },
  { lat: 7.0088, lng: 100.4742, label: "Hat Yai" },
  { lat: 15.87, lng: 100.9925, label: "Phitsanulok" },
  { lat: 19.9071, lng: 99.8306, label: "Chiang Rai" },
  { lat: 13.3611, lng: 100.9847, label: "Chonburi" },
];

// Role map
type RoleMap = {
  SUPERADMIN: Role;
  CIVILIAN: Role;
  VOLUNTEER: Role;
  ADMIN: Role;
};

async function ensureRoles(): Promise<RoleMap> {
  const roleNames = ["SUPERADMIN", "CIVILIAN", "VOLUNTEER", "ADMIN"] as const;
  for (const roleName of roleNames) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }
  const roles = await prisma.role.findMany({
    where: { name: { in: [...roleNames] } },
  });
  return Object.fromEntries(roles.map((r) => [r.name, r])) as RoleMap;
}

const SKILL_NAMES = [
  "CPR",
  "First Aid",
  "Fire Rescue",
  "Medical Support",
  "Driving",
  "Water Rescue",
  "Disaster Relief",
  "Hazmat Handling",
];

async function ensureSkills() {
  for (const name of SKILL_NAMES) {
    await prisma.skill.upsert({
      where: { name },
      update: {},
      create: {
        name,
        description: `Proficiency in ${name.toLowerCase()} operations.`,
      },
    });
  }
  return prisma.skill.findMany();
}

function thaiPhone(): string {
  const prefixes = ["06", "08", "09"];
  const prefix = faker.helpers.arrayElement(prefixes);
  const rest = faker.string.numeric(8);
  return `${prefix}${rest}`;
}

async function createUserBase(name?: string) {
  return prisma.user.create({
    data: {
      name: name ?? faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      phone: thaiPhone(),
      passwordHash: "$2b$10$dummyHashForSeedDataOnly000000000000000000000000",
      isActive: true,
    },
  });
}

async function assignRole(userId: string, roleId: string) {
  await prisma.userRole.create({ data: { userId, roleId } });
}

async function createEmergencyProfile(userId: string) {
  // 60% chance of having an emergency profile
  if (faker.number.float({ min: 0, max: 1 }) < 0.6) {
    const profile = await prisma.emergencyProfile.create({
      data: {
        userId,
        fullName: faker.person.fullName(),
        dateOfBirth: faker.date.birthdate({ min: 18, max: 70, mode: "age" }),
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

    const contactCount = faker.number.int({ min: 1, max: 3 });
    const contacts = Array.from({ length: contactCount }, (_, i) => ({
      profileId: profile.id,
      name: faker.person.fullName(),
      phone: thaiPhone(),
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
}

async function createVolunteerProfile(
  userId: string,
  skills: Awaited<ReturnType<typeof ensureSkills>>,
  location: { lat: number; lng: number },
) {
  // Add small jitter so volunteers in the same city aren't at the exact same point
  const lat = location.lat + faker.number.float({ min: -0.02, max: 0.02 });
  const lng = location.lng + faker.number.float({ min: -0.02, max: 0.02 });

  await prisma.volunteerProfile.create({
    data: {
      userId,
      isAvailable: faker.datatype.boolean(),
      availabilityRadiusKm: faker.number.int({ min: 5, max: 50 }),
      lastKnownLatitude: lat,
      lastKnownLongitude: lng,
    },
  });

  const selectedSkills = faker.helpers.arrayElements(skills, {
    min: 1,
    max: 4,
  });
  for (const skill of selectedSkills) {
    await prisma.volunteerSkill.create({
      data: { volunteerId: userId, skillId: skill.id },
    });
  }
}

// Exported result type for downstream seeds
export interface UserSeedResult {
  superadmin: { id: string; name: string };
  admins: Array<{ id: string; name: string }>;
  civilians: Array<{ id: string; name: string }>;
  volunteers: Array<{ id: string; name: string }>;
  roles: RoleMap;
}

export async function userSeed(): Promise<UserSeedResult> {
  console.log("Seeding users...");

  const roles = await ensureRoles();
  const skills = await ensureSkills();

  // 1 SUPERADMIN
  const superadmin = await createUserBase("Super Admin");
  await assignRole(superadmin.id, roles.SUPERADMIN.id);

  // 2 ADMINs
  const admins: Array<{ id: string; name: string }> = [];
  for (let i = 0; i < 2; i++) {
    const user = await createUserBase();
    await assignRole(user.id, roles.ADMIN.id);
    admins.push(user);
  }

  // 10 CIVILIANs
  const civilians: Array<{ id: string; name: string }> = [];
  for (let i = 0; i < 10; i++) {
    const user = await createUserBase();
    await assignRole(user.id, roles.CIVILIAN.id);
    await createEmergencyProfile(user.id);
    civilians.push(user);
  }

  // 20 VOLUNTEERs with Thai locations
  const volunteers: Array<{ id: string; name: string }> = [];
  for (let i = 0; i < 20; i++) {
    const user = await createUserBase();
    await assignRole(user.id, roles.VOLUNTEER.id);
    const loc = THAI_VOLUNTEER_LOCATIONS[i % THAI_VOLUNTEER_LOCATIONS.length]!;
    await createVolunteerProfile(user.id, skills, loc);
    volunteers.push(user);
  }

  console.log(
    `  Created: 1 superadmin, ${admins.length} admins, ${civilians.length} civilians, ${volunteers.length} volunteers`,
  );
  return { superadmin, admins, civilians, volunteers, roles };
}
