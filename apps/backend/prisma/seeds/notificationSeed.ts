import { NotificationType } from "../../generated/prisma/client";
import { faker } from "@faker-js/faker";
import { seedPrisma as prisma } from "./client";
import type { UserSeedResult } from "./UserSeed";
import type { IncidentSeedResult } from "./IncidentSeed";
import type { MissionSeedResult } from "./missionSeed";

faker.seed(77777);

export async function notificationSeed(
  users: UserSeedResult,
  incidentResult: IncidentSeedResult,
  missionResult: MissionSeedResult,
): Promise<void> {
  console.log("Seeding notifications...");

  const allUsers = [
    users.superadmin,
    ...users.admins,
    ...users.civilians,
    ...users.volunteers,
  ];
  let count = 0;

  // Incident-related notifications for civilians who reported
  for (const incident of incidentResult.incidents) {
    if (!incident.reportedBy) continue;

    // Reporter gets INCIDENT_CREATED notification
    await prisma.notification.create({
      data: {
        userId: incident.reportedBy,
        type: NotificationType.INCIDENT_CREATED,
        title: "Incident Reported",
        message: "Your incident report has been submitted successfully.",
        referenceType: "INCIDENT",
        referenceId: incident.id,
        isRead: faker.datatype.boolean(),
        readAt: faker.datatype.boolean()
          ? faker.date.recent({ days: 30 })
          : null,
      },
    });
    count++;

    // Status update notification (for non-REPORTED incidents)
    if (incident.status !== "REPORTED") {
      const isRead = faker.datatype.boolean();
      await prisma.notification.create({
        data: {
          userId: incident.reportedBy,
          type: NotificationType.INCIDENT_STATUS_UPDATED,
          title: "Incident Status Updated",
          message: `Your incident status changed to ${incident.status}.`,
          referenceType: "INCIDENT",
          referenceId: incident.id,
          isRead,
          readAt: isRead ? faker.date.recent({ days: 20 }) : null,
        },
      });
      count++;
    }
  }

  // Admins get verification-related notifications
  for (const admin of users.admins) {
    const verifiedIncidents = incidentResult.incidents.filter(
      (i) =>
        i.status === "VERIFIED" ||
        i.status === "RESOLVED" ||
        i.status === "CLOSED",
    );
    for (const inc of verifiedIncidents.slice(0, 3)) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          type: NotificationType.VERIFICATION_COMPLETED,
          title: "Verification Completed",
          message: "An incident verification has been completed and confirmed.",
          referenceType: "INCIDENT",
          referenceId: inc.id,
          isRead: true,
          readAt: faker.date.recent({ days: 15 }),
        },
      });
      count++;
    }
  }

  // Mission-related notifications for assigned volunteers
  for (const mission of missionResult.missions) {
    // Find assignments for this mission
    const assignments = await prisma.missionAssignment.findMany({
      where: { missionId: mission.id },
      select: { assignedTo: true },
    });

    for (const assignment of assignments) {
      await prisma.notification.create({
        data: {
          userId: assignment.assignedTo,
          type: NotificationType.MISSION_ASSIGNED,
          title: "New Mission Assignment",
          message: "You have been assigned to a new mission.",
          referenceType: "MISSION",
          referenceId: mission.id,
          isRead: faker.datatype.boolean(),
          readAt: faker.datatype.boolean()
            ? faker.date.recent({ days: 10 })
            : null,
        },
      });
      count++;

      // Completed missions → completion notification
      if (mission.status === "COMPLETED" || mission.status === "CLOSED") {
        await prisma.notification.create({
          data: {
            userId: assignment.assignedTo,
            type: NotificationType.MISSION_COMPLETED,
            title: "Mission Completed",
            message: "Your mission has been marked as completed.",
            referenceType: "MISSION",
            referenceId: mission.id,
            isRead: true,
            readAt: faker.date.recent({ days: 5 }),
          },
        });
        count++;
      }

      // Failed missions → failure notification
      if (mission.status === "FAILED") {
        await prisma.notification.create({
          data: {
            userId: assignment.assignedTo,
            type: NotificationType.MISSION_FAILED,
            title: "Mission Failed",
            message: "Your mission has been marked as failed.",
            referenceType: "MISSION",
            referenceId: mission.id,
            isRead: false,
          },
        });
        count++;
      }
    }
  }

  // Application-related notifications for volunteers (they all have approved applications)
  for (const vol of users.volunteers.slice(0, 10)) {
    const isRead = faker.datatype.boolean();
    await prisma.notification.create({
      data: {
        userId: vol.id,
        type: NotificationType.APPLICATION_REVIEWED,
        title: "Application Approved",
        message:
          "Your volunteer application has been approved. Welcome aboard!",
        referenceType: "APPLICATION",
        isRead,
        readAt: isRead ? faker.date.recent({ days: 60 }) : null,
      },
    });
    count++;
  }

  // General system notifications for a few random users
  for (let i = 0; i < 5; i++) {
    const user = faker.helpers.arrayElement(allUsers);
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: NotificationType.GENERAL,
        title: "System Update",
        message: faker.helpers.arrayElement([
          "The platform will undergo maintenance tonight at 02:00.",
          "New safety guidelines have been published — please review.",
          "Your profile information has been updated.",
          "Welcome to Unity Care! Complete your profile for full access.",
          "Reminder: Update your availability status regularly.",
        ]),
        referenceType: "SYSTEM",
        isRead: faker.datatype.boolean(),
      },
    });
    count++;
  }

  console.log(`  Created ${count} notifications.`);
}
