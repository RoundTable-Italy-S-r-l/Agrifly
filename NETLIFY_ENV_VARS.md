# Variabili d'Ambiente per Netlify

## ⚠️ IMPORTANTE: Configura queste variabili PRIMA del deploy

Vai su: **Netlify Dashboard > Site Settings > Environment Variables**

---

## 🔴 Variabili CRITICHE (obbligatorie)

### Database PostgreSQL (Supabase)
```
PGHOST=aws-1-eu-central-2.pooler.supabase.com
PGPORT=6543
PGDATABASE=postgres
PGUSER=postgres.fzowfkfwriajohjjboed
PGPASSWORD=_Mszqe_%uF_82%@
```

### Autenticazione
```
JWT_SECRET=<genera-un-secret-sicuro-e-lungo>
```

### Frontend URL (per email e redirect)
```
FRONTEND_URL=https://your-site.netlify.app
```
**⚠️ IMPORTANTE**: Sostituisci `your-site.netlify.app` con il tuo dominio Netlify reale!

---

## 🟡 Variabili IMPORTANTI (consigliate)

### Supabase (per storage e funzionalità avanzate)
```
SUPABASE_URL=https://fzowfkfwriajohjjboed.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### Frontend (VITE_ prefix - per il client)
```
VITE_SUPABASE_URL=https://fzowfkfwriajohjjboed.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

---

## 🟢 Variabili OPZIONALI

### Email (Resend)
```
RESEND_API_KEY=<your-resend-api-key>
RESEND_FROM_EMAIL=DJI Agriculture <noreply@dji-agriculture.com>
```

### Routing (GraphHopper)
```
GRAPHHOPPER_API_KEY=<your-graphhopper-key>
```

### OpenAI (per funzionalità AI)
```
OPENAI_API_KEY=<your-openai-key>
```

---

## ✅ Checklist Pre-Deploy

- [ ] PGHOST configurato
- [ ] PGUSER configurato
- [ ] PGPASSWORD configurato
- [ ] PGDATABASE configurato (default: postgres)
- [ ] JWT_SECRET configurato (genera un secret sicuro!)
- [ ] FRONTEND_URL configurato con il tuo dominio Netlify reale
- [ ] SUPABASE_URL configurato (se usi Supabase)
- [ ] VITE_SUPABASE_URL configurato (per il frontend)
- [ ] VITE_SUPABASE_ANON_KEY configurato (per il frontend)

---

## 🔍 Verifica Post-Deploy

Dopo il deploy, controlla i log di Netlify per verificare che:
1. ✅ PGHOST: presente
2. ✅ PGUSER: presente
3. ✅ PGPASSWORD: presente
4. ✅ JWT_SECRET: presente

Se vedi "MANCANTE" per una di queste, aggiungi la variabile e fai un nuovo deploy.

---

## 🐛 Problemi Comuni

### Errore: "Server configuration error"
- **Causa**: Mancano variabili critiche (PGHOST, PGUSER, PGPASSWORD, JWT_SECRET)
- **Soluzione**: Aggiungi tutte le variabili critiche in Netlify Dashboard

### Email non funzionano / Link rotti
- **Causa**: FRONTEND_URL non configurato o errato
- **Soluzione**: Imposta FRONTEND_URL con il tuo dominio Netlify reale (es: `https://your-site.netlify.app`)

### Database connection error
- **Causa**: Credenziali PostgreSQL errate o Supabase non raggiungibile
- **Soluzione**: Verifica PGHOST, PGUSER, PGPASSWORD in Supabase Dashboard > Settings > Database

