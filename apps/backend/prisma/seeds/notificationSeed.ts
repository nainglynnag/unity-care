import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { faker } from "@faker-js/faker";

const adapter = new PrismaPg({ connectionString: `${process.env.DATABASE_URL}` });
const prisma = new PrismaClient({ adapter });

faker.seed(77777);

export async function notificationSeed() {
  console.log("Seeding notifications is starting...");

  const users = await prisma.user.findMany();
  const incidents = await prisma.incident.findMany();
  const missions = await prisma.mission.findMany();

  if (users.length === 0) {
    console.log("No users found. Please seed users first!");
    return;
  }

  for (let i = 0; i < 30; i++) {
    const user = faker.helpers.arrayElement(users);

    const referenceType = faker.helpers.arrayElement([
      "INCIDENT",
      "MISSION",
      "SYSTEM",
    ]);

    let referenceId: string | null = null;

    if (referenceType === "INCIDENT" && incidents.length > 0) {
      referenceId = faker.helpers.arrayElement(incidents).id;
    }

    if (referenceType === "MISSION" && missions.length > 0) {
      referenceId = faker.helpers.arrayElement(missions).id;
    }

    const isRead = faker.datatype.boolean();

    await prisma.notification.create({
      data: {
        userId: user.id,
        type: faker.helpers.arrayElement([
          "MISSION_ASSIGNED",
          "MISSION_COMPLETED",
          "INCIDENT_VERIFIED",
          "SYSTEM_ALERT",
        ]),
        title: faker.lorem.words(4),
        message: faker.lorem.sentence(),
        referenceType,
        referenceId,
        isRead,
        readAt: isRead ? faker.date.recent() : null,
      },
    });
  }

  console.log("Notifications seeding successfully completed.");
}