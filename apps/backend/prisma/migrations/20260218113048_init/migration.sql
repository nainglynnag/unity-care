/*
  Warnings:

  - The values [UNDER_REVIEW,REJECTED,MISSION_CREATED,IN_RESPONSE] on the enum `IncidentStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [APPROVE,REJECT] on the enum `VerificationDecision` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `accuracyLevel` on the `Incident` table. All the data in the column will be lost.
  - You are about to drop the column `arrivalAt` on the `Mission` table. All the data in the column will be lost.
  - You are about to drop the column `assignedAt` on the `Mission` table. All the data in the column will be lost.
  - The primary key for the `MissionAssignment` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `MissionAssignment` table. All the data in the column will be lost.
  - You are about to drop the column `deleteAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `certifications` on the `VolunteerProfile` table. All the data in the column will be lost.
  - You are about to drop the column `skills` on the `VolunteerProfile` table. All the data in the column will be lost.
  - Added the required column `missionType` to the `Mission` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `priority` on the `Mission` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `role` to the `MissionAssignment` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `Notification` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `agencyId` to the `VolunteerApplication` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MissionPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MissionRole" AS ENUM ('LEADER', 'MEMBER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INCIDENT_CREATED', 'INCIDENT_STATUS_UPDATED', 'VERIFICATION_REQUESTED', 'VERIFICATION_COMPLETED', 'MISSION_CREATED', 'MISSION_ASSIGNED', 'MISSION_ACCEPTED', 'MISSION_REJECTED', 'MISSION_EN_ROUTE', 'MISSION_ON_SITE', 'MISSION_COMPLETED', 'MISSION_FAILED', 'APPLICATION_SUBMITTED', 'APPLICATION_REVIEWED', 'GENERAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApplicationStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "ApplicationStatus" ADD VALUE 'WITHDRAWN';

-- AlterEnum
BEGIN;
CREATE TYPE "IncidentStatus_new" AS ENUM ('REPORTED', 'AWAITING_VERIFICATION', 'VERIFIED', 'UNREACHABLE', 'FALSE_REPORT', 'RESOLVED', 'CLOSED');
ALTER TABLE "Incident" ALTER COLUMN "status" TYPE "IncidentStatus_new" USING ("status"::text::"IncidentStatus_new");
ALTER TYPE "IncidentStatus" RENAME TO "IncidentStatus_old";
ALTER TYPE "IncidentStatus_new" RENAME TO "IncidentStatus";
DROP TYPE "public"."IncidentStatus_old";
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MissionAction" ADD VALUE 'REJECTED';
ALTER TYPE "MissionAction" ADD VALUE 'FAILED';
ALTER TYPE "MissionAction" ADD VALUE 'CLOSED';

-- AlterEnum
ALTER TYPE "MissionStatus" ADD VALUE 'CLOSED';

-- AlterEnum
BEGIN;
CREATE TYPE "VerificationDecision_new" AS ENUM ('VERIFIED', 'UNREACHABLE', 'FALSE_REPORT');
ALTER TABLE "IncidentVerification" ALTER COLUMN "decision" TYPE "VerificationDecision_new" USING ("decision"::text::"VerificationDecision_new");
ALTER TYPE "VerificationDecision" RENAME TO "VerificationDecision_old";
ALTER TYPE "VerificationDecision_new" RENAME TO "VerificationDecision";
DROP TYPE "public"."VerificationDecision_old";
COMMIT;

-- DropIndex
DROP INDEX "MissionAssignment_assignedTo_idx";

-- AlterTable
ALTER TABLE "Incident" DROP COLUMN "accuracyLevel",
ADD COLUMN     "accuracy" "LocationAccuracy";

-- AlterTable
ALTER TABLE "Mission" DROP COLUMN "arrivalAt",
DROP COLUMN "assignedAt",
ADD COLUMN     "missionType" TEXT NOT NULL,
ADD COLUMN     "onSiteAt" TIMESTAMP(3),
DROP COLUMN "priority",
ADD COLUMN     "priority" "MissionPriority" NOT NULL;

-- AlterTable
ALTER TABLE "MissionAssignment" DROP CONSTRAINT "MissionAssignment_pkey",
DROP COLUMN "id",
ADD COLUMN     "role" "MissionRole" NOT NULL,
ADD CONSTRAINT "MissionAssignment_pkey" PRIMARY KEY ("missionId", "assignedTo");

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "type",
ADD COLUMN     "type" "NotificationType" NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "deleteAt",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "profileImageUrl" TEXT;

-- AlterTable
ALTER TABLE "VolunteerApplication" ADD COLUMN     "agencyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "VolunteerProfile" DROP COLUMN "certifications",
DROP COLUMN "skills";

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolunteerSkill" (
    "volunteerId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "VolunteerSkill_pkey" PRIMARY KEY ("volunteerId","skillId")
);

-- CreateTable
CREATE TABLE "MissionTracking" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionTracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- CreateIndex
CREATE INDEX "MissionTracking_missionId_idx" ON "MissionTracking"("missionId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- AddForeignKey
ALTER TABLE "VolunteerSkill" ADD CONSTRAINT "VolunteerSkill_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "VolunteerProfile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerSkill" ADD CONSTRAINT "VolunteerSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerApplication" ADD CONSTRAINT "VolunteerApplication_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionTracking" ADD CONSTRAINT "MissionTracking_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionTracking" ADD CONSTRAINT "MissionTracking_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
