-- AlterTable
ALTER TABLE "IncidentVerification" ADD COLUMN     "assignedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "assignedBy" TEXT,
ADD COLUMN     "assignedTo" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "IncidentVerification_assignedTo_idx" ON "IncidentVerification"("assignedTo");

-- AddForeignKey
ALTER TABLE "IncidentVerification" ADD CONSTRAINT "IncidentVerification_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentVerification" ADD CONSTRAINT "IncidentVerification_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentVerification" ADD CONSTRAINT "IncidentVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "IncidentVerification"
SET
  "assignedTo" = "verifiedBy",
  "assignedBy" = "verifiedBy",
  "assignedAt" = "createdAt"
WHERE "assignedTo" IS NULL;
