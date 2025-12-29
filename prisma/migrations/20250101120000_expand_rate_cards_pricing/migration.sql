-- Migration: Expand rate_cards table with customizable pricing fields
-- Adds: travel_fixed_cents, hilly_terrain_multiplier, hilly_terrain_surcharge_cents, custom_multipliers_json, custom_surcharges_json

-- SQLite compatible migration
-- Note: SQLite doesn't support ALTER TABLE ADD COLUMN with DEFAULT for existing rows easily
-- So we'll add columns as nullable and handle defaults in application code

-- Add travel_fixed_cents (quota fissa trasporto)
-- Check if column exists (SQLite doesn't support IF NOT EXISTS for ALTER TABLE)
-- For production PostgreSQL, these columns will be added directly

-- SQLite: Add columns one by one (will fail silently if they exist in some SQLite versions)
-- For compatibility, we handle this in the application layer

-- PostgreSQL version:
DO $$
BEGIN
  -- Add travel_fixed_cents if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'rate_cards' AND column_name = 'travel_fixed_cents') THEN
    ALTER TABLE rate_cards ADD COLUMN travel_fixed_cents INTEGER DEFAULT 0;
  END IF;

  -- Add hilly_terrain_multiplier if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'rate_cards' AND column_name = 'hilly_terrain_multiplier') THEN
    ALTER TABLE rate_cards ADD COLUMN hilly_terrain_multiplier REAL;
  END IF;

  -- Add hilly_terrain_surcharge_cents if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'rate_cards' AND column_name = 'hilly_terrain_surcharge_cents') THEN
    ALTER TABLE rate_cards ADD COLUMN hilly_terrain_surcharge_cents INTEGER DEFAULT 0;
  END IF;

  -- Add custom_multipliers_json if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'rate_cards' AND column_name = 'custom_multipliers_json') THEN
    ALTER TABLE rate_cards ADD COLUMN custom_multipliers_json TEXT;
  END IF;

  -- Add custom_surcharges_json if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'rate_cards' AND column_name = 'custom_surcharges_json') THEN
    ALTER TABLE rate_cards ADD COLUMN custom_surcharges_json TEXT;
  END IF;

  -- Rename org_id to seller_org_id if org_id exists and seller_org_id doesn't
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'rate_cards' AND column_name = 'org_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'rate_cards' AND column_name = 'seller_org_id') THEN
    ALTER TABLE rate_cards RENAME COLUMN org_id TO seller_org_id;
  END IF;
END $$;

