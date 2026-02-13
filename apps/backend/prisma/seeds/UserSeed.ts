import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Role } from "../../generated/prisma/client";
import {faker} from "@faker-js/faker";

const adapter = new PrismaPg({ connectionString: `${process.env.DATABASE_URL}` });
const prisma = new PrismaClient({ adapter });

faker.seed(12345);

type RoleMap = {
    CIVILIAN: Role;
    VOLUNTEER: Role;
    ADMIN: Role;
}

async function ensureRoles(): Promise<RoleMap> {
    const roleNames = ["CIVILIAN", "VOLUNTEER", "ADMIN"] as const;

    for (const roleName of roleNames) {
        await prisma.role.upsert({
            where: { name: roleName },
            update: {},
            create: { name: roleName }
        });
    }

    const roles = await prisma.role.findMany({
        where: { name: { in: roleNames as any } }
    });

    const roleMap = Object.fromEntries(
        roles.map((role => [role.name, role]))
    ) as RoleMap;

    return roleMap;
}

async function createUserBase() {
    return prisma.user.create({
        data: {
            email: faker.internet.email().toLowerCase(),
            phone:faker.phone.number(),
            passwordHash:faker.internet.password(),
            isActive: true,
        }
    });
}

async function assignRole(userId:string, roleId:string) {
    await prisma.userRole.create({
        data: {
            userId,
            roleId
        }
    });
}

async function createEmergencyProfile(userId:string) {
    if(Math.random() < 0.6){
        await prisma.emergencyProfile.create({
            data: {
                userId,
                fullName: faker.person.fullName(),
                dateOfBirth: faker.date.birthdate(),
                bloodType: faker.helpers.arrayElement(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]),
                allergies: faker.helpers.maybe(()=> faker.lorem.word()),
                medicalConditions: faker.helpers.maybe(()=> faker.lorem.words()),
                medications: faker.helpers.maybe(()=> faker.lorem.words()),
                consentGivenAt: new Date(),
            }
        });
    }
}

async function createEmergencyContact(profileId: string) {
  const contactCount = faker.number.int({ min: 1, max: 3 });

  const contacts = [];

  for (let i = 0; i < contactCount; i++) {
    contacts.push({
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
      isPrimary: i === 0, // first one primary
    });
  }

  return prisma.emergencyContact.createMany({
    data: contacts,
  });
}

async function createVolunteerApplication(userId: string) {
  return prisma.volunteerApplication.create({
    data: {
      userId,
      status: "APPROVED",
      submittedAt: faker.date.past(),
      reviewedAt: new Date(),
    },
  });
}

async function createVolunteerProfile(userId: string) {
  return prisma.volunteerProfile.create({
    data: {
      userId,
      skills: faker.helpers.arrayElements(
        ["CPR", "First Aid", "Fire Rescue", "Medical Support"],
        { min: 1, max: 3 }
      ),
      certifications: {
        issuedBy: faker.company.name(),
        validUntil: faker.date.future(),
      },
      isAvailable: faker.datatype.boolean(),
      availabilityRadiusKm: faker.number.int({ min: 5, max: 50 }),
      lastKnownLatitude: faker.location.latitude(),
      lastKnownLongitude: faker.location.longitude(),
    },
  });
}

export async function userSeed() {
    console.log("Seeding users is starting...");

    const roles = await ensureRoles();

    // 10 Civilians
    for(let i=0; i<10; i++) {
        const user =  await createUserBase();
        await assignRole(user.id, roles.CIVILIAN.id);
        await createEmergencyProfile(user.id);

        const profile = await prisma.emergencyProfile.findUnique({
            where: { userId: user.id }
        });
        if(profile) await createEmergencyContact(profile.id);

    }

    // 20 Volunteers
    for(let i=0; i<20; i++) {
        const user =  await createUserBase();
        await assignRole(user.id, roles.VOLUNTEER.id);
        await createVolunteerApplication(user.id);
        await createVolunteerProfile(user.id);
    }

    // 2 Admins
    for(let i=0; i<2; i++) {
        const user =  await createUserBase();
        await assignRole(user.id, roles.ADMIN.id);
    }

    console.log("User seeding successfully completed.");
}