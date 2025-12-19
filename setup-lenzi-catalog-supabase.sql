-- Script SQL per Supabase: Inizializza catalogo Lenzi
-- Esegui questo script nell'SQL Editor di Supabase

-- 1. Crea organizzazione Lenzi se non esiste
INSERT INTO organizations (id, legal_name, org_type, address_line, city, province, region, country, status)
VALUES ('lenzi-org-id', 'Lenzi Agricola Srl', 'VENDOR', 'Via Roma 123', 'Verona', 'VR', 'Veneto', 'IT', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 1b. Assicurati che esistano SKU per tutti i prodotti attivi
INSERT INTO skus (id, product_id, sku_code, uom, status)
SELECT
  'sku_' || p.id,
  p.id,
  UPPER(REPLACE(COALESCE(p.brand, 'DJI') || '_' || COALESCE(p.model, p.name), ' ', '_')),
  'unit',
  'ACTIVE'
FROM products p
WHERE p.status = 'ACTIVE'
  AND NOT EXISTS (
    SELECT 1 FROM skus s WHERE s.product_id = p.id
  );

-- 2. Crea PriceList per Lenzi (se non esiste)
INSERT INTO price_lists (id, vendor_org_id, name, currency, valid_from, valid_to, status)
SELECT gen_random_uuid(), 'lenzi-org-id', 'Listino Standard 2025', 'EUR', '2025-01-01', '2025-12-31', 'ACTIVE'
WHERE NOT EXISTS (
  SELECT 1 FROM price_lists WHERE vendor_org_id = 'lenzi-org-id' AND name = 'Listino Standard 2025'
);

-- 3. Crea Location per Lenzi (se non esiste)
INSERT INTO locations (id, org_id, name, address_json)
SELECT gen_random_uuid(), 'lenzi-org-id', 'Sede Principale',
       '{"street": "Via Roma 123", "city": "Verona", "province": "VR", "region": "Veneto", "country": "IT"}'
WHERE NOT EXISTS (
  SELECT 1 FROM locations WHERE org_id = 'lenzi-org-id' AND name = 'Sede Principale'
);

-- 4. Ottieni gli ID creati
CREATE TEMP TABLE temp_ids AS
SELECT
  (SELECT id FROM price_lists WHERE vendor_org_id = 'lenzi-org-id' AND name = 'Listino Standard 2025' LIMIT 1) as price_list_id,
  (SELECT id FROM locations WHERE org_id = 'lenzi-org-id' AND name = 'Sede Principale' LIMIT 1) as location_id;

-- 5. Popola catalogo per TUTTI i prodotti attivi (usando SKU esistenti o appena creati)
INSERT INTO vendor_catalog_items (id, vendor_org_id, sku_id, is_for_sale, is_for_rent, lead_time_days, notes)
SELECT
  gen_random_uuid(),
  'lenzi-org-id',
  COALESCE(s.id, 'sku_' || p.id),  -- Usa SKU esistente o quello appena creato
  true,  -- is_for_sale
  false, -- is_for_rent
  CASE
    WHEN p.product_type = 'DRONE' AND p.model LIKE '%T30%' THEN 7
    WHEN p.product_type = 'DRONE' AND p.model LIKE '%T25%' THEN 5
    WHEN p.product_type = 'DRONE' AND p.model LIKE '%T50%' THEN 10
    WHEN p.product_type = 'DRONE' THEN 7  -- Default per droni
    WHEN p.product_type = 'BATTERY' THEN 2
    WHEN p.product_type = 'SPARE' THEN 1
    ELSE 3
  END,
  'Prodotto ' || p.name || ' - ' || COALESCE(p.model, 'N/A')
FROM products p
LEFT JOIN skus s ON s.product_id = p.id
WHERE p.status = 'ACTIVE'
ON CONFLICT (vendor_org_id, sku_id) DO UPDATE SET
  is_for_sale = EXCLUDED.is_for_sale,
  lead_time_days = EXCLUDED.lead_time_days,
  notes = EXCLUDED.notes;

-- 6. Imposta prezzi per tutti i prodotti
INSERT INTO price_list_items (id, price_list_id, sku_id, price_cents, tax_code)
SELECT
  gen_random_uuid(),
  (SELECT price_list_id FROM temp_ids),
  COALESCE(s.id, 'sku_' || p.id),  -- Usa SKU esistente o creato
  CASE
    WHEN p.product_type = 'DRONE' THEN 2500000  -- 25,000€
    WHEN p.product_type = 'BATTERY' THEN 150000 -- 1,500€
    WHEN p.product_type = 'SPARE' THEN 50000    -- 500€
    ELSE 100000                                 -- 1,000€
  END,
  '22'
FROM products p
LEFT JOIN skus s ON s.product_id = p.id
WHERE p.status = 'ACTIVE'
ON CONFLICT (price_list_id, sku_id) DO UPDATE SET
  price_cents = EXCLUDED.price_cents,
  tax_code = EXCLUDED.tax_code;

-- 7. Crea inventario (2 unità per prodotto)
INSERT INTO inventories (id, vendor_org_id, location_id, sku_id, qty_on_hand, qty_reserved)
SELECT
  gen_random_uuid(),
  'lenzi-org-id',
  (SELECT location_id FROM temp_ids),
  COALESCE(s.id, 'sku_' || p.id),  -- Usa SKU esistente o creato
  2, -- 2 unità per prodotto
  0
FROM products p
LEFT JOIN skus s ON s.product_id = p.id
WHERE p.status = 'ACTIVE'
ON CONFLICT (vendor_org_id, location_id, sku_id) DO UPDATE SET
  qty_on_hand = EXCLUDED.qty_on_hand,
  qty_reserved = EXCLUDED.qty_reserved;

-- 8. Verifica risultati
SELECT 'Catalogo Lenzi inizializzato!' as status;

-- Conteggi finali
SELECT
  (SELECT COUNT(*) FROM vendor_catalog_items WHERE vendor_org_id = 'lenzi-org-id') as prodotti_catalogo,
  (SELECT COUNT(*) FROM price_list_items WHERE price_list_id = (SELECT id FROM price_lists WHERE vendor_org_id = 'lenzi-org-id' AND name = 'Listino Standard 2025' LIMIT 1)) as prezzi_configurati,
  (SELECT COUNT(*) FROM inventories WHERE vendor_org_id = 'lenzi-org-id') as record_inventario,
  (SELECT COALESCE(SUM(qty_on_hand), 0) FROM inventories WHERE vendor_org_id = 'lenzi-org-id') as stock_totale;

-- Mostra prodotti aggiunti
SELECT
  p.name as prodotto,
  p.product_type as tipo,
  p.model as modello,
  CASE
    WHEN p.product_type = 'DRONE' THEN '25,000€'
    WHEN p.product_type = 'BATTERY' THEN '1,500€'
    WHEN p.product_type = 'SPARE' THEN '500€'
    ELSE '1,000€'
  END as prezzo,
  CASE
    WHEN p.product_type = 'DRONE' AND p.model LIKE '%T30%' THEN 7
    WHEN p.product_type = 'DRONE' AND p.model LIKE '%T25%' THEN 5
    WHEN p.product_type = 'DRONE' AND p.model LIKE '%T50%' THEN 10
    WHEN p.product_type = 'DRONE' THEN 7
    WHEN p.product_type = 'BATTERY' THEN 2
    WHEN p.product_type = 'SPARE' THEN 1
    ELSE 3
  END as lead_time_giorni,
  2 as stock_unita
FROM vendor_catalog_items vci
JOIN products p ON p.id = vci.sku_id
WHERE vci.vendor_org_id = 'lenzi-org-id'
ORDER BY p.product_type, p.name;
