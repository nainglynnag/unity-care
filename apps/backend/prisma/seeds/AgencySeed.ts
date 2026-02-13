import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, AgencyRole } from "../../generated/prisma/client";
import { faker } from "@faker-js/faker";

const adapter = new PrismaPg({ connectionString: `${process.env.DATABASE_URL}` });
const prisma = new PrismaClient({ adapter });

faker.seed(13579);

export async function agencySeed() {
  console.log("Seeding agencies is starting...");

  // Create agencies
  const agencyCount = 3;
  const agencies = [];

  for (let i = 0; i < agencyCount; i++) {
    const agency = await prisma.agency.create({
      data: {
        name: faker.company.name() + " Response Unit",
        region: faker.location.city(),
      },
    });

    agencies.push(agency);
  }

  console.log(`Created ${agencies.length} agencies.`);

  // Get volunteers
  const volunteers = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          role: { name: "VOLUNTEER" },
        },
      },
    },
  });

  if (volunteers.length === 0) {
    console.log("No volunteers found. Please seed users first.");
    return;
  }

  // Assign volunteers to agencies
  for (const agency of agencies) {
    // Random 4–8 volunteers per agency
    const memberCount = faker.number.int({ min: 4, max: 8 });
    const shuffledVolunteers = faker.helpers.shuffle(volunteers);

    for (let i = 0; i < memberCount && i < shuffledVolunteers.length; i++) {
      const volunteer = shuffledVolunteers[i];
      if (!volunteer) continue;

      await prisma.agencyMember.create({
        data: {
          agencyId: agency.id,
          userId: volunteer.id,
          role:
            i === 0
              ? AgencyRole.COORDINATOR // first member is coordinator
              : AgencyRole.MEMBER,
        },
      });
    }
  }

  console.log("Agency seeding successfully completed.");
}