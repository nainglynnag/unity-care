import { faker } from "@faker-js/faker";
import { seedPrisma as prisma } from "./client";
import type { UserSeedResult } from "./UserSeed";
import type { IncidentSeedResult } from "./IncidentSeed";
import type { MissionSeedResult } from "./missionSeed";

faker.seed(88888);

export async function auditLogSeed(
  users: UserSeedResult,
  incidentResult: IncidentSeedResult,
  missionResult: MissionSeedResult,
): Promise<void> {
  console.log("Seeding audit logs...");

  let count = 0;

  // User creation logs (admins "created" their own accounts — system action)
  const allAdmins = [users.superadmin, ...users.admins];
  for (const admin of allAdmins) {
    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: "CREATE",
        entityType: "USER",
        entityId: admin.id,
        metadata: {
          ip: faker.internet.ip(),
          userAgent: faker.internet.userAgent(),
          description: "Admin account created.",
        },
      },
    });
    count++;
  }

  // Incident-related audit logs
  for (const incident of incidentResult.incidents) {
    // CREATE log from reporter
    if (incident.reportedBy) {
      await prisma.auditLog.create({
        data: {
          actorId: incident.reportedBy,
          action: "CREATE",
          entityType: "INCIDENT",
          entityId: incident.id,
          metadata: {
            ip: faker.internet.ip(),
            status: incident.status,
          },
        },
      });
      count++;
    }

    // VERIFY/UPDATE log from admin for verified+ incidents
    if (["VERIFIED", "RESOLVED", "CLOSED"].includes(incident.status)) {
      const admin = faker.helpers.arrayElement(users.admins);
      await prisma.auditLog.create({
        data: {
          actorId: admin.id,
          action: "VERIFY",
          entityType: "INCIDENT",
          entityId: incident.id,
          metadata: {
            ip: faker.internet.ip(),
            decision: "VERIFIED",
          },
        },
      });
      count++;
    }

    if (incident.status === "FALSE_REPORT") {
      const admin = faker.helpers.arrayElement(users.admins);
      await prisma.auditLog.create({
        data: {
          actorId: admin.id,
          action: "UPDATE",
          entityType: "INCIDENT",
          entityId: incident.id,
          metadata: {
            ip: faker.internet.ip(),
            decision: "FALSE_REPORT",
            description: "Marked as false report.",
          },
        },
      });
      count++;
    }
  }

  // Mission-related audit logs
  for (const mission of missionResult.missions) {
    const admin = faker.helpers.arrayElement(users.admins);

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: "CREATE",
        entityType: "MISSION",
        entityId: mission.id,
        metadata: {
          ip: faker.internet.ip(),
          status: mission.status,
          agencyId: mission.agencyId,
        },
      },
    });
    count++;

    if (mission.status === "COMPLETED" || mission.status === "CLOSED") {
      await prisma.auditLog.create({
        data: {
          actorId: admin.id,
          action: "COMPLETE",
          entityType: "MISSION",
          entityId: mission.id,
          metadata: {
            ip: faker.internet.ip(),
            finalStatus: mission.status,
          },
        },
      });
      count++;
    }
  }

  // A few general system audit entries
  for (let i = 0; i < 5; i++) {
    const admin = faker.helpers.arrayElement(allAdmins);
    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: faker.helpers.arrayElement([
          "LOGIN",
          "LOGOUT",
          "UPDATE_SETTINGS",
        ]),
        entityType: "SYSTEM",
        metadata: {
          ip: faker.internet.ip(),
          userAgent: faker.internet.userAgent(),
          timestamp: faker.date.recent({ days: 30 }).toISOString(),
        },
      },
    });
    count++;
  }

  console.log(`  Created ${count} audit logs.`);
}
