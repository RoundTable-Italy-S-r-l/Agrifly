# Come Verificare e Riattivare Supabase

## 🔍 Verifica Stato Progetto

1. **Vai al dashboard Supabase**: https://supabase.com/dashboard
2. **Seleziona il progetto**: `fzowfkfwriajohjjboed`
3. **Controlla lo stato**:
   - Se vedi un pulsante **"Resume"** o **"Restore"** → il progetto è in pausa
   - Se vedi **"Active"** → il progetto è attivo

## ⚡ Riattiva Progetto (se in pausa)

1. Clicca su **"Resume"** o **"Restore"**
2. Attendi 1-2 minuti per il riavvio
3. Verifica che lo stato diventi **"Active"**

## 🔧 Verifica Connessione

Dopo la riattivazione, testa la connessione:

```bash
npm run db:connect
```

Oppure:

```bash
curl -s "http://localhost:3001/api/ping"
```

## 📝 Note

- **Free tier**: I progetti Supabase free si mettono in pausa dopo 7 giorni di inattività
- **Riattivazione**: Richiede 1-2 minuti
- **Dati**: I dati rimangono intatti durante la pausa

