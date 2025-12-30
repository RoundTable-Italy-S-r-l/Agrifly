-- ============================================================================
-- MIGRATION SUPABASE: da logica organizzazioni a logica ruoli utente
-- ============================================================================
-- Esegui questi comandi NELL'ORDINE nel SQL Editor di Supabase

-- 1. BACKUP delle capabilities attuali (opzionale, per sicurezza)
-- CREATE TABLE organizations_capabilities_backup AS
-- SELECT id, legal_name, can_buy, can_sell, can_operate, can_dispatch
-- FROM organizations;

-- 2. VERIFICA situazione attuale
SELECT
  o.legal_name,
  o.type,
  o.can_buy, o.can_sell, o.can_operate, o.can_dispatch,
  COUNT(om.user_id) as membri_totali,
  COUNT(CASE WHEN om.role = 'admin' THEN 1 END) as admin_count,
  COUNT(CASE WHEN om.role = 'operator' THEN 1 END) as operator_count,
  COUNT(CASE WHEN om.role = 'vendor' THEN 1 END) as vendor_count,
  COUNT(CASE WHEN om.role = 'dispatcher' THEN 1 END) as dispatcher_count
FROM organizations o
LEFT JOIN org_memberships om ON o.id = om.org_id AND om.is_active = true
GROUP BY o.id, o.legal_name, o.type, o.can_buy, o.can_sell, o.can_operate, o.can_dispatch
ORDER BY o.legal_name;

-- 3. VERIFICA ruoli esistenti
SELECT role, COUNT(*) as count
FROM org_memberships
WHERE is_active = true
GROUP BY role
ORDER BY role;

-- 4. RIMUOVI LE COLONNE CAPABILITIES (ora calcolate dinamicamente)
-- ⚠️  ATTENZIONE: Queste colonne ora sono RIDONDANTI e calcolate dal ruolo utente
-- ALTER TABLE organizations DROP COLUMN IF EXISTS can_buy;
-- ALTER TABLE organizations DROP COLUMN IF EXISTS can_sell;
-- ALTER TABLE organizations DROP COLUMN IF EXISTS can_operate;
-- ALTER TABLE organizations DROP COLUMN IF EXISTS can_dispatch;

-- 5. VERIFICA che la colonna TYPE sia presente (per routing)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'organizations' AND column_name IN ('type', 'kind')
ORDER BY column_name;

-- 6. VERIFICA che la colonna ROLE sia presente nelle memberships
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'org_memberships' AND column_name = 'role';

-- 7. AGGIORNA eventuali ruoli legacy (se necessario)
-- UPDATE org_memberships SET role = 'admin' WHERE role IS NULL OR role = '';
-- UPDATE org_memberships SET role = 'admin' WHERE role NOT IN ('admin', 'vendor', 'operator', 'dispatcher');

-- 8. VERIFICA FINALE: tutto dovrebbe funzionare con la nuova logica
SELECT
  '✅ ORGANIZZAZIONI:' as check_type,
  COUNT(*) as count
FROM organizations
WHERE type IN ('buyer', 'vendor', 'operator')

UNION ALL

SELECT
  '✅ RUOLI VALIDI:' as check_type,
  COUNT(*) as count
FROM org_memberships
WHERE is_active = true AND role IN ('admin', 'vendor', 'operator', 'dispatcher')

UNION ALL

SELECT
  '❌ RUOLI INVALIDI:' as check_type,
  COUNT(*) as count
FROM org_memberships
WHERE is_active = true AND role NOT IN ('admin', 'vendor', 'operator', 'dispatcher', '', NULL);

-- ============================================================================
-- FINE MIGRATION
-- ============================================================================

-- Dopo l'esecuzione, verifica che:
-- 1. Le organizzazioni hanno solo type (buyer/vendor/operator)
-- 2. Gli utenti hanno ruoli validi (admin/vendor/operator/dispatcher)
-- 3. Il sistema funziona con i permessi calcolati dinamicamente
