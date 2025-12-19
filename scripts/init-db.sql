-- Inizializzazione database SQLite per test
-- Crea tutte le tabelle necessarie

-- Tabella organizations
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL,
  vat_number TEXT,
  tax_code TEXT,
  org_type TEXT NOT NULL,
  address_line TEXT NOT NULL,
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  region TEXT NOT NULL,
  country TEXT DEFAULT 'IT',
  status TEXT DEFAULT 'ACTIVE',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabella users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  password_hash TEXT,
  email_verified INTEGER DEFAULT 0,
  email_verified_at DATETIME,
  oauth_provider TEXT,
  oauth_id TEXT,
  reset_token TEXT,
  reset_token_expires DATETIME,
  status TEXT DEFAULT 'ACTIVE',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabella org_memberships
CREATE TABLE IF NOT EXISTS org_memberships (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(org_id, user_id)
);

-- Tabella products
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  product_type TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT,
  name TEXT NOT NULL,
  specs_json TEXT,
  specs_core_json TEXT,
  specs_extra_json TEXT,
  videos_json TEXT,
  glb_files_json TEXT,
  images_json TEXT,
  manuals_extracted_json TEXT,
  manuals_pdf_json TEXT,
  status TEXT DEFAULT 'ACTIVE'
);

-- Tabella skus
CREATE TABLE IF NOT EXISTS skus (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  sku_code TEXT UNIQUE NOT NULL,
  variant_tags TEXT, -- JSON array
  uom TEXT DEFAULT 'unit',
  status TEXT DEFAULT 'ACTIVE',
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Tabella locations
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address_json TEXT,
  city TEXT,
  province TEXT,
  region TEXT,
  country TEXT DEFAULT 'IT',
  lat REAL,
  lon REAL,
  is_hub INTEGER DEFAULT 0,
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE(org_id, name)
);

-- Tabella inventories
CREATE TABLE IF NOT EXISTS inventories (
  id TEXT PRIMARY KEY,
  vendor_org_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  sku_id TEXT NOT NULL,
  qty_on_hand INTEGER DEFAULT 0,
  qty_reserved INTEGER DEFAULT 0,
  FOREIGN KEY (vendor_org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
  FOREIGN KEY (sku_id) REFERENCES skus(id) ON DELETE RESTRICT,
  UNIQUE(vendor_org_id, location_id, sku_id)
);

-- Tabella price_lists
CREATE TABLE IF NOT EXISTS price_lists (
  id TEXT PRIMARY KEY,
  vendor_org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  currency TEXT DEFAULT 'EUR',
  valid_from DATETIME NOT NULL,
  valid_to DATETIME,
  status TEXT DEFAULT 'ACTIVE',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE(vendor_org_id, name)
);

-- Tabella price_list_items
CREATE TABLE IF NOT EXISTS price_list_items (
  id TEXT PRIMARY KEY,
  price_list_id TEXT NOT NULL,
  sku_id TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  tax_code TEXT,
  constraints_json TEXT,
  FOREIGN KEY (price_list_id) REFERENCES price_lists(id) ON DELETE CASCADE,
  FOREIGN KEY (sku_id) REFERENCES skus(id) ON DELETE CASCADE,
  UNIQUE(price_list_id, sku_id)
);

-- Tabella vendor_catalog_items
CREATE TABLE IF NOT EXISTS vendor_catalog_items (
  id TEXT PRIMARY KEY,
  vendor_org_id TEXT NOT NULL,
  sku_id TEXT NOT NULL,
  is_for_sale INTEGER DEFAULT 1,
  is_for_rent INTEGER DEFAULT 0,
  lead_time_days INTEGER,
  notes TEXT,
  FOREIGN KEY (vendor_org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (sku_id) REFERENCES skus(id) ON DELETE CASCADE,
  UNIQUE(vendor_org_id, sku_id)
);
