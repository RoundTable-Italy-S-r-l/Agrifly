# Setup Database Supabase - Guida Completa

## 📋 Metodo A: psql (Più Semplice - Consigliato)

### Connessione Rapida

```bash
# Usa lo script helper
npm run db:connect

# Oppure manualmente
export PGPASSWORD='66tY3_C_%5iAR8c'
psql "host=db.fzowfkfwriajohjjboed.supabase.co port=5432 dbname=postgres user=postgres sslmode=require"
```

### Comandi Utili in psql

```sql
-- Lista tabelle
\dt

-- Descrivi tabella
\d organizations

-- Query
SELECT * FROM organizations LIMIT 20;

-- Update
UPDATE organizations SET status='ACTIVE' WHERE id='lenzi-org-id';

-- Exit
\q
```

✅ **Pro**: Immediato, controllo totale, nessuna dipendenza  
⚠️ **Contro**: Devi scrivere SQL (ma spesso è un pro!)

---

## 📋 Metodo B: Prisma (Ottimo per Dev)

### Setup

1. **Crea file `.env` nella root** (se non esiste):
```bash
DATABASE_URL="postgresql://postgres:66tY3_C_%255iAR8c@db.fzowfkfwriajohjjboed.supabase.co:5432/postgres?sslmode=require"
```

2. **Push schema**:
```bash
npm run db:push
```

3. **Apri Prisma Studio** (UI per vedere/modificare dati):
```bash
npm run db:studio
```
Apre su `http://localhost:5555` (se le porte funzionano)

4. **Query in codice TypeScript**:
```typescript
import { prisma } from './server/utils/prisma';

const orgs = await prisma.organization.findMany({ take: 20 });
```

✅ **Pro**: Tipizzato, coerente con schema, ottimo per seed  
⚠️ **Contro**: Dipende da env/config Prisma

---

## 🔧 Configurazione Variabili d'Ambiente

### File `.env` (crea manualmente)

```bash
# Database (PostgreSQL direct connection)
# Password URL-encoded: % diventa %25
DATABASE_URL="postgresql://postgres:66tY3_C_%255iAR8c@db.fzowfkfwriajohjjboed.supabase.co:5432/postgres?sslmode=require"

# Supabase API
SUPABASE_URL="https://fzowfkfwriajohjjboed.supabase.co"
SUPABASE_ANON_KEY="sb_publishable_7twpz0lUwybaxAB4-1swfg_1mRg5Z6N"
SUPABASE_SERVICE_ROLE_KEY="sb_secret_suMNhaT9YiCnVCeC0_nPmQ_3untRk1-"

# Server
PORT=3001

# Auth
JWT_SECRET="your-development-jwt-secret-key-change-in-production"
FRONTEND_URL="http://localhost:8080"
```

### ⚠️ IMPORTANTE: URL Encoding Password

Se la password contiene caratteri speciali:
- `%` → `%25`
- `@` → `%40`
- `:` → `%3A`
- `/` → `%2F`

Esempio: `66tY3_C_%5iAR8c` → `66tY3_C_%255iAR8c` nella DATABASE_URL

---

## 🚀 Workflow Quotidiano

### Vedere Dati
```bash
npm run db:connect
# Poi in psql: SELECT * FROM organizations;
```

### Modificare Dati "Una Tantum"
```bash
npm run db:connect
# Poi in psql: UPDATE organizations SET ...;
```

### Modifiche Strutturali (Schema)
```bash
# Modifica prisma/schema.prisma
npm run db:push
```

### Seed / Operazioni Admin
```bash
npm run seed:lenzi
# Oppure script custom con Prisma
```

---

## 🔒 Permessi / RLS

- **Connessione Postgres diretta** (`psql`, Prisma come `postgres`): **Bypassa RLS** (admin DB)
- **Supabase API** (supabase-js): **RLS si applica** (a meno che usi service_role key)

Per debug/dev: Postgres diretto è il più semplice  
Per test "come in prod": usa API + RLS

---

## ✅ Setup Minimo Consigliato

1. ✅ Usa **psql** per vedere/modificare dati (`npm run db:connect`)
2. ✅ Usa **Prisma** per schema e seed (`npm run db:push`, `npm run seed:lenzi`)
3. ✅ Tieni `.env` con `DATABASE_URL` + `sslmode=require`

**Pronto!** 🎉

