/*
  Warnings:

  - Added the required column `latitude` to the `Agency` table without a default value. This is not possible if the table is not empty.
  - Added the required column `longitude` to the `Agency` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: add columns as nullable first, backfill, then make NOT NULL
ALTER TABLE "Agency" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Agency" ADD COLUMN "longitude" DOUBLE PRECISION;

-- Backfill existing rows with Bangkok center (13.7563, 100.5018)
UPDATE "Agency" SET "latitude" = 13.7563, "longitude" = 100.5018
WHERE "latitude" IS NULL;

-- Now enforce NOT NULL
ALTER TABLE "Agency" ALTER COLUMN "latitude" SET NOT NULL;
ALTER TABLE "Agency" ALTER COLUMN "longitude" SET NOT NULL;
