-- AlterTable
ALTER TABLE "stays" ADD COLUMN "accommodation_facts" JSONB;
ALTER TABLE "stays" ADD COLUMN "accommodation_label" TEXT;
ALTER TABLE "stays" ADD COLUMN "accommodation_type" TEXT;
ALTER TABLE "stays" ADD COLUMN "facts_synced_at" DATETIME;
ALTER TABLE "stays" ADD COLUMN "geo_label" TEXT;
ALTER TABLE "stays" ADD COLUMN "geo_precision" TEXT;
ALTER TABLE "stays" ADD COLUMN "meeting_point" TEXT;
ALTER TABLE "stays" ADD COLUMN "source_facts" JSONB;
