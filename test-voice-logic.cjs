// Test diretto della logica del voice assistant senza server
require('dotenv').config();

async function testVoiceLogic() {
  console.log('🧪 Test logica Voice Assistant\n');
  
  const testText = "Voglio trattare il mio vigneto con fungicida in collina per la prossima settimana";
  console.log('📝 Testo input:', testText);
  console.log('');

  // Simula il contesto che passiamo all'AI
  const context = {
    available_services: [
      { value: 'SPRAY', label: 'Trattamento fitosanitario' },
      { value: 'SPREAD', label: 'Spandimento fertilizzanti' },
      { value: 'MAPPING', label: 'Mappatura territoriale' }
    ],
    available_crops: [
      { value: 'VINEYARD', label: 'Vigneto' },
      { value: 'OLIVE_GROVE', label: 'Oliveto' },
      { value: 'CEREAL', label: 'Cereali' },
      { value: 'VEGETABLES', label: 'Ortaggi' },
      { value: 'FRUIT', label: 'Frutteto' },
      { value: 'OTHER', label: 'Altro' }
    ],
    available_treatments: {
      SPRAY: [
        { value: 'FUNGICIDE', label: 'Trattamento fungicida' },
        { value: 'INSECTICIDE', label: 'Trattamento insetticida' },
        { value: 'HERBICIDE', label: 'Trattamento erbicida' },
        { value: 'FERTILIZER', label: 'Concimazione fogliare' }
      ],
      SPREAD: [
        { value: 'ORGANIC_FERTILIZER', label: 'Concime organico' },
        { value: 'CHEMICAL_FERTILIZER', label: 'Concime chimico' },
        { value: 'LIME', label: 'Spandimento calce' },
        { value: 'OTHER', label: 'Altro' }
      ],
      MAPPING: [
        { value: 'NDVI', label: 'Mappatura NDVI' },
        { value: 'THERMAL', label: 'Termografia' },
        { value: 'MULTISPECTRAL', label: 'Multispettrale' },
        { value: 'ORTHOPHOTO', label: 'Ortofoto' }
      ]
    },
    available_terrain: [
      { value: 'FLAT', label: 'Terreno pianeggiante' },
      { value: 'HILLY', label: 'Terreno collinare' },
      { value: 'MOUNTAINOUS', label: 'Terreno montuoso' }
    ]
  };

  // Costruisci il prompt come nel codice del server
  const servicesStr = context.available_services?.map(s => `${s.value} (${s.label})`).join(', ') || 'SPRAY, SPREAD, MAPPING';
  const cropsStr = context.available_crops?.map(c => `${c.value} (${c.label})`).join(', ') || 'VINEYARD, OLIVE_GROVE, CEREAL, VEGETABLES, FRUIT, OTHER';
  const sprayStr = context.available_treatments?.SPRAY?.map(t => `${t.value} (${t.label})`).join(', ') || 'FUNGICIDE, INSECTICIDE, HERBICIDE, FERTILIZER';
  const spreadStr = context.available_treatments?.SPREAD?.map(t => `${t.value} (${t.label})`).join(', ') || 'ORGANIC_FERTILIZER, CHEMICAL_FERTILIZER, LIME, OTHER';
  const mappingStr = context.available_treatments?.MAPPING?.map(t => `${t.value} (${t.label})`).join(', ') || 'NDVI, THERMAL, MULTISPECTRAL, ORTHOPHOTO';
  const terrainStr = context.available_terrain?.map(t => `${t.value} (${t.label})`).join(', ') || 'FLAT, HILLY, MOUNTAINOUS';

  const prompt = `Sei un assistente per compilare form di servizi agricoli. Analizza questo testo e restituisci JSON con i campi identificati.

Testo: "${testText}"

Valori possibili:
- service_type: "SPRAY", "SPREAD", "MAPPING"
- crop_type: "VINEYARD", "OLIVE_GROVE", "CEREAL", "VEGETABLES", "FRUIT", "OTHER"
- treatment_type: dipende dal service_type (SPRAY: "FUNGICIDE", "INSECTICIDE", "HERBICIDE", "FERTILIZER"; SPREAD: "ORGANIC_FERTILIZER", "CHEMICAL_FERTILIZER", "LIME", "OTHER"; MAPPING: "NDVI", "THERMAL", "MULTISPECTRAL", "ORTHOPHOTO")
- terrain_conditions: "FLAT", "HILLY", "MOUNTAINOUS"
- field_name: nome del campo se presente

Restituisci solo JSON: {"field_name": null, "service_type": null, "crop_type": null, "treatment_type": null, "terrain_conditions": null, "confidence": 0.8, "explanation": "analisi completata"}`;

  console.log('🤖 Prompt inviato a Grok:');
  console.log('---');
  console.log(prompt);
  console.log('---\n');

  // Test della chiamata a Grok
  const GROK_API_KEY = process.env.GROK_API_KEY;
  if (!GROK_API_KEY) {
    console.log('❌ GROK_API_KEY nonvata');
    return;
  }

  try {
    console.log('📡 Chiamata API Grok...');
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

    console.log('📊 Status risposta:', response.status);

    if (!response.ok) {
      console.log('❌ Errore API:', response.status, response.statusText);
      return;
    }

    const data = await response.json();
    const grokResponse = data.choices[0].message.content;
    
    console.log('🎯 Risposta Grezza da Grok:');
    console.log(grokResponse);
    console.log('');

    // Prova a parsare come JSON
    try {
      const parsed = JSON.parse(grokResponse);
      console.log('✅ Parsing riuscito:');
      console.log('   field_name:', parsed.field_name);
      console.log('   service_type:', parsed.service_type);
      console.log('   crop_type:', parsed.crop_type);
      console.log('   treatment_type:', parsed.treatment_type);
      console.log('   terrain_conditions:', parsed.terrain_conditions);
      
      // Simula la risposta del nostro endpoint
      const apiResponse = {
        parsed_fields: {
          field_name: parsed.field_name,
          service_type: parsed.service_type,
          crop_type: parsed.crop_type,
          treatment_type: parsed.treatment_type,
          terrain_conditions: parsed.terrain_conditions
        },
        confidence: 0.85,
        suggestions: parsed.service_type ? [] : ['Specificare il tipo di servizio'],
        unrecognized: []
      };
      
      console.log('\n🚀 Risposta API simulata:');
      console.log(JSON.stringify(apiResponse, null, 2));
      
    } catch (parseError) {
      console.log('❌ Errore nel parsing JSON della risposta Grok');
    nsole.log('Dettagli:', parseError.message);
    }
    
  } catch (error) {
    console.log('💥 Errore nella chiamata API:', error.message);
  }
}

testVoiceLogic().catch(console.error);
