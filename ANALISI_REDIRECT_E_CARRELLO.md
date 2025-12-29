# Analisi Redirect e Carrello dopo Registrazione/Verifica Email

## ❌ PROBLEMI CRITICI TROVATI

### 1. VERIFICA EMAIL - Redirect mancante

**Problema**: Non esiste una pagina/componente per verificare l'email, né un redirect dopo la verifica.

**Stato attuale**:
- ✅ Endpoint backend `/api/auth/verify-email` esiste e funziona
- ❌ **NON esiste pagina frontend** per inserire il codice di verifica
- ❌ **NON c'è redirect** dopo verifica email
- ❌ **NON c'è gestione** di `post_login_redirect` dopo verifica email

**Conseguenza**: 
- L'utente può registrarsi ma non può verificare l'email attraverso l'interfaccia
- Anche se verificasse via API, non verrebbe reindirizzato al carrello o alla pagina corretta

---

### 2. REGISTRAZIONE DURANTE ACQUISTO (CARRELLO) - Redirect mancante

**Problema**: Se un utente guest aggiunge prodotti al carrello e poi si registra, NON viene reindirizzato al carrello.

**Stato attuale** (`Login.tsx` linee 93-120):
```typescript
const postLoginRedirect = localStorage.getItem('post_login_redirect');

if (postLoginRedirect === 'nuovo-preventivo' && data.organization.can_buy) {
  // Gestisce solo nuovo-preventivo
  navigate('/buyer/nuovo-preventivo', { replace: true });
  return;
}

// Redirect normale alla dashboard
navigate("/dashboard"); // ❌ Va alla dashboard, non al carrello!
```

**Conseguenza**: 
- L'utente che si registra durante un acquisto viene portato alla dashboard
- Il carrello guest rimane separato e non viene migrato

---

### 3. CARRELLO GUEST → UTENTE - Migrazione mancante

**Problema CRITICO**: Il carrello guest NON viene migrato al carrello utente dopo registrazione/login.

**Stato attuale**:
- **Carrello guest**: Usa `session_id` + `guest_org_id` (che è solo una stringa in localStorage, non un'organizzazione reale nel DB)
- **Carrello utente**: Usa `user_id` + `org_id` (organizzazione reale)
- **Separazione**: I due carrelli sono completamente separati

**Database Schema** (`schema.prisma` linee 390-400):
```prisma
model ShoppingCart {
  id            String      @id @default(cuid())
  user_id       String?     // null per guest
  session_id    String?     @unique // ⚠️ UNIQUE - non può essere aggiornato
  org_id        String?     // null o org reale
  ...
}
```

**Codice attuale** (`ecommerce-hono.ts` linee 74-99):
- Cerca carrello per `user_id + org_id` (utente registrato)
- Cerca carrello per `session_id` (guest)
- **NON esiste logica di migrazione**

**Conseguenza**:
- ✅ Guest può aggiungere prodotti al carrello
- ✅ Utente registrato può avere il suo carrello
- ❌ **Quando guest si registra, il carrello guest rimane perso/inaccessibile**
- ❌ Non c'è endpoint per migrare gli item dal carrello guest al carrello utente

---

### 4. REGISTRAZIONE DURANTE SERVIZIO GIS - ✅ FUNZIONA

**Stato attuale**: Funziona correttamente!
- Redirect a `/buyer/nuovo-preventivo` se `post_login_redirect === 'nuovo-preventivo'`
- Trasferisce `temp_field_data` → `pending_field_data`
- `NuovoPreventivoBuyer` carica correttamente i dati pending

---

## 📋 PROBLEMI DATABASE

### Schema ShoppingCart

**Problema 1**: Manca constraint `@@unique([user_id, org_id])` nello schema principale
- Presente in `schema-ecommerce.prisma` e `schema-full.prisma`
- **Manca in `schema.prisma`** (quello attivo)

**Problema 2**: `session_id` è `@unique` ma non permette migrazione
- Quando si migra un carrello guest, non si può semplicemente aggiornare `session_id` a `null` perché violerebbe l'unique constraint
- Serve logica di migrazione che:
  1. Trova carrello guest per `session_id`
  2. Trova/crea carrello utente per `user_id + org_id`
  3. Copia tutti gli item dal carrello guest al carrello utente
  4. Elimina il carrello guest

**Problema 3**: `guest_org_id` non esiste nel database
- È solo una stringa in localStorage (`'guest_org'`)
- Il carrello guest viene creato con `org_id = 'guest_org'` ma questa organizzazione non esiste
- Il codice funziona perché cerca per `session_id`, ma è inconsistente

---

## 🔧 COSA MANCA PER FUNZIONARE CORRETTAMENTE

### Per il Carrello:

1. **Endpoint migrazione carrello** (`POST /api/ecommerce/cart/migrate`):
   - Prende `sessionId` (guest) e `userId + orgId` (nuovo utente)
   - Trova carrello guest
   - Trova/crea carrello utente
   - Copia tutti gli item
   - Elimina carrello guest
   - Restituisce nuovo carrello

2. **Chiamata migrazione dopo registrazione**:
   - In `Login.tsx` dopo registrazione/login
   - Se esiste `session_id` in localStorage → chiama endpoint migrazione
   - Pulisce `session_id` e `guest_org_id` da localStorage

3. **Redirect al carrello dopo registrazione**:
   - Se `post_login_redirect === 'carrello'` → naviga a `/buyer/carrello` o `/carrello`
   - Dopo migrazione carrello

### Per la Verifica Email:

1. **Pagina verifica email** (`/verify-email` o `/login?verify=true`):
   - Campo input per codice a 6 cifre
   - Bottone "Verifica"
   - Chiamata a `authAPI.verifyEmail(code)`
   - Gestione errori (codice scaduto, non valido, etc.)
   - Reinvio codice

2. **Redirect dopo verifica**:
   - Se c'è `post_login_redirect` in localStorage → naviga lì
   - Altrimenti → dashboard

3. **Flusso completo**:
   - Registrazione → mostra messaggio "Controlla email per codice"
   - Utente inserisce codice → verifica → redirect appropriato

---

## 📊 RIEPILOGO

| Funzionalità | Stato | Problema |
|-------------|-------|----------|
| Verifica email backend | ✅ OK | Endpoint funzionante |
| Verifica email frontend | ❌ MANCA | Nessuna pagina per inserire codice |
| Redirect dopo verifica | ❌ MANCA | Nessun redirect dopo verifica |
| Registrazione servizio GIS | ✅ OK | Redirect e dati pending funzionano |
| Registrazione durante acquisto | ❌ ROTTO | Nessun redirect al carrello |
| Migrazione carrello guest→utente | ❌ MANCA | Carrello guest perso dopo registrazione |
| Database schema carrello | ⚠️ INCONSISTENTE | Manca unique constraint, guest_org_id non esiste |

---

## 🎯 PRIORITÀ DI INTERVENTO

1. **CRITICO**: Migrazione carrello guest→utente (utenti perdono prodotti)
2. **CRITICO**: Pagina verifica email (utenti non possono verificare)
3. **ALTO**: Redirect al carrello dopo registrazione
4. **MEDIO**: Fix database schema (aggiungere unique constraint)
5. **BASSO**: Gestione `guest_org_id` (funziona ma è inconsistente)

