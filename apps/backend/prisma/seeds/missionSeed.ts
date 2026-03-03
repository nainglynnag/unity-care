import {
  IncidentStatus,
  MissionStatus,
  MissionAction,
  MissionPriority,
  MissionRole,
} from "../../generated/prisma/client";
import { faker } from "@faker-js/faker";
import { seedPrisma as prisma } from "./client";
import type { UserSeedResult } from "./UserSeed";
import type { AgencySeedResult } from "./AgencySeed";
import type { IncidentSeedResult } from "./IncidentSeed";

faker.seed(24680);

const MISSION_TYPES = [
  "Medical",
  "Rescue",
  "Evacuation",
  "Fire Response",
  "Search",
];

// Thai tracking waypoints near incident areas
const THAI_WAYPOINTS: Array<{ lat: number; lng: number }> = [
  { lat: 13.74, lng: 100.52 },
  { lat: 13.73, lng: 100.51 },
  { lat: 18.8, lng: 98.97 },
  { lat: 7.89, lng: 98.38 },
  { lat: 14.97, lng: 102.09 },
  { lat: 12.93, lng: 100.89 },
  { lat: 16.44, lng: 102.83 },
  { lat: 9.14, lng: 99.33 },
];

const HAS_ACCEPTED: MissionStatus[] = [
  MissionStatus.ACCEPTED,
  MissionStatus.EN_ROUTE,
  MissionStatus.ON_SITE,
  MissionStatus.IN_PROGRESS,
  MissionStatus.COMPLETED,
];
const HAS_EN_ROUTE: MissionStatus[] = [
  MissionStatus.EN_ROUTE,
  MissionStatus.ON_SITE,
  MissionStatus.IN_PROGRESS,
  MissionStatus.COMPLETED,
];
const HAS_ON_SITE: MissionStatus[] = [
  MissionStatus.ON_SITE,
  MissionStatus.IN_PROGRESS,
  MissionStatus.COMPLETED,
];

export interface MissionSeedResult {
  missions: Array<{
    id: string;
    status: MissionStatus;
    agencyId: string | null;
  }>;
}

