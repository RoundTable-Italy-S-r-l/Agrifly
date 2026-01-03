# Verifica Flusso Stock

## Flusso Attuale

### 1. Aggiornamento Stock (Frontend → Backend)

**Frontend** (`AdminCatalog.tsx`):

- Utente clicca `+` o `-` per aggiornare stock
- Chiama `updateMutation.mutateAsync({ skuId, updates: { stock: newStock } })`

**Backend** (`catalog-hono.ts` PUT `/vendor/:orgId/product`):

- Trova la **PRIMA location** del vendor (o ne crea una default "Magazzino Principale")
- Fa **UPSERT** nella tabella `inventories`:
  ```sql
  INSERT INTO inventories (id, vendor_org_id, location_id, sku_id, qty_on_hand, qty_reserved)
  VALUES (gen_random_uuid(), $1, $2, $3, $4, 0)
  ON CONFLICT (vendor_org_id, location_id, sku_id)
  DO UPDATE SET qty_on_hand = $4
  ```

### 2. Lettura Stock (Backend → Frontend)

**Backend** (`catalog-hono.ts` GET `/vendor/:orgId`):

- Query fa **SUM** di `qty_on_hand` da **TUTTE le location**:
  ```sql
  COALESCE(SUM(i.qty_on_hand), 0) as total_stock
  FROM vendor_catalog_items vci
  LEFT JOIN inventories i ON vci.sku_id = i.sku_id AND i.vendor_org_id = $1
  ```

## Problema Potenziale

**Scenario problematico:**

1. Vendor ha 2 location: "Magazzino A" e "Magazzino B"
2. SKU X ha:
   - Location A: 5 unità
   - Location B: 3 unità
   - **Totale mostrato: 8 unità**

3. Utente clicca `-` per diminuire a 7 unità
4. Backend salva `qty_on_hand = 7` nella **PRIMA location** (Location A)
5. Location A ora ha: 7 unità
6. Location B ancora ha: 3 unità
7. **Totale mostrato: 10 unità** (7 + 3) ❌

**Oppure:**

- Se Location A era la prima, viene sovrascritta con 7
- Se Location B era la prima, viene sovrascritta con 7
- Il totale potrebbe essere diverso da quello che l'utente si aspetta

## Soluzione Consigliata

### Opzione 1: Aggiornare TUTTO lo stock (semplice)

Quando aggiorni lo stock, aggiorna la SOMMA di tutte le location:

```sql
-- Calcola stock totale attuale
SELECT COALESCE(SUM(qty_on_hand), 0) as current_total
FROM inventories
WHERE vendor_org_id = $1 AND sku_id = $2;

-- Se nuovo stock > current_total: aggiungi alla prima location
-- Se nuovo stock < current_total: rimuovi dalla prima location (o distribuisci)
-- Se nuovo stock = 0: azzera tutte le location
```

### Opzione 2: Usare sempre la stessa location (più semplice)

- Quando aggiorni lo stock, usa sempre la PRIMA location
- Quando leggi lo stock, leggi solo dalla PRIMA location (non fare SUM)
- Questo funziona bene se il vendor ha una sola location principale

### Opzione 3: Gestione multi-location (complessa)

- Permettere all'utente di selezionare quale location aggiornare
- Mostrare stock per location separatamente

## Verifica Database

Tabella `inventories`:

- `vendor_org_id`: ID organizzazione vendor
- `location_id`: ID location (magazzino)
- `sku_id`: ID SKU
- `qty_on_hand`: Quantità disponibile
- `qty_reserved`: Quantità riservata (non modificabile manualmente)
- **Constraint UNIQUE**: `(vendor_org_id, location_id, sku_id)`

**Il comportamento attuale è corretto se:**

- Il vendor ha una sola location
- O se vuoi che lo stock sia sempre nella prima location

**Il comportamento attuale NON è corretto se:**

- Il vendor ha più location con stock diverso
- Vuoi gestire stock per location separatamente
