# Verifica Schema Database - Checkout e Ordini

## ✅ Tabelle Esistenti e Funzionanti

### 1. Tabella `orders` ✅
**Stato:** ✅ Completa e funzionante

**Colonne presenti:**
- `id` (TEXT PRIMARY KEY)
- `order_number` (TEXT UNIQUE NOT NULL)
- `buyer_org_id`, `seller_org_id` (TEXT)
- `status` (TEXT DEFAULT 'PENDING')
- `payment_status` (TEXT DEFAULT 'UNPAID')
- `subtotal_cents`, `tax_cents`, `shipping_cents`, `discount_cents`, `total_cents` (INTEGER)
- `currency` (TEXT DEFAULT 'EUR')
- `shipping_address`, `billing_address` (TEXT - JSON)
- `customer_notes`, `internal_notes` (TEXT)
- `tracking_number` (TEXT)
- `shipped_at`, `delivered_at` (TEXT)
- `created_at`, `updated_at` (TEXT)

**Supporta:**
- ✅ Creazione ordini dal carrello
- ✅ Indirizzi di spedizione e fatturazione (JSON)
- ✅ Status ordine e pagamento
- ✅ Tracking number
- ✅ Note cliente
- ✅ Totali (subtotale, tasse, spedizione, totale)

### 2. Tabella `order_lines` ✅
**Stato:** ✅ Completa e funzionante

**Colonne presenti:**
- `id` (TEXT PRIMARY KEY)
- `order_id` (TEXT NOT NULL)
- `sku_id` (TEXT)
- `quantity` (INTEGER NOT NULL)
- `unit_price_cents` (INTEGER NOT NULL)
- `line_total_cents` (INTEGER NOT NULL)
- `created_at` (TEXT)

**Supporta:**
- ✅ Righe ordine con prodotti
- ✅ Quantità e prezzi per riga
- ✅ Collegamento a SKU

## ⚠️ Tabella Opzionale (Non Critica)

### 3. Tabella `payments` ⚠️
**Stato:** ⚠️ Non presente nel database SQLite locale

**Definizione nello schema:**
```sql
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  payment_method TEXT NOT NULL, -- "stripe", "bank_transfer", etc.
  status TEXT NOT NULL DEFAULT 'PENDING',
  external_id TEXT, -- ID Stripe Payment Intent, etc.
  payment_data TEXT, -- JSON con dati aggiuntivi
  paid_at TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

**Quando serve:**
- Quando implementeremo Stripe reale (non mock)
- Per tracciare Payment Intent ID di Stripe
- Per salvare dati aggiuntivi del pagamento (ultime 4 cifre carta, tipo carta, etc.)
- Per gestire rimborsi e dispute

**Attualmente:**
- Non necessaria per il funzionamento attuale (mock Stripe)
- Il `payment_status` è salvato direttamente in `orders`
- Utile per il futuro quando passeremo a Stripe reale

## 📊 Riepilogo

### Funzionalità Supportate ✅
1. ✅ Checkout con form pagamento e fatturazione
2. ✅ Creazione ordini dal carrello
3. ✅ Tracciamento status ordine e pagamento
4. ✅ Indirizzi di spedizione e fatturazione
5. ✅ Righe ordine con prodotti
6. ✅ Visualizzazione ordini nella pagina carrello
7. ✅ Dettaglio ordine completo

### Miglioramenti Futuri (Opzionali)
1. ⚠️ Aggiungere tabella `payments` per tracciare pagamenti Stripe reali
2. ⚠️ Aggiungere indici per performance (già definiti nello schema SQL)
3. ⚠️ Aggiungere foreign key constraints (SQLite supporta ma non sono critiche)

## 🎯 Conclusione

**Il database è completamente capace di supportare tutte le funzionalità implementate.**

La tabella `payments` è opzionale e può essere aggiunta quando si passerà da Stripe mock a Stripe reale. Per ora, tutto funziona correttamente con le tabelle `orders` e `order_lines`.

