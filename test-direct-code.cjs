// Test diretto usando lo stesso codice del server
require('dotenv').config();

async function callGrokAPI(text, context) {
  const GROK_API_KEY = process.env.GROK_API_KEY;
  
  if (!GROK_API_KEY) {
    throw new Error("GROK_API_KEY not configured");
  }

  const prompt = `Sei un assistente intelligente per compilare moduli online. Analizza questa richiesta dell'utente e identifica le informazioni chiave per un servizio.

Richiesta utente: "${text}"

Opzioni disponibili per il modulo:
• Tipo di servizio: irrorazione (SPRAY), distribuzione (SPREAD), mappatura (MAPPING)
• Tipo di coltivazione: vite (VINEYARD), olivo (OLIVE_GROVE), cereali (CEREAL), ortaggi (VEGETABLES), frutta (FRUIT), altro (OTHER)
• Tipo di lavorazione: per irrorazione usa termini come protezione (FUNGICIDE), insetti (INSECTICIDE), erbe (HERBICIDE), nutrienti (FERTILIZER); per distribuzione usa organico (ORGANIC_FERTILIZER), chimico (CHEMERTILIZER), calce (LIME); per mappatura usa vegetazione (NDVI), termico (THERMAL), spettri (MULTISPECTRAL), foto (ORTHOPHOTO)
• Condizioni terreno: pianura (FLAT), collina (HILLY), montagna (MOUNTAINOUS)

Restituisci un oggetto JSON con le categorie identificate:
{
  "service_type": "SPRAY/SPREAD/MAPPING o null",
  "crop_type": "VINEYARD/OLIVE_GROVE/CEREAL/VEGETABLES/FRUIT/OTHER o null",
  "treatment_type": "valore appropriato o null",
  "terrain_conditions": "FLAT/HILLY/MOUNTAINOUS o null",
  "field_name": "nome del campo se presente, altrimenti null",
  "notes": "qualsiasi altra informazione rilevante"
}`;

  console.log('🔑 API Key presente:', !!GROK_API_KEY);
  console.log('📝 Prompt length:', prompt.length);
  console.log('🌐 Calling: https://api.x.ai/v1/chat/completions');

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'grok-2',
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature: 0.1,
      max_tokens: 300
    })
  });

  console.log('📊 Status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.log('❌ Error body:', errorText);
    throw new Error(`Grok API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function testDirect() {
  console.log('🧪 Test diretto del codice server\n');
  
  try {
    const result = await callGrokAPI("Voglio trattare il mio vigneto con fungicida in collina", {});
    console.log('✅ Success!');
    console.log('📄 Result length:', result.length);
    console.log('📄 First 200 chars:', result.substring(0, 200) + '...');
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testDirect().catch(console.error);
