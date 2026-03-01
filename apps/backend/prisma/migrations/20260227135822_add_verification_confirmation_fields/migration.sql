/*
  Warnings:

  - You are about to drop the column `userId` on the `IncidentVerification` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "IncidentVerification" DROP CONSTRAINT "IncidentVerification_userId_fkey";

-- DropForeignKey
ALTER TABLE "IncidentVerification" DROP CONSTRAINT "IncidentVerification_verifiedBy_fkey";

-- AlterTable
ALTER TABLE "IncidentVerification" DROP COLUMN "userId",
ADD COLUMN     "confirmNote" TEXT,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedBy" TEXT,
ADD COLUMN     "isConfirmed" BOOLEAN,
ALTER COLUMN "decision" DROP NOT NULL,
ALTER COLUMN "verifiedBy" DROP NOT NULL,
ALTER COLUMN "assignedAt" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "IncidentVerification" ADD CONSTRAINT "IncidentVerification_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentVerification" ADD CONSTRAINT "IncidentVerification_confirmedBy_fkey" FOREIGN KEY ("confirmedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
