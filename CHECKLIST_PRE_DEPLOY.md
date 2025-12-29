# ✅ Checklist Pre-Deploy Netlify

## 🔴 CRITICO: Variabili d'Ambiente

Prima di fare il push, verifica che queste variabili siano configurate in **Netlify Dashboard > Site Settings > Environment Variables**:

### Database (PostgreSQL/Supabase)
- [ ] `PGHOST` = `aws-1-eu-central-2.pooler.supabase.com`
- [ ] `PGPORT` = `6543`
- [ ] `PGDATABASE` = `postgres`
- [ ] `PGUSER` = `postgres.fzowfkfwriajohjjboed`
- [ ] `PGPASSWORD` = `_Mszqe_%uF_82%@`

### Autenticazione
- [ ] `JWT_SECRET` = (genera un secret sicuro, minimo 32 caratteri)

### Frontend
- [ ] `FRONTEND_URL` = `https://your-site.netlify.app` ⚠️ **SOSTITUISCI con il tuo dominio reale!**
- [ ] `VITE_SUPABASE_URL` = `https://fzowfkfwriajohjjboed.supabase.co`
- [ ] `VITE_SUPABASE_ANON_KEY` = (la tua anon key)

### Opzionali (ma consigliate)
- [ ] `SUPABASE_URL` = `https://fzowfkfwriajohjjboed.supabase.co`
- [ ] `SUPABASE_ANON_KEY` = (anon key)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = (service role key)
- [ ] `RESEND_API_KEY` = (se usi email)
- [ ] `GRAPHHOPPER_API_KEY` = (se usi routing)

---

## ✅ Verifica Database Supabase

1. [ ] Le tabelle sono state create (usando lo script `sync-local-to-supabase.cjs`)
2. [ ] Le colonne `is_certified`, `can_buy`, `can_sell`, `can_operate`, `can_dispatch`, `kind`, `type` esistono in `organizations`
3. [ ] La tabella `saved_fields` ha la struttura corretta (non quella vecchia con `client_name`)
4. [ ] Le tabelle `service_configurations`, `conversations`, `messages`, etc. esistono

---

## 🔍 Verifica Codice

- [x] Nessun riferimento hardcoded a localhost (solo fallback, ok)
- [x] Tutte le variabili d'ambiente hanno fallback appropriati
- [x] Il database connection gestisce sia SQLite (locale) che PostgreSQL (produzione)

---

## 🚀 Dopo il Deploy

1. Controlla i log di Netlify per verificare:
   - ✅ PGHOST: presente
   - ✅ PGUSER: presente
   - ✅ PGPASSWORD: presente
   - ✅ JWT_SECRET: presente

2. Testa le funzionalità:
   - [ ] Login funziona
   - [ ] API rispondono correttamente
   - [ ] Email vengono inviate (se configurato RESEND_API_KEY)
   - [ ] Database queries funzionano

---

## ⚠️ Problemi Potenziali

### Se vedi "Server configuration error"
- **Causa**: Mancano variabili critiche
- **Soluzione**: Aggiungi PGHOST, PGUSER, PGPASSWORD, JWT_SECRET

### Se le email hanno link rotti
- **Causa**: FRONTEND_URL non configurato o errato
- **Soluzione**: Imposta FRONTEND_URL con il dominio Netlify reale

### Se il database non si connette
- **Causa**: Credenziali errate o Supabase non raggiungibile
- **Soluzione**: Verifica le credenziali in Supabase Dashboard

---

## 📝 Note

- Il codice gestisce automaticamente SQLite (locale) vs PostgreSQL (produzione)
- I riferimenti a `localhost` sono solo fallback e non vengono usati in produzione se `FRONTEND_URL` è configurato
- Lo script `sync-local-to-supabase.cjs` ha già sincronizzato i dati locali a Supabase

