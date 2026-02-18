import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, AgencyRole } from "../../generated/prisma/client";
import { faker } from "@faker-js/faker";

const adapter = new PrismaPg({
  connectionString: `${process.env.DATABASE_URL}`,
});
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
      roles: { some: { role: { name: "VOLUNTEER" } } },
    },
  });

  if (volunteers.length === 0) {
    console.log("No volunteers found. Please seed users first.");
    return;
  }

  // Get an admin/reviewer to associate with re-created applications
  const reviewer = await prisma.user.findFirst({
    where: { roles: { some: { role: { name: "ADMIN" } } } },
  });

  if (!reviewer) {
    console.log("No admin user found. Please seed users first.");
    return;
  }

  // Assign volunteers to agencies
  for (const agency of agencies) {
    const memberCount = faker.number.int({ min: 4, max: 8 });
    const shuffledVolunteers = faker.helpers.shuffle([...volunteers]);

    for (let i = 0; i < memberCount && i < shuffledVolunteers.length; i++) {
      const volunteer = shuffledVolunteers[i];
      if (!volunteer) continue;

      // AgencyMember composite PK is (agencyId, userId) — skip if already exists
      const existing = await prisma.agencyMember.findUnique({
        where: {
          agencyId_userId: { agencyId: agency.id, userId: volunteer.id },
        },
      });
      if (existing) continue;

      await prisma.agencyMember.create({
        data: {
          agencyId: agency.id,
          userId: volunteer.id,
          role: i === 0 ? AgencyRole.COORDINATOR : AgencyRole.MEMBER,
        },
      });

      const existingApp = await prisma.volunteerApplication.findFirst({
        where: { userId: volunteer.id, agencyId: agency.id },
      });

      if (!existingApp) {
        // Check if volunteer has the placeholder agency application and update it
        const placeholderApp = await prisma.volunteerApplication.findFirst({
          where: { userId: volunteer.id, agencyId: "placeholder-agency" },
        });

        if (placeholderApp) {
          await prisma.volunteerApplication.update({
            where: { id: placeholderApp.id },
            data: { agencyId: agency.id },
          });
        } else {
          await prisma.volunteerApplication.create({
            data: {
              userId: volunteer.id,
              agencyId: agency.id,
              status: "APPROVED",
              reviewedBy: reviewer.id,
              reviewNote: "Approved during agency assignment.",
              submittedAt: faker.date.past(),
              reviewedAt: new Date(),
            },
          });
        }
      }
    }
  }

  // ── Clean up placeholder agency if all its applications were migrated ──
  const remainingPlaceholderApps = await prisma.volunteerApplication.count({
    where: { agencyId: "placeholder-agency" },
  });

  if (remainingPlaceholderApps === 0) {
    await prisma.agency.delete({ where: { id: "placeholder-agency" } });
    console.log("Placeholder agency removed.");
  }

  console.log("Agency seeding successfully completed.");
}
