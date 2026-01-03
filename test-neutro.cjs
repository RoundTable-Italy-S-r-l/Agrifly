require('dotenv').config();

async function testNeutro() {
  console.log('🧪 Test con termini neutri\n');

  const GROK_API_KEY = process.env.GROK_API_KEY;
  if (!GROK_API_KEY) {
    console.log('❌ No API key');
    return;
  }

  const testText = "Vorrei lavorare il mio campo di uva con prodotti per la protezione delle piante in zona collinosa";

  const prompt = `Sei un assistente per moduli web. Analizza questo testo e identifica categorie:

Testo: "${testText}"

Categorie possibili:
- Tipo lavoro: "SPRAY", "SPREAD", "MAPPING"  
- Tipo pianta: "VINEYARD", "OLIVE_GROVE", "CEREAL", "VEGETABLES", "FRUIT", "OTHER"
- Tipo terreno: "FLAT", "HILLY", "MOUNTAINOUS"

Restituisci JSON: {"tipo_lavoro": null, "tipo_pianta": null, "tipo_terreno": null, "confidence": 0.8}`;

  try {
    console.log('📡 Test con termini neutri...');
    const response = await fetch('https://api.x.ai/v1/chat/completion      method: 'POST',
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
        max_tokens: 100
      })
    });

    console.log('📊 Status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Risposta:', data.choices[0].message.content);
    } else {
      const error = await response.text();
      console.log('❌ Errore:', error.substring(0, 200));
    }

  } catch (error) {
    console.log('💥 Errore:', error.message);
  }
}

testNeutro().catch(console.error);
