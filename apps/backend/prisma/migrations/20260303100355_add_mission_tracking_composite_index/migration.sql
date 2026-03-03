-- CreateIndex
CREATE INDEX "MissionTracking_missionId_volunteerId_recordedAt_idx" ON "MissionTracking"("missionId", "volunteerId", "recordedAt");
