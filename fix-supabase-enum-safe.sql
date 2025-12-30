-- ============================================================================
-- MIGRATION SICURA SUPABASE - FIX ENUM CON LOGICA SICURA
-- ============================================================================

-- PASSO 1: DIAGNOSTICA SICURA (nessun confronto diretto con enum invalidi)
SELECT
  COUNT(*) as totale_memberships,
  COUNT(CASE WHEN role IS NULL THEN 1 END) as ruoli_null,
  COUNT(CASE WHEN length(trim(role::text)) = 0 THEN 1 END) as ruoli_vuoti_spazi,
  COUNT(CASE WHEN role::text NOT IN (
    SELECT e.enumlabel FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'orgrole'
  ) THEN 1 END) as ruoli_enum_invalidi
FROM org_memberships;

-- VEDI VALORI ENUM DISPONIBILI
SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder) AS valori_enum_validi
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = 'orgrole';

-- VEDI RECORD PROBLEMATICI DETTAGLIATI
SELECT
  id,
  org_id,
  user_id,
  role::text as role_attuale,
  CASE
    WHEN role IS NULL THEN 'NULL → DA FIXARE'
    WHEN length(trim(role::text)) = 0 THEN 'VUOTO → DA FIXARE'
    WHEN role::text NOT IN (
      SELECT e.enumlabel FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'orgrole'
    ) THEN 'ENUM NON VALIDO → DA FIXARE'
    ELSE 'VALIDO ✅'
  END as status
FROM org_memberships
WHERE role IS NULL
   OR length(trim(role::text)) = 0
   OR role::text NOT IN (
     SELECT e.enumlabel FROM pg_type t
     JOIN pg_enum e ON t.oid = e.enumtypid
     WHERE t.typname = 'orgrole'
   )
ORDER BY
  CASE
    WHEN role IS NULL THEN 1
    WHEN length(trim(role::text)) = 0 THEN 2
    ELSE 3
  END;

-- PASSO 2: FIX DEI VALORI PROBLEMATICI
-- ⚠️  PRIMA OTTIENI I VALORI ENUM VALIDi DAL RISULTATO SOPRA
-- ⚠️  POI SOSTITUISCI 'admin' CON IL PRIMO VALORE DELL'ENUM

-- UPDATE org_memberships
-- SET role = 'admin'  -- ← SOSTITUISCI CON PRIMO VALORE ENUM VALIDO
-- WHERE role IS NULL
--    OR length(trim(role::text)) = 0
--    OR role::text NOT IN (
--      SELECT e.enumlabel FROM pg_type t
--      JOIN pg_enum e ON t.oid = e.enumtypid
--      WHERE t.typname = 'orgrole'
--    );

-- PASSO 3: VERIFICA CHE TUTTI I RUOLI SIANO VALIDI
SELECT
  COUNT(*) as totale,
  COUNT(CASE WHEN role::text IN (
    SELECT e.enumlabel FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'orgrole'
  ) THEN 1 END) as validi,
  COUNT(CASE WHEN role::text NOT IN (
    SELECT e.enumlabel FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'orgrole'
  ) THEN 1 END) as invalidi
FROM org_memberships;

-- PASSO 4: RIMOZIONE COLONNE CAPABILITIES (SOLO DOPO AVER VERIFICATO)
-- ⚠️  BACKUP PRIMA!
-- ALTER TABLE organizations DROP COLUMN IF EXISTS can_buy;
-- ALTER TABLE organizations DROP COLUMN IF EXISTS can_sell;
-- ALTER TABLE organizations DROP COLUMN IF EXISTS can_operate;
-- ALTER TABLE organizations DROP COLUMN IF EXISTS can_dispatch;
