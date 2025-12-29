# Analisi: Gestione Ordini Lato Vendor (Lenzi)

## 📍 Accesso e Navigazione

### Route Admin
- **URL:** `/admin/ordini`
- **Componente:** `Orders.tsx`
- **Layout:** `AdminLayout` (sidebar con menu admin)
- **Accesso:** Richiede autenticazione (`RequireAuth`)

### Come il Vendor Accede
1. Login come utente di organizzazione vendor (es. Lenzi)
2. Redirect automatico a `/admin` (se `can_sell = true` o `type = 'vendor'`)
3. Navigazione tramite sidebar: **"Ordini"** → `/admin/ordini`

---

## 🎨 UI/UX Implementata

### 1. **Vista Kanban con Drag & Drop** ✅

**Colonne Kanban:**
- 🟡 **Pagato** (`PAID`) - Ordini pagati, da preparare
- 🔵 **Spedito** (`SHIPPED`) - Ordini in transito
- 🟢 **Completato** (`FULFILLED`) - Ordini consegnati
- 🔴 **Annullato** (`CANCELLED`) - Ordini cancellati
- 🟠 **Problematico** (`PROBLEMATIC`) - Ordini con problemi

**Funzionalità:**
- ✅ Drag & drop per cambiare status ordine
- ✅ Animazioni durante il drag
- ✅ Auto-refresh ogni 30 secondi
- ✅ Card ordine cliccabili per dettagli

### 2. **KPI Operativi** ✅

**Metriche visualizzate:**
- **Ordini da evadere** (status = PAID)
- **In spedizione** (status = SHIPPED)
- **Completati** (status = FULFILLED)
- **Valore periodo** (somma ordini completati nel periodo selezionato)

### 3. **Filtri** ✅

**Filtri disponibili:**
- **Periodo:** Oggi / Ultimi 7 giorni / Questo mese / Tutti
- **Cliente:** Ricerca per nome organizzazione buyer

### 4. **Sheet Dettaglio Ordine** ✅

**Informazioni mostrate:**
- Cliente (nome organizzazione, ID)
- Prodotti ordinati (nome, modello, SKU, quantità, prezzo)
- Logistica (magazzino, lead time, tracking)
- Dettagli ordine (ID, data creazione, stato, totale)

**Azioni disponibili:**
- ✅ "Segna come spedito" (se status = PAID)
- ✅ "Scarica fattura" (placeholder)
- ✅ Chiudi sheet

### 5. **Dashboard Admin - Widget Ordini Recenti** ✅

**Nella dashboard principale (`/admin`):**
- Widget "Ordini Recenti" con ultimi 3 ordini
- Link "Vedi tutti →" che porta a `/admin/ordini`
- Mostra: ID ordine, cliente, prodotto, importo, status

---

## 🔧 Backend - Query Attuali

### Endpoint: `GET /api/orders?orgId={orgId}`

**Query SQL attuale:**
```sql
WHERE o.buyer_org_id = $1  -- ❌ PROBLEMA: Filtra per buyer, non per seller!
```

**Problema identificato:**
- La query attuale filtra per `buyer_org_id`
- Questo mostra gli ordini **ricevuti** dal buyer
- Per il vendor serve filtrare per `seller_org_id` per vedere gli ordini **da evadere**

**Cosa serve:**
```sql
WHERE o.seller_org_id = $1  -- ✅ Filtra per vendor/seller
```

---

## 📊 Flusso Ordine Lato Vendor

### 1. **Ricezione Ordine**
- ✅ Ordine creato con `seller_org_id = 'lenzi-org-id'`
- ✅ Status iniziale: `CONFIRMED` (dopo pagamento mock)
- ✅ Payment status: `PAID`

### 2. **Visualizzazione in Dashboard**
- ✅ Widget "Ordini Recenti" mostra nuovo ordine
- ✅ Link a `/admin/ordini` per gestione completa

### 3. **Gestione in `/admin/ordini`**
- ✅ Ordine appare in colonna "Pagato" (status = PAID)
- ✅ Vendor può:
  - Cliccare per vedere dettagli
  - Trascinare in "Spedito" quando prepara spedizione
  - Trascinare in "Completato" quando consegnato
  - Trascinare in "Problematico" se ci sono problemi