export async function missionSeed(
  users: UserSeedResult,
  agencyResult: AgencySeedResult,
  incidentResult: IncidentSeedResult,
): Promise<MissionSeedResult> {
  console.log("Seeding missions...");

  const allMissions: MissionSeedResult["missions"] = [];
  const volunteers = users.volunteers;
  const { volunteerAgencyMap, agencies } = agencyResult;

  // Only create missions from VERIFIED / RESOLVED incidents (realistically)
  const eligibleIncidents = incidentResult.incidents.filter(
    (inc) =>
      inc.status === IncidentStatus.VERIFIED ||
      inc.status === IncidentStatus.RESOLVED ||
      inc.status === IncidentStatus.CLOSED,
  );

  if (eligibleIncidents.length === 0) {
    console.log("  No eligible incidents for missions.");
    return { missions: [] };
  }

  // Status distribution pool for variety
  const STATUS_POOL: MissionStatus[] = [
    MissionStatus.CREATED,
    MissionStatus.ASSIGNED,
    MissionStatus.ACCEPTED,
    MissionStatus.EN_ROUTE,
    MissionStatus.ON_SITE,
    MissionStatus.IN_PROGRESS,
    MissionStatus.COMPLETED,
    MissionStatus.COMPLETED,
    MissionStatus.FAILED,
    MissionStatus.CANCELLED,
    MissionStatus.CLOSED,
  ];

  // Track how many missions each volunteer has been assigned to
  const volMissionCount = new Map<string, number>();

  for (const incident of eligibleIncidents) {
    // 1-2 missions per eligible incident
    const missionCount = faker.number.int({ min: 1, max: 2 });

    for (let m = 0; m < missionCount; m++) {
      const status = faker.helpers.arrayElement(STATUS_POOL);

      // Pick an agency
      const agency = faker.helpers.arrayElement(agencies);

      // Find volunteers from that agency who haven't exceeded 5 missions
      const agencyVolunteers = volunteers.filter((v) => {
        const agId = volunteerAgencyMap.get(v.id);
        const count = volMissionCount.get(v.id) ?? 0;
        return agId === agency.id && count < 5;
      });

      if (agencyVolunteers.length === 0) continue;

      const now = new Date();
      const acceptedAt = HAS_ACCEPTED.includes(status)
        ? faker.date.recent({ days: 5 })
        : null;
      const onSiteAt = HAS_ON_SITE.includes(status)
        ? faker.date.recent({ days: 3 })
        : null;
      const completedAt =
        status === MissionStatus.COMPLETED || status === MissionStatus.CLOSED
          ? faker.date.recent({ days: 1 })
          : null;
      const closedAt = status === MissionStatus.CLOSED ? now : null;

      const admin = faker.helpers.arrayElement(users.admins);

      const mission = await prisma.mission.create({
        data: {
          primaryIncidentId: incident.id,
          createdBy: admin.id,
          agencyId: agency.id,
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
          closedAt,
        },
      });

      // CREATED log
      await prisma.missionLog.create({
        data: {
          missionId: mission.id,
          actorId: admin.id,
          action: MissionAction.CREATED,
          note: "Mission created from verified incident.",
        },
      });

      // Leader assignment
      const leader = faker.helpers.arrayElement(agencyVolunteers);
      volMissionCount.set(leader.id, (volMissionCount.get(leader.id) ?? 0) + 1);

      if (status !== MissionStatus.CREATED) {
        await prisma.missionAssignment.create({
          data: {
            missionId: mission.id,
            assignedTo: leader.id,
            assignedBy: admin.id,
            role: MissionRole.LEADER,
          },
        });

        await prisma.missionLog.create({
          data: {
            missionId: mission.id,
            actorId: admin.id,
            action: MissionAction.ASSIGNED,
            note: "Leader assigned to mission.",
          },
        });

        // Optional second member (50% chance)
        const otherVols = agencyVolunteers.filter((v) => v.id !== leader.id);
        if (otherVols.length > 0 && faker.datatype.boolean()) {
          const member = faker.helpers.arrayElement(otherVols);
          volMissionCount.set(
            member.id,
            (volMissionCount.get(member.id) ?? 0) + 1,
          );

          await prisma.missionAssignment.create({
            data: {
              missionId: mission.id,
              assignedTo: member.id,
              assignedBy: admin.id,
              role: MissionRole.MEMBER,
            },
          });
        }
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

        // GPS tracking points along the way
        const trackingCount = faker.number.int({ min: 2, max: 5 });
        const baseWp = faker.helpers.arrayElement(THAI_WAYPOINTS);
        for (let t = 0; t < trackingCount; t++) {
          await prisma.missionTracking.create({
            data: {
              missionId: mission.id,
              volunteerId: leader.id,
              latitude:
                baseWp.lat + faker.number.float({ min: -0.03, max: 0.03 }),
              longitude:
                baseWp.lng + faker.number.float({ min: -0.03, max: 0.03 }),
              recordedAt: faker.date.recent({ days: 2 }),
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

      if (status === MissionStatus.IN_PROGRESS) {
        await prisma.missionLog.create({
          data: {
            missionId: mission.id,
            actorId: leader.id,
            action: MissionAction.STARTED,
            note: "Mission work in progress.",
          },
        });
      }

      if (
        status === MissionStatus.COMPLETED ||
        status === MissionStatus.CLOSED
      ) {
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
            casualties: faker.number.int({ min: 0, max: 2 }),
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

      if (status === MissionStatus.CLOSED) {
        await prisma.missionLog.create({
          data: {
            missionId: mission.id,
            actorId: admin.id,
            action: MissionAction.CLOSED,
            note: "Mission closed by admin.",
          },
        });
      }

      if (status === MissionStatus.FAILED) {
        await prisma.missionLog.create({
          data: {
            missionId: mission.id,
            actorId: leader.id,
            action: MissionAction.FAILED,
            note: "Mission could not be completed.",
          },
        });
      }

      if (status === MissionStatus.CANCELLED) {
        await prisma.missionLog.create({
          data: {
            missionId: mission.id,
            actorId: admin.id,
            action: MissionAction.CANCELLED,
            note: "Mission cancelled.",
          },
        });
      }

      allMissions.push({ id: mission.id, status, agencyId: agency.id });
    }
  }

  console.log(
    `  Created ${allMissions.length} missions from ${eligibleIncidents.length} eligible incidents.`,
  );
  return { missions: allMissions };
}
