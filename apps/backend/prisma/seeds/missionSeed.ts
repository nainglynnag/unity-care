import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  MissionStatus,
  MissionAction,
  MissionPriority,
  MissionRole,
} from "../../generated/prisma/client";
import { faker } from "@faker-js/faker";

const adapter = new PrismaPg({
  connectionString: `${process.env.DATABASE_URL}`,
});
const prisma = new PrismaClient({ adapter });

faker.seed(24680);

// Mission types
const MISSION_TYPES = [
  "Medical",
  "Rescue",
  "Evacuation",
  "Fire Response",
  "Search",
];

export async function missionSeed() {
  console.log("Seeding missions is starting...");

  // Prerequisites
  const verifiedIncidents = await prisma.incident.findMany({
    where: { status: "VERIFIED" },
  });

  if (verifiedIncidents.length === 0) {
    console.log("No VERIFIED incidents found. Please seed incidents first!");
    return;
  }

  const volunteers = await prisma.user.findMany({
    where: { roles: { some: { role: { name: "VOLUNTEER" } } } },
  });

  if (volunteers.length === 0) {
    throw new Error("No volunteers found. Please seed users first.");
  }

  const agencies = await prisma.agency.findMany();

  const HAS_ACCEPTED: MissionStatus[] = [
    MissionStatus.ACCEPTED,
    MissionStatus.EN_ROUTE,
    MissionStatus.ON_SITE,
    MissionStatus.COMPLETED,
  ];
  const HAS_EN_ROUTE: MissionStatus[] = [
    MissionStatus.EN_ROUTE,
    MissionStatus.ON_SITE,
    MissionStatus.COMPLETED,
  ];
  const HAS_ON_SITE: MissionStatus[] = [
    MissionStatus.ON_SITE,
    MissionStatus.COMPLETED,
  ];

  // Create missions
  for (const incident of verifiedIncidents) {
    const status = faker.helpers.arrayElement([
      MissionStatus.ASSIGNED,
      MissionStatus.ACCEPTED,
      MissionStatus.EN_ROUTE,
      MissionStatus.ON_SITE,
      MissionStatus.COMPLETED,
    ] as MissionStatus[]);

    const leader = faker.helpers.arrayElement(volunteers);
    const agency =
      agencies.length > 0 ? faker.helpers.arrayElement(agencies) : undefined;

    const now = new Date();
    const acceptedAt = HAS_ACCEPTED.includes(status)
      ? faker.date.recent({ days: 2 })
      : null;
    const onSiteAt = HAS_ON_SITE.includes(status)
      ? faker.date.recent({ days: 1 })
      : null;
    const completedAt = status === MissionStatus.COMPLETED ? now : null;

    const mission = await prisma.mission.create({
      data: {
        incidentId: incident.id,
        createdBy: incident.reportedBy,
        agencyId: agency?.id ?? null,
        missionType: faker.helpers.arrayElement(MISSION_TYPES),
        priority: faker.helpers.arrayElement([
          MissionPriority.LOW,
          MissionPriority.MEDIUM,
          MissionPriority.HIGH,
          MissionPriority.CRITICAL,
        ]),
        status,
        acceptedAt,
        onSiteAt,
        completedAt,
      },
    });

    // CREATED log
    await prisma.missionLog.create({
      data: {
        missionId: mission.id,
        actorId: incident.reportedBy,
        action: MissionAction.CREATED,
        note: "Mission created from verified incident.",
      },
    });

    // Leader assignment
    // FIX: MissionAssignment now requires `role` (MissionRole enum)
    await prisma.missionAssignment.create({
      data: {
        missionId: mission.id,
        assignedTo: leader.id,
        assignedBy: incident.reportedBy,
        role: MissionRole.LEADER,
      },
    });

    await prisma.missionLog.create({
      data: {
        missionId: mission.id,
        actorId: incident.reportedBy,
        action: MissionAction.ASSIGNED,
        note: "Leader assigned to mission.",
      },
    });

    // Optional second member
    const otherVolunteers = volunteers.filter((v) => v.id !== leader.id);
    if (otherVolunteers.length > 0 && faker.datatype.boolean()) {
      const member = faker.helpers.arrayElement(otherVolunteers);
      await prisma.missionAssignment.create({
        data: {
          missionId: mission.id,
          assignedTo: member.id,
          assignedBy: incident.reportedBy,
          role: MissionRole.MEMBER,
        },
      });
    }

    // Status-dependent logs
    if (HAS_ACCEPTED.includes(status)) {
      await prisma.missionLog.create({
        data: {
          missionId: mission.id,
          actorId: leader.id,
          action: MissionAction.ACCEPTED,
          note: "Volunteer accepted mission.",
        },
      });
    }

    if (HAS_EN_ROUTE.includes(status)) {
      await prisma.missionLog.create({
        data: {
          missionId: mission.id,
          actorId: leader.id,
          action: MissionAction.EN_ROUTE,
          note: "Volunteer is en route.",
        },
      });

      // FIX: MissionTracking is a new dedicated model for GPS snapshots
      for (let t = 0; t < faker.number.int({ min: 1, max: 4 }); t++) {
        await prisma.missionTracking.create({
          data: {
            missionId: mission.id,
            volunteerId: leader.id,
            latitude: faker.location.latitude(),
            longitude: faker.location.longitude(),
            recordedAt: faker.date.recent({ days: 1 }),
          },
        });
      }
    }

    if (HAS_ON_SITE.includes(status)) {
      await prisma.missionLog.create({
        data: {
          missionId: mission.id,
          actorId: leader.id,
          action: MissionAction.ON_SITE,
          note: "Volunteer arrived on site.",
        },
      });
    }

    if (status === MissionStatus.COMPLETED) {
      await prisma.missionLog.create({
        data: {
          missionId: mission.id,
          actorId: leader.id,
          action: MissionAction.COMPLETED,
          note: "Mission completed successfully.",
        },
      });

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
          submittedBy: leader.id,
        },
      });
    }
  }

  console.log("Mission seeding successfully completed.");
}
