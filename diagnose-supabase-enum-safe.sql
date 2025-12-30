-- ============================================================================
-- DIAGNOSTICA SICURA PER ENUM ORGROLE (senza confronti diretti)
-- ============================================================================

-- 1. CONTO TOTALE RECORD
SELECT COUNT(*) as totale_memberships FROM org_memberships;

-- 2. VEDI VALORI ROLE DISTINTI (usando text casting per evitare enum errors)
SELECT DISTINCT
  role::text as role_value,
  COUNT(*) as count
FROM org_memberships
GROUP BY role::text
ORDER BY count DESC;

-- 3. TROVA RECORD CON ROLE NULL (cast sicuro)
SELECT COUNT(*) as ruoli_null
FROM org_memberships
WHERE role IS NULL;

-- 4. CERCA PATTERN PER STRINGHE VUOTE/TRIMMED (usando length)
SELECT
  COUNT(*) as ruoli_sospetti,
  COUNT(CASE WHEN length(trim(role::text)) = 0 THEN 1 END) as ruoli_vuoti_o_spazi,
  COUNT(CASE WHEN role::text = '' THEN 1 END) as ruoli_stringa_vuota
FROM org_memberships;

-- 5. VEDI DEFINIZIONE ENUM (se esiste)
SELECT
  n.nspname AS schema_name,
  t.typname AS type_name,
  array_agg(e.enumlabel ORDER BY e.enumsortorder) AS valid_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE t.typname = 'orgrole'
GROUP BY n.nspname, t.typname;

-- 6. IDENTIFICA RECORD PROBLEMATICI (senza usare valori enum invalidi)
SELECT
  id,
  org_id,
  user_id,
  role::text as role_text,
  is_active,
  CASE
    WHEN role IS NULL THEN 'NULL_VALUE'
    WHEN length(trim(role::text)) = 0 THEN 'EMPTY_OR_SPACES'
    WHEN role::text NOT IN (
      SELECT e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'orgrole'
    ) THEN 'INVALID_ENUM_VALUE'
    ELSE 'VALID'
  END as status
FROM org_memberships
WHERE role IS NULL
   OR length(trim(role::text)) = 0
   OR role::text NOT IN (
     SELECT e.enumlabel
     FROM pg_type t
     JOIN pg_enum e ON t.oid = e.enumtypid
     WHERE t.typname = 'orgrole'
   )
LIMIT 10;
