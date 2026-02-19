import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { faker } from "@faker-js/faker";

const adapter = new PrismaPg({
  connectionString: `${process.env.DATABASE_URL}`,
});
const prisma = new PrismaClient({ adapter });

faker.seed(88888);

export async function auditLogSeed() {
  console.log("Seeding audit logs is starting...");

  const users = await prisma.user.findMany();
  const incidents = await prisma.incident.findMany();
  const missions = await prisma.mission.findMany();

  if (users.length === 0) {
    console.log("No users found. Please seed users first!");
    return;
  }

  for (let i = 0; i < 50; i++) {
    const actor = faker.helpers.arrayElement(users);

    const entityType = faker.helpers.arrayElement([
      "USER",
      "INCIDENT",
      "MISSION",
    ]);

    let entityId: string | null = null;
    if (entityType === "USER") {
      entityId = faker.helpers.arrayElement(users).id;
    }
    if (entityType === "INCIDENT" && incidents.length > 0) {
      entityId = faker.helpers.arrayElement(incidents).id;
    }
    if (entityType === "MISSION" && missions.length > 0) {
      entityId = faker.helpers.arrayElement(missions).id;
    }

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: faker.helpers.arrayElement([
          "CREATE",
          "UPDATE",
          "DELETE",
          "ASSIGN",
          "VERIFY",
          "COMPLETE",
        ]),
        entityType,
        entityId,
        metadata: {
          ip: faker.internet.ip(),
          userAgent: faker.internet.userAgent(),
          timestamp: new Date().toISOString(),
        },
      },
    });
  }

  console.log("Audit logs seeding successfully completed.");
}
