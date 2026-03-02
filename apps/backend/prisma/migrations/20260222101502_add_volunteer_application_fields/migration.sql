-- AlterTable
ALTER TABLE "VolunteerApplication" ADD COLUMN     "address" TEXT,
ADD COLUMN     "consentGiven" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consentGivenAt" TIMESTAMP(3),
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "experience" TEXT,
ADD COLUMN     "hasTransport" BOOLEAN,
ADD COLUMN     "nationalIdNumber" TEXT,
ADD COLUMN     "nationalIdUrl" TEXT;

-- CreateTable
CREATE TABLE "ApplicationCertificate" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "issuedBy" TEXT,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicationCertificate_applicationId_idx" ON "ApplicationCertificate"("applicationId");

-- CreateIndex
CREATE INDEX "VolunteerApplication_userId_idx" ON "VolunteerApplication"("userId");

-- CreateIndex
CREATE INDEX "VolunteerApplication_status_idx" ON "VolunteerApplication"("status");

-- AddForeignKey
ALTER TABLE "ApplicationCertificate" ADD CONSTRAINT "ApplicationCertificate_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "VolunteerApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
