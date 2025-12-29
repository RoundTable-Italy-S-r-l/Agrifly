/*
  Warnings:

  - You are about to drop the column `accepted_service_types` on the `service_configurations` table. All the data in the column will be lost.
  - You are about to drop the column `accepted_terrain_conditions` on the `service_configurations` table. All the data in the column will be lost.
  - You are about to drop the column `enable_offer_filters` on the `service_configurations` table. All the data in the column will be lost.
  - You are about to drop the column `max_accepted_slope` on the `service_configurations` table. All the data in the column will be lost.
  - You are about to drop the column `max_distance_from_base` on the `service_configurations` table. All the data in the column will be lost.
  - You are about to drop the column `max_price_per_ha_cents` on the `service_configurations` table. All the data in the column will be lost.
  - You are about to drop the column `min_price_per_ha_cents` on the `service_configurations` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_service_configurations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "base_location_lat" REAL,
    "base_location_lng" REAL,
    "base_location_address" TEXT,
    "working_hours_start" INTEGER NOT NULL DEFAULT 8,
    "working_hours_end" INTEGER NOT NULL DEFAULT 18,
    "available_days" TEXT NOT NULL DEFAULT 'MON,TUE,WED,THU,FRI',
    "offer_message_template" TEXT,
    "rejection_message_template" TEXT,
    "available_drones" TEXT,
    "preferred_terrain" TEXT,
    "max_slope_percentage" REAL,
    "fuel_surcharge_cents" INTEGER NOT NULL DEFAULT 0,
    "maintenance_surcharge_cents" INTEGER NOT NULL DEFAULT 0,
    "enable_job_filters" BOOLEAN NOT NULL DEFAULT false,
    "operating_regions" TEXT,
    "offered_service_types" TEXT,
    "hourly_rate_min_cents" INTEGER,
    "hourly_rate_max_cents" INTEGER,
    "manageable_terrain" TEXT,
    "max_manageable_slope" REAL,
    "work_start_hour" INTEGER NOT NULL DEFAULT 8,
    "work_end_hour" INTEGER NOT NULL DEFAULT 18,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "service_configurations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_service_configurations" ("available_days", "available_drones", "base_location_address", "base_location_lat", "base_location_lng", "created_at", "fuel_surcharge_cents", "id", "maintenance_surcharge_cents", "max_slope_percentage", "offer_message_template", "org_id", "preferred_terrain", "rejection_message_template", "updated_at", "working_hours_end", "working_hours_start") SELECT "available_days", "available_drones", "base_location_address", "base_location_lat", "base_location_lng", "created_at", "fuel_surcharge_cents", "id", "maintenance_surcharge_cents", "max_slope_percentage", "offer_message_template", "org_id", "preferred_terrain", "rejection_message_template", "updated_at", "working_hours_end", "working_hours_start" FROM "service_configurations";
DROP TABLE "service_configurations";
ALTER TABLE "new_service_configurations" RENAME TO "service_configurations";
CREATE UNIQUE INDEX "service_configurations_org_id_key" ON "service_configurations"("org_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
