-- AlterTable: drop DB default on id (Prisma generates UUIDs at app level)
ALTER TABLE "MissionAssignment" ALTER COLUMN "id" DROP DEFAULT;

-- RenameForeignKey: match Prisma naming convention after column rename
ALTER TABLE "Mission" RENAME CONSTRAINT "Mission_incidentId_fkey" TO "Mission_primaryIncidentId_fkey";
