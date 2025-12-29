# Routing e Navigazione per Operatori DJI

## 🎯 Funzionalità Implementate

Il sistema ora calcola automaticamente:
- **Distanza** dalla posizione dell'operatore al campo
- **Tempo di viaggio** stimato in auto
- **Link diretti** per navigazione (Google Maps, Apple Maps, Waze)

## 🔧 Configurazione GraphHopper (Routing Stradale)

### 1. Ottieni API Key Gratuita
1. Vai su [GraphHopper Dashboard](https://www.graphhopper.com/dashboard/#/register)
2. Registrati gratuitamente
3. Crea una nuova API Key
4. **Tier gratuito**: 1.000 richieste/giorno (sufficiente per MVP)

### 2. Configura nel Progetto
Aggiungi al tuo file `.env`:
```bash
GRAPHHOPPER_API_KEY="your-api-key-here"
```

### 3. Riavvia il Server
```bash
# Backend
PORT=3001 node server/simple-server.js

# Frontend
PORT=8082 npm run dev
```

## 📍 Come Funziona

### Senza GraphHopper (Fallback)
- Usa **Turf.js** per calcolare distanza in linea d'aria
- Mostra sempre i link per navigazione esterna
- Avviso: "*Distanza in linea d'aria. Installa GraphHopper per percorsi stradali precisi*"

### Con GraphHopper (Routing Reale)
- Percorsi stradali accurati
- Tempi di viaggio realistici con traffico
- Routing ottimizzato per veicoli

## 🎨 UI/UX

### Dove Appare
- **Job Details (OfferDetail.tsx)**: Quando l'operatore valuta se fare un'offerta
- **Mission Details**: Quando ha accettato e deve raggiungere il campo

### Cosa Mostra
```
🚗 Percorso dalla tua posizione
📍 15.3 km • ⏱️ 22 min
[ Maps ] [ Waze ] [ Apple Maps ]
```

## 🔄 API Endpoint

```javascript
POST /api/routing/directions
{
  "origin": { "lng": 11.001, "lat": 46.003 },
  "destination": { "lng": 11.002, "lat": 46.004 }
}

// Risposta
{
  "distance": { "text": "15.3 km", "value": 15300 },
  "duration": { "text": "22 min", "value": 1320000 },
  "fallback": false,
  "navigation_links": {
    "google_maps": "https://www.google.com/maps/dir/...",
    "apple_maps": "https://maps.apple.com/?daddr=...",
    "waze": "https://waze.com/ul?ll=...&navigate=yes"
  }
}
```

## 🚀 Prossimi Passi

### Per Migliorare
1. **Posizione Operatore**: Salvare indirizzo operativo nel profilo organizzazione invece di usare geolocalizzazione
2. **Caching**: Memorizzare percorsi calcolati per ridurre chiamate API
3. **OSRM Self-Hosted**: Per volumi elevati, hostare OSRM su Railway/Fly.io
4. **Multi-Modal**: Aggiungere routing per droni (line-of-sight)

### Testing
- Testa senza API key (fallback Turf.js)
- Testa con API key GraphHopper
- Verifica link navigazione su dispositivi mobili

## 🛠️ Troubleshooting

**"Tempo non disponibile"**: API GraphHopper non configurata → usa fallback Turf.js
**"Geolocalizzazione non disponibile"**: Browser non supporta GPS → disabilita routing
**Rate limit superato**: GraphHopper 1.000 req/giorno → considera upgrade piano

