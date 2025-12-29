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
    "visibility_mode" TEXT NOT NULL DEFAULT 'PUBLIC_VERIFIED',
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
