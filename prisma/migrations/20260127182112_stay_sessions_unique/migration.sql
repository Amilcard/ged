/*
  Warnings:

  - A unique constraint covering the columns `[stay_id,start_date,end_date]` on the table `stay_sessions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "stay_sessions_stay_id_start_date_end_date_key" ON "stay_sessions"("stay_id", "start_date", "end_date");
