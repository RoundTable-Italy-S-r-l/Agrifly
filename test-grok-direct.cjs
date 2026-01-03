const https = require('https');
require('dotenv').config();

// Test diretto dell'API Grok per verificare la logica di parsing
async function testGrokDirect() {
  const GROK_API_KEY = process.env.GROK_API_KEY;
  
  if (!GROK_API_KEY) {
    console.log('❌ GROK_API_KEY non trovata nel .env');
    return;
  }

  const testText = "Voglio trattare il mio vigneto con fungicida in collina per la prossima settimana";
  
  console.log('🤖 Test diretto Grok API');
  console.log('📝 Testo:', testText);
  console.log('');

  const prompt = `Analizza questa descrizione di servizio agricolo e estrai i campi strutturati per un form di richiesta preventivo drone.

Testo da analizzare: "${testText}"

Contesto disponibile:
- Servizi: SPRAY (Trattamento fitosanitario), SPREAD (Spandimento fertilizzanti), MAPPING (Mappatura territoriale)
- Colture: VINEYARD (Vigneto), OLIVE_GROVE (Oliveto), CEREAL (Cereali), VEGETABLES (OrtaFRUIT (Frutteto), OTHER (Altro)
- Trattamenti SPRAY: FUNGICIDE (Trattamento fungicida), INSECTICIDE (Trattamento insetticida), HERBICIDE (Trattamento erbicida), FERTILIZER (Concimazione fogliare)
- Trattamenti SPREAD: ORGANIC_FERTILIZER (Concime organico), CHEMICAL_FERTILIZER (Concime chimico), LIME (Spandimento calce), OTHER (Altro)
- Trattamenti MAPPING: NDVI (Mappatura NDVI), THERMAL (Termografia), MULTISPECTRAL (Multispettrale), ORTHOPHOTO (Ortofoto)
- Terreno: FLAT (Terreno pianeggiante), HILLY (Terreno collinare), MOUNTAINOUS (Terreno montuoso)

Istruzioni:
1. Identifica il tipo di servizio (service_type) dal testo
2. Identifica la coltura (crop_type) se menzionata
3. Identifica il tipo di trattamento/mappatura (treatment_type) in base al servizio scelto
4. Identifica le condizioni del terreno (terrain_conditions) se menzionate
5. Estrai un nome per il campo (field_name) se presente

Rispondi SOLO con un oggetto JSON valido, senza commenti aggiuntivi:
{
  "field_name": "nome estratto o null",
  "service_type": "SPRAY/SPREAD/MAPPING o null",
  "crop_type": "valore estratto o null", 
  "treatment_type": "valore estratto o null",
  "terrain_conditions": "FLAT/HILLY/MOUNTAINOUS o null"
}`;

  const response = await fetch('https://grok.x.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'grok-beta',
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature: 0.1,
      max_tokens: 300
    })
  });

  if (!response.ok) {
    console.log('❌ Errore API Grok:', response.status, response.statusText);
    return;
  }

  const data = await response.json();
  const grokResponse = data.choices[0].message.content;
  
  console.log('🎯 Risposta Grok:');
  console.log(grokResponse);
  console.log('');
  
  // Prova a parsare la risposta
  try {
    const parsed = JSON.parse(grokResponse);
    console.log('✅ Parsing riuscito:');
    conog('   field_name:', parsed.field_name);
    console.log('   service_type:', parsed.service_type);
    console.log('   crop_type:', parsed.crop_type);
    console.log('   treatment_type:', parsed.treatment_type);
    console.log('   terrain_conditions:', parsed.terrain_conditions);
  } catch (error) {
    console.log('❌ Errore nel parsing JSON della risposta Grok');
    console.log('Dettagli errore:', error.message);
  }
}

testGrokDirect().catch(console.error);
