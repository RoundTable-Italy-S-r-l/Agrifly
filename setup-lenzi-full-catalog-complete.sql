-- Script completo per configurare Lenzi con tutti i prodotti
-- 1. Trova l'ID dell'organizzazione Lenzi
-- 2. Crea una location se non esiste
-- 3. Aggiungi tutti i prodotti al catalogo vendor
-- 4. Imposta stock = 2 per ogni prodotto
-- 5. Crea una price list e prezzi di esempio

-- Prima verifichiamo cosa abbiamo
SELECT 'LENZI ORGANIZATION:' as info, id, legal_name, org_type FROM organizations WHERE legal_name LIKE '%Lenzi%';

-- Trova tutti i prodotti e SKU esistenti
SELECT 'PRODOTTI ESISTENTI:' as info, p.id, p.name, p.product_type, s.id as sku_id, s.sku_code
FROM products p
JOIN skus s ON p.id = s.product_id
ORDER BY p.product_type, p.name;

-- Creiamo una location per Lenzi se non esiste
INSERT INTO locations (id, org_id, name, address_json, city, province, region, country)
SELECT 
  CONCAT('lenzi_main_', REPLACE(LOWER(o.legal_name), ' ', '_')),
  o.id,
  'Sede Principale',
  '{"street": "Via Roma 123", "city": "Verona", "province": "VR", "region": "Veneto"}',
  'Verona',
  'VR', 
  'Veneto',
  'IT'
FROM organizations o 
WHERE o.legal_name LIKE '%Lenzi%'
AND NOT EXISTS (
  SELECT 1 FROM locations l WHERE l.org_id = o.id AND l.name = 'Sede Principale'
);

-- Inserisci tutti i prodotti nel catalogo vendor (is_for_sale = true, lead_time_days = 7)
INSERT INTO vendor_catalog_items (id, vendor_org_id, sku_id, is_for_sale, is_for_rent, lead_time_days, notes)
SELECT 
  CONCAT('vci_', REPLACE(s.sku_code, '-', '_'), '_', o.id),
  o.id,
  s.id,
  true,  -- is_for_sale
  false, -- is_for_rent (per ora)
  7,     -- lead_time_days
  'Prodotto disponibile nel catalogo Lenzi'
FROM organizations o
CROSS JOIN (
  SELECT DISTINCT s.id, s.sku_code, s.product_id
  FROM skus s
  JOIN products p ON s.product_id = p.id
  WHERE s.status = 'ACTIVE' AND p.status = 'ACTIVE'
) s
WHERE o.legal_name LIKE '%Lenzi%'
AND NOT EXISTS (
  SELECT 1 FROM vendor_catalog_items vci 
  WHERE vci.vendor_org_id = o.id AND vci.sku_id = s.id
);

-- Imposta stock = 2 per ogni prodotto nella location principale
INSERT INTO inventories (id, vendor_org_id, location_id, sku_id, qty_on_hand, qty_reserved)
SELECT 
  CONCAT('inv_', REPLACE(s.sku_code, '-', '_'), '_', l.id),
  l.org_id,
  l.id,
  s.id,
  2,    -- qty_on_hand
  0     -- qty_reserved
FROM locations l
CROSS JOIN skus s
JOIN products p ON s.product_id = p.id
WHERE l.name = 'Sede Principale' 
AND l.org_id IN (SELECT id FROM organizations WHERE legal_name LIKE '%Lenzi%')
AND s.status = 'ACTIVE' AND p.status = 'ACTIVE'
AND NOT EXISTS (
  SELECT 1 FROM inventories i 
  WHERE i.vendor_org_id = l.org_id 
  AND i.location_id = l.id 
  AND i.sku_id = s.id
);

-- Crea una price list per Lenzi se non esiste
INSERT INTO price_lists (id, vendor_org_id, name, currency, valid_from, valid_to, status)
SELECT 
  CONCAT('pl_', REPLACE(LOWER(o.legal_name), ' ', '_')),
  o.id,
  'Listino Standard 2025',
  'EUR',
  '2025-01-01 00:00:00'::timestamp,
  '2025-12-31 23:59:59'::timestamp,
  'ACTIVE'
FROM organizations o
WHERE o.legal_name LIKE '%Lenzi%'
AND NOT EXISTS (
  SELECT 1 FROM price_lists pl WHERE pl.vendor_org_id = o.id AND pl.name = 'Listino Standard 2025'
);

-- Aggiungi prezzi di esempio per tutti i prodotti (prezzi in centesimi)
INSERT INTO price_list_items (id, price_list_id, sku_id, price_cents, tax_code, constraints_json)
SELECT 
  CONCAT('pli_', REPLACE(s.sku_code, '-', '_'), '_', pl.id),
  pl.id,
  s.id,
  CASE 
    WHEN p.product_type = 'DRONE' THEN 2500000  -- 25,000€
    WHEN p.product_type = 'BATTERY' THEN 150000  -- 1,500€
    WHEN p.product_type = 'SPARE' THEN 50000     -- 500€
    ELSE 100000                                 -- 1,000€ default
  END as price_cents,
  '22',  -- IVA 22%
  '{"min_qty": 1, "max_qty": 10}'
FROM price_lists pl
JOIN organizations o ON pl.vendor_org_id = o.id
CROSS JOIN skus s
JOIN products p ON s.product_id = p.id
WHERE o.legal_name LIKE '%Lenzi%'
AND pl.name = 'Listino Standard 2025'
AND s.status = 'ACTIVE' AND p.status = 'ACTIVE'
AND NOT EXISTS (
  SELECT 1 FROM price_list_items pli 
  WHERE pli.price_list_id = pl.id AND pli.sku_id = s.id
);

-- Verifica finale
SELECT 'CATALOGO LENZI:' as info, COUNT(*) as prodotti_totali
FROM vendor_catalog_items vci
JOIN organizations o ON vci.vendor_org_id = o.id
WHERE o.legal_name LIKE '%Lenzi%';

SELECT 'INVENTARIO LENZI:' as info, SUM(i.qty_on_hand) as stock_totale
FROM inventories i
JOIN locations l ON i.location_id = l.id
JOIN organizations o ON i.vendor_org_id = o.id
WHERE o.legal_name LIKE '%Lenzi%' AND l.name = 'Sede Principale';

SELECT 'PREZZI LENZI:' as info, COUNT(*) as prezzi_totali
FROM price_list_items pli
JOIN price_lists pl ON pli.price_list_id = pl.id
JOIN organizations o ON pl.vendor_org_id = o.id
WHERE o.legal_name LIKE '%Lenzi%';

SELECT 'DETTAGLIO PRODOTTI LENZI:' as info, 
  p.name as prodotto,
  s.sku_code,
  vci.is_for_sale,
  i.qty_on_hand as stock,
  (pli.price_cents / 100.0) as prezzo_euro,
  vci.lead_time_days
FROM vendor_catalog_items vci
JOIN organizations o ON vci.vendor_org_id = o.id
JOIN skus s ON vci.sku_id = s.id
JOIN products p ON s.product_id = p.id
LEFT JOIN inventories i ON i.sku_id = s.id AND i.vendor_org_id = o.id
LEFT JOIN price_lists pl ON pl.vendor_org_id = o.id AND pl.status = 'ACTIVE'
LEFT JOIN price_list_items pli ON pli.price_list_id = pl.id AND pli.sku_id = s.id
WHERE o.legal_name LIKE '%Lenzi%'
ORDER BY p.product_type, p.name;
