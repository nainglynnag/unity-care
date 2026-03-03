import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

// Single shared Prisma client for all seed files.
// Avoids creating multiple adapter instances.
const adapter = new PrismaPg({
  connectionString: `${process.env.DATABASE_URL}`,
});

export const seedPrisma = new PrismaClient({ adapter });
