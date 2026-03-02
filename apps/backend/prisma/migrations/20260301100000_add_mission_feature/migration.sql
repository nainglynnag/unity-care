-- Step 1: Safe rename — preserves all existing Mission rows and FK constraint
ALTER TABLE "Mission" RENAME COLUMN "incidentId" TO "primaryIncidentId";

-- Step 2: Add index on the renamed column
CREATE INDEX "Mission_primaryIncidentId_idx" ON "Mission"("primaryIncidentId");

-- Step 3: Create MissionIncident join table (M:N between missions and linked incidents)
CREATE TABLE "MissionIncident" (
    "missionId"  TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "linkedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkedBy"   TEXT NOT NULL,

    CONSTRAINT "MissionIncident_pkey" PRIMARY KEY ("missionId","incidentId")
);

CREATE INDEX "MissionIncident_incidentId_idx" ON "MissionIncident"("incidentId");

ALTER TABLE "MissionIncident"
    ADD CONSTRAINT "MissionIncident_missionId_fkey"
        FOREIGN KEY ("missionId") REFERENCES "Mission"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MissionIncident"
    ADD CONSTRAINT "MissionIncident_incidentId_fkey"
        FOREIGN KEY ("incidentId") REFERENCES "Incident"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MissionIncident"
    ADD CONSTRAINT "MissionIncident_linkedBy_fkey"
        FOREIGN KEY ("linkedBy") REFERENCES "User"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 4: Change MissionAssignment from composite PK to surrogate PK
--   This allows re-assignment of the same volunteer (assignment history).
ALTER TABLE "MissionAssignment" DROP CONSTRAINT "MissionAssignment_pkey";

ALTER TABLE "MissionAssignment"
    ADD COLUMN "id" TEXT NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE "MissionAssignment"
    ADD CONSTRAINT "MissionAssignment_pkey" PRIMARY KEY ("id");

CREATE INDEX "MissionAssignment_missionId_assignedTo_idx"
    ON "MissionAssignment"("missionId", "assignedTo");

-- Step 5: Add MISSION_CLOSED to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE 'MISSION_CLOSED';
