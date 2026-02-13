/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `IncidentCategory` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "IncidentCategory_name_key" ON "IncidentCategory"("name");
