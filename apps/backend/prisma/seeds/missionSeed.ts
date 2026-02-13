import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, MissionStatus, MissionAction } from "../../generated/prisma/client";
import { faker } from "@faker-js/faker";

const adapter = new PrismaPg({ connectionString: `${process.env.DATABASE_URL}` });
const prisma = new PrismaClient({ adapter });

faker.seed(24680);

export async function missionSeed() {
    console.log("Seeding missions is starting...");

    // Get verified incidents
    const verifiedIncidents = await prisma.incident.findMany({
    where: { status: "VERIFIED" },
  });

  if (verifiedIncidents.length === 0) {
    console.log("No VERIFIED incidents found. Please seed incidents first!");
    return;
  }

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
    throw new Error("No volunteers found. Please seed users first.");
  }

  // Create missions
  for (const incident of verifiedIncidents) {
    const status = faker.helpers.arrayElement([
      MissionStatus.ASSIGNED,
      MissionStatus.ACCEPTED,
      MissionStatus.IN_PROGRESS,
      MissionStatus.COMPLETED,
    ]);

    const mission = await prisma.mission.create({
      data: {
        incidentId: incident.id,
        createdBy: incident.reportedBy,
        status,
        priority: faker.number.int({ min: 1, max: 5 }),
      },
    });

// Assign volunteers to missions
const volunteer = faker.helpers.arrayElement(volunteers);

    const assignment = await prisma.missionAssignment.create({
      data: {
        missionId: mission.id,
        assignedTo: volunteer.id,
        assignedBy: incident.reportedBy,
      },
    });

    await prisma.missionLog.create({
      data: {
        missionId: mission.id,
        actorId: incident.reportedBy,
        action: MissionAction.ASSIGNED,
        note: "Mission assigned to volunteer.",
      },
    });

    if (
      status === MissionStatus.ACCEPTED ||
      status === MissionStatus.IN_PROGRESS ||
      status === MissionStatus.COMPLETED
    ) {
      await prisma.missionLog.create({
        data: {
          missionId: mission.id,
          actorId: volunteer.id,
          action: MissionAction.ACCEPTED,
          note: "Volunteer accepted mission.",
        },
      });
    }

    if (
      status === MissionStatus.IN_PROGRESS ||
      status === MissionStatus.COMPLETED
    ) {
      await prisma.missionLog.create({
        data: {
          missionId: mission.id,
          actorId: volunteer.id,
          action: MissionAction.STARTED,
          note: "Volunteer started mission.",
        },
      });
    }

    if (status === MissionStatus.COMPLETED) {
      await prisma.missionLog.create({
        data: {
          missionId: mission.id,
          actorId: volunteer.id,
          action: MissionAction.COMPLETED,
          note: "Mission completed successfully.",
        },
      });

      // Mission Report
      await prisma.missionReport.create({
        data: {
          missionId: mission.id,
          summary: faker.lorem.paragraph(),
          actionsTaken: faker.lorem.sentences(2),
          resourcesUsed: faker.lorem.words(5),
          casualties: faker.number.int({ min: 0, max: 3 }),
          propertyDamage: faker.helpers.arrayElement([
            "None",
            "Minor",
            "Moderate",
            "Severe",
          ]),
          submittedBy: volunteer.id,
        },
      });
    }
}

console.log("Mission seeding successfully completed.");

}