import { AgencyRole, ApplicationStatus } from "../../generated/prisma/client";
import { faker } from "@faker-js/faker";
import { seedPrisma as prisma } from "./client";
import type { UserSeedResult } from "./UserSeed";

faker.seed(13579);

const THAI_AGENCIES = [
  {
    name: "Bangkok Emergency Response Unit",
    description:
      "Central Bangkok rapid response team covering the metropolitan area.",
    lat: 13.7563,
    lng: 100.5018,
    region: "Bangkok Metropolitan",
  },
  {
    name: "Northern Rescue Foundation",
    description:
      "Search and rescue operations across Northern Thailand highlands.",
    lat: 18.7883,
    lng: 98.9853,
    region: "Northern Thailand",
  },
  {
    name: "Southern Maritime Safety Corps",
    description:
      "Coastal and maritime emergency response for southern provinces.",
    lat: 7.8804,
    lng: 98.3923,
    region: "Southern Thailand",
  },
];

export interface AgencySeedResult {
  agencies: Array<{ id: string; name: string }>;
  volunteerAgencyMap: Map<string, string>;
}

export async function agencySeed(
  users: UserSeedResult,
): Promise<AgencySeedResult> {
  console.log("Seeding agencies...");

  const agencies: Array<{ id: string; name: string }> = [];
  const volunteerAgencyMap = new Map<string, string>();

  const volunteers = users.volunteers;
  const reviewer = users.admins[0]!;

  // Split 20 volunteers across 3 agencies: 8, 6, 6
  const volunteerSlices = [
    volunteers.slice(0, 8),
    volunteers.slice(8, 14),
    volunteers.slice(14, 20),
  ];

  for (let a = 0; a < THAI_AGENCIES.length; a++) {
    const def = THAI_AGENCIES[a]!;
    const agency = await prisma.agency.create({
      data: {
        name: def.name,
        description: def.description,
        latitude: def.lat,
        longitude: def.lng,
        region: def.region,
      },
    });
    agencies.push(agency);

    const slice = volunteerSlices[a]!;
    for (let i = 0; i < slice.length; i++) {
      const vol = slice[i]!;

      // First volunteer → DIRECTOR, next two → COORDINATOR, rest → MEMBER
      let role: AgencyRole;
      if (i === 0) role = AgencyRole.DIRECTOR;
      else if (i <= 2) role = AgencyRole.COORDINATOR;
      else role = AgencyRole.MEMBER;

      await prisma.agencyMember.create({
        data: {
          agencyId: agency.id,
          userId: vol.id,
          role,
        },
      });

      // Approved application for each member
      await prisma.volunteerApplication.create({
        data: {
          userId: vol.id,
          agencyId: agency.id,
          status: ApplicationStatus.APPROVED,
          reviewedBy: reviewer.id,
          reviewNote: "Approved during agency onboarding.",
          consentGiven: true,
          consentGivenAt: faker.date.past({ years: 1 }),
          submittedAt: faker.date.past({ years: 1 }),
          reviewedAt: faker.date.recent({ days: 180 }),
        },
      });

      volunteerAgencyMap.set(vol.id, agency.id);
    }
  }

  console.log(
    `  Created ${agencies.length} agencies with ${volunteers.length} members total.`,
  );
  return { agencies, volunteerAgencyMap };
}
