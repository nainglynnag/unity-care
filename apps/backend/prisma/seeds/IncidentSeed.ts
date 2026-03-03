import {
  IncidentStatus,
  MediaType,
  VerificationDecision,
  LocationAccuracy,
} from "../../generated/prisma/client";
import { faker } from "@faker-js/faker";
import { seedPrisma as prisma } from "./client";
import type { UserSeedResult } from "./UserSeed";

faker.seed(98765);

const CATEGORY_NAMES = [
  "Medical Emergency",
  "Traffic Accident",
  "Fire Incident",
  "Natural Disaster",
  "Crime Report",
];

// Thai regions for incident locations
const THAI_INCIDENT_LOCATIONS = [
  { lat: 13.74, lng: 100.52, label: "Sukhumvit, Bangkok" },
  { lat: 13.72, lng: 100.48, label: "Silom, Bangkok" },
  { lat: 18.8, lng: 98.97, label: "Nimman, Chiang Mai" },
  { lat: 7.89, lng: 98.38, label: "Old Town, Phuket" },
  { lat: 14.975, lng: 102.09, label: "Korat City Center" },
  { lat: 12.93, lng: 100.89, label: "Walking Street, Pattaya" },
  { lat: 9.14, lng: 99.33, label: "Chaweng, Ko Samui" },
  { lat: 16.438, lng: 102.83, label: "Khon Kaen Bypass" },
  { lat: 14.35, lng: 100.57, label: "Ayutthaya Historical Park" },
  { lat: 7.01, lng: 100.47, label: "Lee Pattana, Hat Yai" },
  { lat: 13.37, lng: 100.98, label: "Laem Chabang, Chonburi" },
  { lat: 19.91, lng: 99.82, label: "Clock Tower, Chiang Rai" },
  { lat: 15.875, lng: 100.98, label: "Phitsanulok Riverside" },
  { lat: 17.01, lng: 99.01, label: "Sukhothai Historical Park" },
  { lat: 8.435, lng: 99.97, label: "Surat Thani Pier" },
];

export interface IncidentSeedResult {
  incidents: Array<{
    id: string;
    status: IncidentStatus;
    reportedBy: string | null;
  }>;
  categories: Array<{ id: string; name: string }>;
}

