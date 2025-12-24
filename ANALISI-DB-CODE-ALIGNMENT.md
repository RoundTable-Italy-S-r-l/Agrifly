# Analisi Allineamento Database-Codice

## Problemi Identificati

### 1. ❌ INSERT users - Campi mancanti (non critico, hanno default)
**File**: `server/routes/auth-hono-simple.ts:45`

**Schema Prisma**:
- `id` (default cuid)
- `email` ✅
- `first_name` ✅
- `last_name` ✅
- `password_salt` ✅
- `password_hash` ✅
- `status` ✅ (default ACTIVE)
- `email_verified` (default false) - **MANCANTE ma ha default**
- `created_at` (default now) - **MANCANTE ma ha default**
- `updated_at` (updatedAt) - **MANCANTE ma ha default**

**Query attuale**:
```sql
INSERT INTO users (email, first_name, last_name, password_salt, password_hash, status)
```

**Raccomandazione**: OK, i campi mancanti hanno default. Ma per chiarezza, potremmo esplicitare `email_verified = false`.

---

### 2. ⚠️ INSERT organizations - Campo `country` mancante
**File**: `server/routes/auth-hono-simple.ts:38`

**Schema Prisma**:
- `country` (default 'IT') - **MANCANTE ma ha default**

**Query attuale**:
```sql
INSERT INTO organizations (legal_name, org_type, address_line, city, province, region, status)
VALUES ($1, $2, $3, $4, $5, $6, $7)
```

**Raccomandazione**: OK, ha default 'IT', ma meglio esplicitarlo per chiarezza.

---

### 3. ✅ INSERT org_memberships - OK
**File**: `server/routes/auth-hono-simple.ts:52`

Tutti i campi obbligatori sono presenti. I campi con default (`id`, `created_at`) sono gestiti automaticamente.

---

### 4. ✅ INSERT verification_codes - OK
**File**: `server/routes/auth-hono-simple.ts:59`

Tutti i campi obbligatori sono presenti. I campi con default (`id`, `used`, `created_at`) sono gestiti automaticamente.

---

### 5. ⚠️ SELECT users con JOIN - Potenziale problema con utenti senza membership
**File**: `server/routes/auth-hono-simple.ts:105-111`

**Query attuale**:
```sql
SELECT u.*, om.role, o.id as org_id, o.legal_name
FROM users u
LEFT JOIN org_memberships om ON u.id = om.user_id AND om.is_active = true
LEFT JOIN organizations o ON om.org_id = o.id
WHERE u.email = $1 AND u.status = 'ACTIVE'
```

**Problema potenziale**:
- Se un utente non ha membership attiva, `om.role`, `o.id`, `o.legal_name` saranno `NULL`
- Il codice usa `user.org_id` e `user.role` senza controllare se sono NULL
- Questo può causare problemi quando si genera il JWT o si restituisce la risposta

**Raccomandazione**: Aggiungere gestione esplicita del caso in cui l'utente non ha membership.

---

### 6. ❌ Mancanza di gestione enum types nel database
**Schema Prisma definisce enum**:
- `UserStatus`: ACTIVE, BLOCKED
- `OrgRole`: BUYER_ADMIN, VENDOR_ADMIN, DISPATCHER, PILOT, SALES
- `OrgType`: FARM, VENDOR, OPERATOR_PROVIDER
- `OrgStatus`: ACTIVE, SUSPENDED
- `VerificationPurpose`: EMAIL_VERIFICATION, PASSWORD_RESET

**Problema**: Se il database non ha questi enum types definiti come PostgreSQL ENUM, le query potrebbero fallire o accettare valori non validi.

**Raccomandazione**: Verificare che il database abbia i tipi ENUM corrispondenti o che le colonne accettino solo i valori definiti.

---

### 7. ⚠️ Mancanza di validazione dei valori enum nel codice
Il codice usa valori hardcoded come `'ACTIVE'`, `'FARM'`, `'BUYER_ADMIN'` senza validazione.

**Raccomandazione**: Creare costanti TypeScript per gli enum values e usarle nel codice.

---

## Correzioni Applicate ✅

### 1. ✅ INSERT organizations - Aggiunto campo `country`
**File**: `server/routes/auth-hono-simple.ts:38`
- **Prima**: `INSERT INTO organizations (legal_name, org_type, address_line, city, province, region, status)`
- **Dopo**: `INSERT INTO organizations (legal_name, org_type, address_line, city, province, region, country, status)`
- **Valore**: `'IT'` esplicitato

### 2. ✅ INSERT users - Aggiunto campo `email_verified`
**File**: `server/routes/auth-hono-simple.ts:45`
- **Prima**: `INSERT INTO users (email, first_name, last_name, password_salt, password_hash, status)`
- **Dopo**: `INSERT INTO users (email, first_name, last_name, password_salt, password_hash, email_verified, status)`
- **Valore**: `false` esplicitato

### 3. ✅ LOGIN - Gestione utenti senza membership
**File**: `server/routes/auth-hono-simple.ts:124-153`
- **Problema risolto**: Aggiunta gestione esplicita del caso in cui `org_id`, `role`, `legal_name` sono NULL
- **Soluzione**: 
  - Estrazione sicura: `const orgId = user.org_id || null;`
  - JWT generato anche senza org (con `orgId: null`)
  - Response `organization` è `null` se l'utente non ha membership

---

## Raccomandazioni Prioritarie

### Priorità ALTA
1. ✅ ~~**Gestire utenti senza membership nel login**~~ - **RISOLTO**
2. **Verificare enum types nel database** - Assicurarsi che PostgreSQL abbia i tipi ENUM o CHECK constraints

### Priorità MEDIA
3. ✅ ~~**Esplicitare campi con default**~~ - **RISOLTO** (`email_verified`, `country`)
4. **Creare costanti per enum values** - Evitare magic strings nel codice

### Priorità BASSA
5. **Aggiungere validazione input** - Validare che i valori enum siano corretti prima delle query

