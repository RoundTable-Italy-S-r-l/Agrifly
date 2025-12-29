# Test Verifica Email

## Stato Implementazione ✅

### Funzionalità implementate:
1. ✅ **Registrazione con codice verifica**: Durante la registrazione viene generato un codice a 6 cifre
2. ✅ **Salvataggio nel database**: Il codice viene salvato in `verification_codes` con scadenza 10 minuti
3. ✅ **Invio email**: Il codice viene inviato via Resend (se `RESEND_API_KEY` configurato)
4. ✅ **Endpoint verifica**: `POST /api/auth/verify-email` per verificare il codice
5. ✅ **Endpoint reinvio**: `POST /api/auth/resend-verification` per richiedere nuovo codice

### Database:
- ✅ Tabella `verification_codes` esiste (migrazione: `20251227205457_add_saved_fields`)
- ✅ Campi: `id`, `user_id`, `email`, `code`, `purpose`, `expires_at`, `used`, `used_at`, `created_at`
- ✅ Compatibile con SQLite (locale) e PostgreSQL (produzione)

### Configurazione necessaria:
- ✅ `RESEND_API_KEY` - già presente nelle env vars
- ✅ `RESEND_FROM_EMAIL` - opzionale, default: `noreply@agrifly.it`

## Come testare

### 1. Test locale (SQLite)

#### Avvia il server:
```bash
cd DJI_Agricolture
npm run server:hono
```

#### Registrazione (genera codice):
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User",
    "organizationName": "Test Org"
  }'
```

**Risposta attesa:**
- `token`: JWT token per autenticazione
- `user.email_verified`: `false`
- Codice generato e salvato nel DB
- Email inviata (se RESEND_API_KEY configurato) o log in console

#### Verifica codice:
```bash
# Sostituisci TOKEN con il token ricevuto
# Sostituisci CODE con il codice ricevuto via email (o dalla console)
curl -X POST http://localhost:3001/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"code": "123456"}'
```

**Risposta attesa:**
- `{"message": "Email verificata con successo"}`
- `email_verified` aggiornato a `true` nel database

#### Reinvio codice:
```bash
curl -X POST http://localhost:3001/api/auth/resend-verification \
  -H "Authorization: Bearer TOKEN"
```

**Risposta attesa:**
- `{"message": "Codice inviato"}`
- Nuovo codice generato e inviato

### 2. Test su Netlify

Il sistema funziona automaticamente su Netlify perché:
- ✅ Usa le stesse query SQL (compatibili con PostgreSQL)
- ✅ Le variabili d'ambiente sono configurate in Netlify
- ✅ La funzione `sendVerificationCodeEmail` funziona con Resend
- ✅ Le Netlify Functions supportano Resend API

### 3. Verifica database

#### Controlla codici generati:
```bash
# SQLite locale
sqlite3 prisma/dev.db "SELECT * FROM verification_codes ORDER BY created_at DESC LIMIT 5;"

# PostgreSQL (Supabase)
psql $DATABASE_URL -c "SELECT id, email, code, expires_at, used FROM verification_codes ORDER BY created_at DESC LIMIT 5;"
```

#### Verifica utente verificato:
```bash
# SQLite locale
sqlite3 prisma/dev.db "SELECT email, email_verified, email_verified_at FROM users WHERE email = 'test@example.com';"

# PostgreSQL
psql $DATABASE_URL -c "SELECT email, email_verified, email_verified_at FROM users WHERE email = 'test@example.com';"
```

## Flusso completo

1. **Utente si registra** → Codice generato e salvato → Email inviata
2. **Utente riceve email** → Clicca o copia codice
3. **Utente inserisce codice** → `/api/auth/verify-email` → Email verificata
4. **Se codice scaduto** → Utente richiede `/api/auth/resend-verification` → Nuovo codice inviato

## Note importanti

- ⚠️ **In sviluppo senza RESEND_API_KEY**: Il codice viene loggato in console del server
- ✅ **Formato date**: Usa ISO string per compatibilità SQLite/PostgreSQL
- ✅ **Scadenza codici**: 10 minuti dalla generazione
- ✅ **Rate limiting**: 3 reinvii per ora per utente
- ✅ **Sicurezza**: Codici marcati come `used` dopo verifica, vecchi codici cancellati

