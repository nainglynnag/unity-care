import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { userSeed } from "./seeds/UserSeed";
import { incidentSeed } from "./seeds/IncidentSeed";
import { missionSeed } from "./seeds/missionSeed";
import { notificationSeed } from "./seeds/notificationSeed";
import { auditLogSeed } from "./seeds/AuditLogSeed";
import { agencySeed } from "./seeds/AgencySeed";

const adapter = new PrismaPg({
  connectionString: `${process.env.DATABASE_URL}`,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting full database seed...\n");

  await userSeed();
  await agencySeed();
  await incidentSeed();
  await missionSeed();
  await notificationSeed();
  await auditLogSeed();

  console.log("\nAll seeds completed successfully.");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
