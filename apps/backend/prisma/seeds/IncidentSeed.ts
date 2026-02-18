import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  IncidentStatus,
  MediaType,
  VerificationDecision,
  LocationAccuracy,
} from "../../generated/prisma/client";
import { faker } from "@faker-js/faker";

const adapter = new PrismaPg({
  connectionString: `${process.env.DATABASE_URL}`,
});
const prisma = new PrismaClient({ adapter });

faker.seed(98765);

export async function incidentSeed() {
  console.log("Seeding incidents is starting...");

  // Incident categories
  const categoryNames = [
    "Medical Emergency",
    "Traffic Accident",
    "Fire Incident",
    "Crime Report",
    "Other",
  ];

  for (const name of categoryNames) {
    await prisma.incidentCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const categories = await prisma.incidentCategory.findMany();

  // Actors
  const civilians = await prisma.user.findMany({
    where: { roles: { some: { role: { name: "CIVILIAN" } } } },
  });

  const volunteers = await prisma.user.findMany({
    where: { roles: { some: { role: { name: "VOLUNTEER" } } } },
  });

  if (civilians.length === 0) {
    throw new Error("No civilian users found. Please seed users first.");
  }

  // Create incidents
  for (let i = 0; i < 20; i++) {
    const reporter = faker.helpers.arrayElement(civilians);
    const category = faker.helpers.arrayElement(categories);

    // FIX: IncidentStatus enum updated — UNDER_REVIEW replaced by AWAITING_VERIFICATION
    const status = faker.helpers.arrayElement([
      IncidentStatus.REPORTED,
      IncidentStatus.AWAITING_VERIFICATION,
      IncidentStatus.VERIFIED,
    ]);

    const incident = await prisma.incident.create({
      data: {
        title: faker.lorem.sentence({ min: 3, max: 6 }),
        description: faker.lorem.paragraph(),
        status,
        latitude: faker.location.latitude(),
        longitude: faker.location.longitude(),
        addressText: faker.location.streetAddress(),
        landmark: faker.location.secondaryAddress(),
        // FIX: field was renamed from accuracyLevel to accuracy in the new schema
        accuracy: faker.helpers.arrayElement([
          LocationAccuracy.GPS,
          LocationAccuracy.MANUAL,
        ]),
        categoryId: category.id,
        reportedBy: reporter.id,
      },
    });

    // Optional media attachment
    if (faker.datatype.boolean()) {
      await prisma.incidentMedia.create({
        data: {
          incidentId: incident.id,
          uploadedBy: reporter.id,
          mediaType: faker.helpers.arrayElement([
            MediaType.IMAGE,
            MediaType.VIDEO,
          ]),
          url: faker.image.url(),
        },
      });
    }

    // Verification for VERIFIED incidents
    if (status === IncidentStatus.VERIFIED && volunteers.length > 0) {
      const verifier = faker.helpers.arrayElement(volunteers);

      await prisma.incidentVerification.create({
        data: {
          incidentId: incident.id,
          verifiedBy: verifier.id,
          decision: VerificationDecision.VERIFIED,
          comment: faker.lorem.sentence(),
        },
      });
    }

    // Verification for AWAITING_VERIFICATION incidents
    if (
      status === IncidentStatus.AWAITING_VERIFICATION &&
      volunteers.length > 0
    ) {
      const verifier = faker.helpers.arrayElement(volunteers);

      await prisma.incidentVerification.create({
        data: {
          incidentId: incident.id,
          verifiedBy: verifier.id,
          decision: VerificationDecision.VERIFIED, // outcome not yet final; still useful
          comment: "Pending on-site confirmation.",
        },
      });
    }
  }

  console.log("Incident seeding successfully completed.");
}