### 4. **Aggiornamento Status**
- ✅ Drag & drop chiama `PUT /api/orders/{orderId}/status`
- ✅ Body: `{ order_status: 'SHIPPED' }`
- ✅ Backend aggiorna `orders.status`
- ✅ UI si aggiorna automaticamente (optimistic update)

---

## ⚠️ Problemi Identificati

### 1. **Query Backend Filtra per Buyer** ❌
**Problema:**
```typescript
// server/routes/orders-hono.ts:85
WHERE o.buyer_org_id = $1  // ❌ Mostra ordini ricevuti, non da evadere
```

**Soluzione necessaria:**
- Aggiungere logica per distinguere buyer vs seller
- Se `orgId` è seller → filtra per `seller_org_id`
- Se `orgId` è buyer → filtra per `buyer_org_id` (come ora)

### 2. **Endpoint Update Status Mancante** ❌
**Problema:**
- Frontend chiama `PUT /api/orders/{orderId}/status`
- Endpoint non esiste nel backend!

**Soluzione necessaria:**
- Creare endpoint `PUT /api/orders/:orderId/status`
- Aggiornare `orders.status` nel database
- Validare che l'ordine appartenga al vendor corrente

### 3. **Tracking Number Non Gestito** ⚠️
**Problema:**
- Campo `tracking_number` esiste nel database
- Non c'è UI per inserirlo quando si marca come "Spedito"

**Soluzione necessaria:**
- Aggiungere campo input nel sheet dettaglio
- Salvare tracking number quando si aggiorna status a SHIPPED

### 4. **Indirizzo Spedizione Non Mostrato** ⚠️
**Problema:**
- Dettaglio ordine mostra solo "Magazzino: Sede Principale" (hardcoded)
- Non mostra l'indirizzo di spedizione dal campo `shipping_address`

**Soluzione necessaria:**
- Parsare `shipping_address` JSON
- Mostrare indirizzo completo nel sheet dettaglio

---

## ✅ Funzionalità Già Implementate

1. ✅ **Vista Kanban drag & drop** - UI completa e funzionale
2. ✅ **KPI operativi** - Metriche calcolate correttamente
3. ✅ **Filtri periodo e cliente** - Funzionanti
4. ✅ **Sheet dettaglio ordine** - Layout completo
5. ✅ **Auto-refresh** - Aggiornamento ogni 30 secondi
6. ✅ **Optimistic updates** - UI reattiva durante drag & drop
7. ✅ **Animazioni** - Feedback visivo durante interazioni

---

## 🎯 Workflow Completo Previsto

### Scenario: Nuovo Ordine da Cliente

1. **Cliente completa checkout**
   - Ordine creato con `seller_org_id = 'lenzi-org-id'`
   - Status: `CONFIRMED`, Payment: `PAID`

2. **Vendor (Lenzi) accede a `/admin/ordini`**
   - Ordine appare in colonna "Pagato"
   - KPI "Ordini da evadere" incrementato

3. **Vendor prepara ordine**
   - Clicca card per vedere dettagli
   - Verifica prodotti e indirizzo spedizione
   - Prepara prodotti in magazzino

4. **Vendor marca come "Spedito"**
   - Trascina card in colonna "Spedito"
   - Inserisce tracking number (se implementato)
   - Status aggiornato a `SHIPPED`
   - KPI "In spedizione" incrementato

5. **Vendor marca come "Completato"**
   - Dopo conferma consegna, trascina in "Completato"
   - Status aggiornato a `FULFILLED`
   - KPI "Completati" incrementato
   - Valore periodo aggiornato

---

## 📝 Riepilogo

### ✅ Già Funzionante
- UI/UX completa e moderna (Kanban, drag & drop, filtri)
- Layout responsive e accessibile
- Auto-refresh e optimistic updates
- Sheet dettaglio ordine

### ❌ Da Implementare
1. **Backend:** Filtrare ordini per `seller_org_id` (non solo `buyer_org_id`)
2. **Backend:** Endpoint `PUT /api/orders/:orderId/status`
3. **Frontend:** Campo input tracking number nel sheet
4. **Frontend:** Mostrare indirizzo spedizione nel dettaglio

### ⚠️ Miglioramenti Opzionali
- Notifiche push per nuovi ordini
- Export ordini in CSV/PDF
- Stampa etichette spedizione
- Integrazione corrieri (tracking automatico)
- Storico modifiche status ordine

