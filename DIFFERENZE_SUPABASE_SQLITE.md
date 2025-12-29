# Differenze tra Supabase e SQLite Locale

## 📊 Statistiche Generali

- **Supabase**: 53 tabelle
- **SQLite Locale**: 32 tabelle
- **Differenza**: 21 tabelle in più su Supabase

---

## ✅ Colonna `is_certified` - RISOLTO

- **SQLite Locale**: ✅ Presente (aggiunta manualmente)
- **Supabase**: ✅ Presente (aggiunta con script)
- **Stato**: ✅ Allineato

---

## 📋 Tabelle solo in Supabase (21 tabelle)

Queste tabelle esistono solo in Supabase e non sono presenti in SQLite locale:

1. `availability_rules` - Regole di disponibilità operatori
2. `booking_assignments` - Assegnazioni prenotazioni
3. `booking_slots` - Slot di prenotazione
4. `busy_blocks` - Blocchi occupati
5. `crops` - Tipi di colture
6. `external_calendar_connections` - Connessioni calendari esterni
7. `external_calendar_events` - Eventi calendari esterni
8. `external_calendars` - Calendari esterni
9. `geo_admin_units` - Unità amministrative geografiche
10. `gis_categories` - Categorie GIS
11. `healthcheck` - Health check
12. `maintenance_events` - Eventi di manutenzione
13. `missions` - Missioni
14. `offers` - Offerte
15. `org_billing_profiles` - Profili di fatturazione
16. `org_service_policies` - Policy servizi organizzazione
17. `payments` - Pagamenti
18. `platform_fees` - Commissioni piattaforma
19. `quote_lines` - Righe preventivo
20. `quote_requests` - Richieste preventivo
21. `quotes` - Preventivi
22. `service_area_rules` - Regole aree di servizio
23. `service_area_set_items` - Item set aree servizio
24. `service_area_sets` - Set aree servizio
25. `service_sites` - Siti servizio
26. `treatments` - Trattamenti
27. `user_notification_preferences` - Preferenze notifiche utente
28. `vendor_operator_links` - Link vendor-operatori

---

## 📋 Tabelle solo in SQLite Locale (7 tabelle)

Queste tabelle esistono solo in SQLite locale:

1. `_prisma_migrations` - Migrazioni Prisma (solo locale)
2. `conversation_participants` - Partecipanti conversazioni
3. `conversations` - Conversazioni
4. `job_offer_messages` - Messaggi offerte job
5. `messages` - Messaggi
6. `order_messages` - Messaggi ordini
7. `service_configurations` - Configurazioni servizi

**Nota**: Queste tabelle potrebbero essere necessarie anche in Supabase se usi quelle feature.

---

## 🔍 Differenze nella tabella `organizations`

### Colonne solo in Supabase:
- `show_individual_operators` (boolean, nullable)
- `updated_at` (timestamp with time zone, nullable)

### Colonne solo in SQLite Locale:
- `can_buy` (BOOLEAN, not null)
- `can_dispatch` (BOOLEAN, not null)
- `can_operate` (BOOLEAN, not null)
- `can_sell` (BOOLEAN, not null)
- `is_certified` (INTEGER, default 0) ✅ **ORA PRESENTE ANCHE IN SUPABASE**
- `kind` (TEXT, not null)
- `type` (TEXT, nullable)

**Nota**: Le colonne `can_*` e `kind`/`type` potrebbero essere gestite diversamente in Supabase (forse tramite enum o altre tabelle).

---

## 🎯 Raccomandazioni

### 1. Colonne mancanti in Supabase
Se usi le feature relative, considera di aggiungere:
- `can_buy`, `can_sell`, `can_operate`, `can_dispatch` (se non gestite diversamente)
- `kind`, `type` (se necessarie)

### 2. Tabelle mancanti in Supabase
Se usi queste feature, considera di aggiungere:
- `service_configurations` - Per configurazioni servizi operatori
- `conversations`, `messages`, `conversation_participants` - Per sistema messaggi
- `job_offer_messages`, `order_messages` - Per messaggi specifici

### 3. Tabelle mancanti in SQLite Locale
Le tabelle presenti solo in Supabase sono probabilmente feature avanzate che non usi in locale. Non è necessario aggiungerle a SQLite per sviluppo locale.

---

## ✅ Stato Attuale

- ✅ Colonna `is_certified` presente in entrambi i database
- ✅ Feature preventivi certificati funzionerà su Supabase
- ⚠️ Alcune colonne/tabelle differiscono, ma non bloccanti per le funzionalità principali

