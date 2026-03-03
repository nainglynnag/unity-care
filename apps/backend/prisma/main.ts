import "dotenv/config";
import { seedPrisma } from "./seeds/client";
import { userSeed } from "./seeds/UserSeed";
import { agencySeed } from "./seeds/AgencySeed";
import { incidentSeed } from "./seeds/IncidentSeed";
import { missionSeed } from "./seeds/missionSeed";
import { notificationSeed } from "./seeds/notificationSeed";
import { auditLogSeed } from "./seeds/AuditLogSeed";

async function main() {
  console.log("Starting full database seed...\n");

  const users = await userSeed();
  const agencies = await agencySeed(users);
  const incidents = await incidentSeed(users);
  const missions = await missionSeed(users, agencies, incidents);
  await notificationSeed(users, incidents, missions);
  await auditLogSeed(users, incidents, missions);

  console.log("\nAll seeds completed successfully.");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await seedPrisma.$disconnect();
  });
