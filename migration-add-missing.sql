[dotenv@17.2.3] injecting env (10) from .env -- tip: 🔐 encrypt with Dotenvx: https://dotenvx.com
✅ Connesso a Supabase

📊 GENERAZIONE SCRIPT MIGRAZIONE SQL

-- ============================================================
-- Script di migrazione per aggiungere colonne/tabelle mancanti
-- Generato automaticamente
-- ============================================================

-- ============================================================
-- Tabelle mancanti da creare
-- ============================================================

-- Tabella: order_items
CREATE TABLE IF NOT EXISTS order_items (
  id VARCHAR(255) PRIMARY KEY,
  order_id VARCHAR(255),
  sku_id VARCHAR(255),
  quantity INTEGER,
  unit_price_cents INTEGER,
  total_cents INTEGER
);

-- Tabella: organization_settings
CREATE TABLE IF NOT EXISTS organization_settings (
  id VARCHAR(255) PRIMARY KEY,
  org_id VARCHAR(255),
  setting_key VARCHAR(255),
  setting_value TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Colonne mancanti da aggiungere
-- ============================================================

-- Tabella: skus
ALTER TABLE skus ADD COLUMN IF NOT EXISTS variant_name TEXT;

-- Tabella: price_list_items
ALTER TABLE price_list_items ADD COLUMN IF NOT EXISTS currency VARCHAR(10);

-- Tabella: assets
ALTER TABLE assets ADD COLUMN IF NOT EXISTS productid TEXT;

-- Tabella: locations
ALTER TABLE locations ADD COLUMN IF NOT EXISTS address_line TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS country VARCHAR(2);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,8);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS longitude NUMERIC(11,8);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_default BOOLEAN;

-- Tabella: job_offer_messages
ALTER TABLE job_offer_messages ADD COLUMN IF NOT EXISTS sender_org_id TEXT;
ALTER TABLE job_offer_messages ADD COLUMN IF NOT EXISTS message_text TEXT;
ALTER TABLE job_offer_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN;

-- Tabella: bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;

-- Tabella: service_area_sets
ALTER TABLE service_area_sets ADD COLUMN IF NOT EXISTS org_id VARCHAR(255);

-- Tabella: orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS vendor_org_id VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address_id VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_address_id VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Tabella: order_messages
ALTER TABLE order_messages ADD COLUMN IF NOT EXISTS sender_org_id TEXT;
ALTER TABLE order_messages ADD COLUMN IF NOT EXISTS message_text TEXT;
ALTER TABLE order_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN;

-- Tabella: organization_invitations
ALTER TABLE organization_invitations ADD COLUMN IF NOT EXISTS org_id VARCHAR(255);
ALTER TABLE organization_invitations ADD COLUMN IF NOT EXISTS status VARCHAR(50);

-- ============================================================
-- Fine script migrazione
-- ============================================================

