-- CreateTable
CREATE TABLE "rate_cards" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "service_type" TEXT NOT NULL,
    "crop_type" TEXT,
    "treatment_type" TEXT,
    "terrain_conditions" TEXT,
    "base_rate_per_ha_cents" INTEGER NOT NULL,
    "min_charge_cents" INTEGER NOT NULL,
    "travel_rate_per_km_cents" INTEGER,
    "max_area_per_hour_ha" REAL,
    "liquid_consumption_l_per_ha" REAL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "rate_cards_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "service_configurations" (
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
    "enable_offer_filters" BOOLEAN NOT NULL DEFAULT false,
    "max_distance_from_base" REAL,
    "accepted_service_types" TEXT,
    "min_price_per_ha_cents" INTEGER,
    "max_price_per_ha_cents" INTEGER,
    "accepted_terrain_conditions" TEXT,
    "max_accepted_slope" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "service_configurations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "operator_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "license_number" TEXT,
    "certifications" TEXT,
    "experience_years" INTEGER,
    "max_flight_time_hours" REAL,
    "supported_drone_models" TEXT,
    "availability_schedule" TEXT,
    "preferred_regions" TEXT,
    "completed_missions" INTEGER NOT NULL DEFAULT 0,
    "average_rating" REAL,
    "reliability_score" REAL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_active_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "operator_profiles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "operator_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buyer_org_id" TEXT NOT NULL,
    "broker_org_id" TEXT,
    "service_type" TEXT NOT NULL DEFAULT 'SPRAY',
    "crop_type" TEXT,
    "treatment_type" TEXT,
    "terrain_conditions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "field_name" TEXT,
    "field_polygon" TEXT NOT NULL,
    "area_ha" REAL,
    "location_json" TEXT,
    "requested_window_start" DATETIME,
    "requested_window_end" DATETIME,
    "constraints_json" TEXT,
    "visibility_mode" TEXT DEFAULT 'PUBLIC_VERIFIED',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "jobs_buyer_org_id_fkey" FOREIGN KEY ("buyer_org_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "jobs_broker_org_id_fkey" FOREIGN KEY ("broker_org_id") REFERENCES "organizations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_jobs" ("area_ha", "broker_org_id", "buyer_org_id", "constraints_json", "created_at", "crop_type", "field_name", "field_polygon", "id", "location_json", "requested_window_end", "requested_window_start", "service_type", "status", "terrain_conditions", "treatment_type", "updated_at", "visibility_mode") SELECT "area_ha", "broker_org_id", "buyer_org_id", "constraints_json", "created_at", "crop_type", "field_name", "field_polygon", "id", "location_json", "requested_window_end", "requested_window_start", "service_type", "status", "terrain_conditions", "treatment_type", "updated_at", "visibility_mode" FROM "jobs";
DROP TABLE "jobs";
ALTER TABLE "new_jobs" RENAME TO "jobs";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "rate_cards_org_id_service_type_crop_type_treatment_type_idx" ON "rate_cards"("org_id", "service_type", "crop_type", "treatment_type");

-- CreateIndex
CREATE UNIQUE INDEX "service_configurations_org_id_key" ON "service_configurations"("org_id");

-- CreateIndex
CREATE INDEX "operator_profiles_org_id_is_active_idx" ON "operator_profiles"("org_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "operator_profiles_org_id_user_id_key" ON "operator_profiles"("org_id", "user_id");