export async function incidentSeed(
  users: UserSeedResult,
): Promise<IncidentSeedResult> {
  console.log("Seeding incidents...");

  // Upsert categories
  for (const name of CATEGORY_NAMES) {
    await prisma.incidentCategory.upsert({
      where: { name },
      update: {},
      create: {
        name,
        description: `Incidents related to ${name.toLowerCase()}.`,
      },
    });
  }
  const categories = await prisma.incidentCategory.findMany();

  const allIncidents: IncidentSeedResult["incidents"] = [];
  const civilians = users.civilians;
  const volunteers = users.volunteers;

  // Status distribution pool — varied across the enum
  const STATUS_POOL: IncidentStatus[] = [
    IncidentStatus.REPORTED,
    IncidentStatus.REPORTED,
    IncidentStatus.AWAITING_VERIFICATION,
    IncidentStatus.AWAITING_VERIFICATION,
    IncidentStatus.VERIFIED,
    IncidentStatus.VERIFIED,
    IncidentStatus.VERIFIED,
    IncidentStatus.UNREACHABLE,
    IncidentStatus.FALSE_REPORT,
    IncidentStatus.RESOLVED,
    IncidentStatus.CLOSED,
  ];

  let locIdx = 0;

  for (const civilian of civilians) {
    // 0-3 incidents per civilian (some may have 0)
    const incidentCount = faker.number.int({ min: 0, max: 3 });

    for (let j = 0; j < incidentCount; j++) {
      const status = faker.helpers.arrayElement(STATUS_POOL);
      const loc =
        THAI_INCIDENT_LOCATIONS[locIdx % THAI_INCIDENT_LOCATIONS.length]!;
      locIdx++;

      const createdAt = faker.date.recent({ days: 60 });

      const incident = await prisma.incident.create({
        data: {
          title: faker.lorem.sentence({ min: 3, max: 7 }),
          description: faker.lorem.paragraph(),
          status,
          latitude: loc.lat + faker.number.float({ min: -0.01, max: 0.01 }),
          longitude: loc.lng + faker.number.float({ min: -0.01, max: 0.01 }),
          addressText: loc.label,
          landmark:
            faker.helpers.maybe(() => faker.location.secondaryAddress()) ??
            null,
          accuracy: faker.helpers.arrayElement([
            LocationAccuracy.GPS,
            LocationAccuracy.MANUAL,
          ]),
          categoryId: faker.helpers.arrayElement(categories).id,
          reportedBy: civilian.id,
          createdAt,
        },
      });

      // Attach media (60% chance)
      if (faker.number.float({ min: 0, max: 1 }) < 0.6) {
        const mediaCount = faker.number.int({ min: 1, max: 2 });
        for (let m = 0; m < mediaCount; m++) {
          await prisma.incidentMedia.create({
            data: {
              incidentId: incident.id,
              uploadedBy: civilian.id,
              mediaType: faker.helpers.arrayElement([
                MediaType.IMAGE,
                MediaType.VIDEO,
              ]),
              url: faker.image.url(),
            },
          });
        }
      }

      // Verifications based on status
      if (
        status === IncidentStatus.VERIFIED ||
        status === IncidentStatus.RESOLVED ||
        status === IncidentStatus.CLOSED
      ) {
        const verifier = faker.helpers.arrayElement(volunteers);
        const admin = faker.helpers.arrayElement(users.admins);
        await prisma.incidentVerification.create({
          data: {
            incidentId: incident.id,
            verifiedBy: verifier.id,
            decision: VerificationDecision.VERIFIED,
            comment: "Verified by on-site volunteer.",
            assignedTo: verifier.id,
            assignedBy: admin.id,
            assignedAt: faker.date.recent({ days: 30 }),
            submittedAt: faker.date.recent({ days: 28 }),
            isConfirmed: true,
            confirmedBy: admin.id,
            confirmedAt: faker.date.recent({ days: 25 }),
            confirmNote: "Confirmed by admin review.",
          },
        });
      }

      if (status === IncidentStatus.AWAITING_VERIFICATION) {
        const verifier = faker.helpers.arrayElement(volunteers);
        const admin = faker.helpers.arrayElement(users.admins);
        await prisma.incidentVerification.create({
          data: {
            incidentId: incident.id,
            verifiedBy: verifier.id,
            decision: null,
            comment: "Pending on-site confirmation.",
            assignedTo: verifier.id,
            assignedBy: admin.id,
            assignedAt: faker.date.recent({ days: 10 }),
          },
        });
      }

      if (status === IncidentStatus.UNREACHABLE) {
        const verifier = faker.helpers.arrayElement(volunteers);
        await prisma.incidentVerification.create({
          data: {
            incidentId: incident.id,
            verifiedBy: verifier.id,
            decision: VerificationDecision.UNREACHABLE,
            comment: "Location inaccessible — road blocked.",
            submittedAt: faker.date.recent({ days: 20 }),
          },
        });
      }

      if (status === IncidentStatus.FALSE_REPORT) {
        const admin = faker.helpers.arrayElement(users.admins);
        await prisma.incidentVerification.create({
          data: {
            incidentId: incident.id,
            verifiedBy: admin.id,
            decision: VerificationDecision.FALSE_REPORT,
            comment: "Duplicate / prank report.",
            submittedAt: faker.date.recent({ days: 15 }),
            isConfirmed: true,
            confirmedBy: admin.id,
            confirmedAt: faker.date.recent({ days: 14 }),
          },
        });
      }

      allIncidents.push({ id: incident.id, status, reportedBy: civilian.id });
    }
  }

  console.log(
    `  Created ${allIncidents.length} incidents across ${civilians.length} civilians.`,
  );
  return { incidents: allIncidents, categories };
}
