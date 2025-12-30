-- ============================================================================
-- DIAGNOSTICA PROBLEMA ENUM ORGROLE
-- ============================================================================

-- 1. VEDI VALORI ROLE ATTUALI (inclusi null/vuoti)
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

-- 2. VEDI DEFINIZIONE ENUM (se esiste)
SELECT
  n.nspname AS schema_name,
  t.typname AS type_name,
  e.enumlabel AS enum_value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE t.typname = 'orgrole'
ORDER BY e.enumsortorder;

-- 3. VEDI STRUTTURA TABELLA ORG_MEMBERSHIPS
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'org_memberships' AND column_name = 'role';

-- 4. QUERY SICURA PER AGGIORNARE SOLO I RECORD PROBLEMATICI
-- (Esegui solo dopo aver verificato i valori enum validi)

-- UPDATE org_memberships
-- SET role = 'admin'
-- WHERE role IS NULL OR role = ''
--   AND is_active = true;
