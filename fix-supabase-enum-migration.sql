-- ============================================================================
-- MIGRATION SICURA SUPABASE - FIX ENUM ORGROLE
-- ============================================================================

-- PASSO 1: DIAGNOSTICA (esegui prima questi)
SELECT
  CASE
    WHEN role IS NULL THEN 'NULL'
    WHEN role = '' THEN 'EMPTY_STRING'
    ELSE role
  END as role_status,
  COUNT(*) as count
FROM org_memberships
GROUP BY
  CASE
    WHEN role IS NULL THEN 'NULL'
    WHEN role = '' THEN 'EMPTY_STRING'
    ELSE role
  END
ORDER BY count DESC;

-- VEDI VALORI ENUM DISPONIBILI
SELECT
  n.nspname AS schema_name,
  t.typname AS type_name,
  e.enumlabel AS enum_value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE t.typname = 'orgrole'
ORDER BY e.enumsortorder;

-- PASSO 2: FIX DEI VALORI NON VALIDI (esegui dopo aver visto i risultati)
-- ⚠️  SOSTITUISCI 'admin' con uno dei valori enum trovati sopra

-- UPDATE org_memberships
-- SET role = 'admin'  -- ← CAMBIA con un valore enum valido trovato sopra
-- WHERE role IS NULL OR role = ''
--   AND is_active = true;

-- PASSO 3: VERIFICA CHE TUTTI I RUOLI SIANO VALIDI
SELECT COUNT(*) as ruoli_invalidi
FROM org_memberships
WHERE role NOT IN (
  SELECT e.enumlabel
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  WHERE t.typname = 'orgrole'
);

-- PASSO 4: RIMOZIONE COLONNE CAPABILITIES (solo dopo aver verificato tutto)
-- ⚠️  QUESTO È IRREVERSIBILE - fai backup prima!

-- ALTER TABLE organizations DROP COLUMN IF EXISTS can_buy;
-- ALTER TABLE organizations DROP COLUMN IF EXISTS can_sell;
-- ALTER TABLE organizations DROP COLUMN IF EXISTS can_operate;
-- ALTER TABLE organizations DROP COLUMN IF EXISTS can_dispatch;

-- PASSO 5: VERIFICA FINALE
SELECT
  '✅ Org con type valido:' as check,
  COUNT(*) as count
FROM organizations
WHERE type IN ('buyer', 'vendor', 'operator')
UNION ALL
SELECT
  '✅ Memberships con role valido:' as check,
  COUNT(*) as count
FROM org_memberships om
WHERE om.role IN (
  SELECT e.enumlabel
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  WHERE t.typname = 'orgrole'
);
