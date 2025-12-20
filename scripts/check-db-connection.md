# Verifica Connessione Database Supabase

## 🔍 Problema Identificato

Il database non è raggiungibile. Possibili cause:
1. **IPv6**: Supabase usa IPv6, la tua rete potrebbe non supportarlo
2. **Connection String**: Potrebbe servire il connection pooler invece della direct connection

## ✅ Soluzione: Usa Connection Pooler

Il connection pooler supporta IPv4 ed è più affidabile.

### Passi:

1. **Vai al dashboard Supabase**: https://supabase.com/dashboard/project/fzowfkfwriajohjjboed
2. **Settings → Database → Connection Pooling**
3. **Copia la "Connection string" del pooler** (porta 6543)
4. **Formato**: `postgresql://postgres.fzowfkfwriajohjjboed:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres`

### Aggiorna `.env`:

Sostituisci la `DATABASE_URL` con quella del pooler.

**Esempio**:
```bash
# Pooler (IPv4 compatible)
DATABASE_URL="postgresql://postgres.fzowfkfwriajohjjboed:66tY3_C_%255iAR8c@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require"
```

### Verifica Region

La region potrebbe essere diversa. Controlla nel dashboard quale region è configurata per il tuo progetto.

