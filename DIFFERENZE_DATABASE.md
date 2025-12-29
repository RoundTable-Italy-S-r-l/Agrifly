# Differenze tra Database Locale (SQLite) e Supabase (PostgreSQL)

## 🔒 Rassicurazione Importante

**Il database locale NON può "tornare indietro" dopo un riavvio del server!**

- SQLite è un **file persistente** sul disco (`prisma/dev.db`)
- Riavviare il server **NON modifica** il database
- I dati rimangono salvati nel file anche dopo il riavvio
- L'unico modo per perdere dati è **cancellare manualmente il file** o eseguire `prisma migrate reset`

---

## 📊 Confronto Schema

### Tabelle

| Database | Numero Tabelle | Note |
|----------|----------------|------|
| **SQLite Locale** | 32 tabelle | Database di sviluppo semplificato |
| **Supabase PostgreSQL** | 59 tabelle | Database di produzione completo |

### Tabelle solo in Supabase (funzionalità avanzate)

Queste tabelle esistono solo in Supabase e sono per funzionalità avanzate non ancora implementate in locale:

- `availability_rules` - Regole di disponibilità
- `booking_assignments` - Assegnazioni prenotazioni
- `booking_slots` - Slot di prenotazione
- `busy_blocks` - Blocchi occupati
- `crops` - Colture
- `external_calendar_connections` - Connessioni calendari esterni
- `external_calendar_events` - Eventi calendari esterni
- `external_calendars` - Calendari esterni
- `geo_admin_units` - Unità amministrative geografiche
- `gis_categories` - Categorie GIS
- `maintenance_events` - Eventi di manutenzione
- `missions` - Missioni
- `offers` - Offerte
- `org_billing_profiles` - Profili di fatturazione
- `org_service_policies` - Politiche di servizio
- `payments` - Pagamenti
- `platform_fees` - Commissioni piattaforma
- `quote_lines` - Righe preventivo
- `quote_requests` - Richieste preventivo
- `quotes` - Preventivi
- `service_area_rules` - Regole aree di servizio
- `service_area_set_items` - Elementi set aree servizio
- `service_area_sets` - Set aree servizio
- `service_sites` - Siti di servizio
- `treatments` - Trattamenti
- `user_notification_preferences` - Preferenze notifiche
- `vendor_operator_links` - Collegamenti vendor-operator

### Tabelle comuni (31)

Entrambi i database hanno queste tabelle:
- `organizations` ✅
- `users` ✅
- `jobs` ✅
- `job_offers` ✅
- `rate_cards` ✅
- `service_configurations` ✅
- `saved_fields` ✅
- `conversations` ✅
- `messages` ✅
- `products` ✅
- `skus` ✅
- E altre...

---

## 🔍 Colonne Critiche

### Tabella `organizations`

| Colonna | SQLite Locale | Supabase | Note |
|---------|---------------|---------|------|
| `is_certified` | ✅ Presente | ✅ Presente | **CRITICA** per preventivi certificati |
| `can_buy` | ✅ Presente | ✅ Presente | |
| `can_sell` | ✅ Presente | ✅ Presente | |
| `can_operate` | ✅ Presente | ✅ Presente | |
| `can_dispatch` | ✅ Presente | ✅ Presente | |
| `kind` | ✅ Presente | ✅ Presente | |
| `type` | ✅ Presente | ✅ Presente | |
| `show_individual_operators` | ❌ | ✅ Presente | Solo in Supabase |
| `updated_at` | ❌ | ✅ Presente | Solo in Supabase |

**✅ Tutte le colonne critiche sono presenti in entrambi i database!**

---

## 📝 Differenze Principali

### 1. **Tipo di Database**
- **SQLite Locale**: File singolo (`prisma/dev.db`), leggero, per sviluppo
- **Supabase PostgreSQL**: Database relazionale completo, per produzione

### 2. **Funzionalità**
- **SQLite Locale**: Funzionalità base (job offers, rate cards, service configs)
- **Supabase**: Funzionalità complete (bookings, missions, quotes, payments, etc.)

### 3. **Sincronizzazione**
- I dati vengono sincronizzati da locale a Supabase con lo script `sync-local-to-supabase.cjs`
- Le modifiche in locale **non si perdono** dopo il riavvio
- Il database locale è **indipendente** da Supabase

---

## ✅ Verifica Stato Attuale

### Database Locale (SQLite)
- ✅ Colonna `is_certified` presente
- ✅ Tabelle critiche presenti (organizations, users, jobs, etc.)
- ✅ Dati persistiti nel file `prisma/dev.db`

### Supabase
- ✅ Colonna `is_certified` presente
- ✅ Tabelle sincronizzate
- ✅ Dati migrati correttamente

---

## 🚨 Cosa Fare se Preoccupato

1. **Verifica i dati locali:**
   ```bash
   sqlite3 prisma/dev.db "SELECT COUNT(*) FROM organizations;"
   sqlite3 prisma/dev.db "SELECT COUNT(*) FROM users;"
   ```

2. **Verifica Supabase:**
   - Controlla nel dashboard Supabase
   - Esegui lo script di confronto: `node scripts/compare-schemas.cjs`

3. **Sincronizza di nuovo (se necessario):**
   ```bash
   node scripts/sync-local-to-supabase.cjs
   ```

---

## 💡 Conclusione

**Non c'è nulla di cui preoccuparsi!**

- Il database locale è **persistente** e non si resetta al riavvio
- Le colonne critiche (`is_certified`, etc.) sono presenti in entrambi
- Le differenze sono normali: Supabase ha più funzionalità avanzate
- I dati sono al sicuro in entrambi i database

Il riavvio del server **non modifica** il database locale.

