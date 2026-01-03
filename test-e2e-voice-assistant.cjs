// Test end-to-end completo per assistente vocale
require('dotenv').config();

async function callVoiceAssistantAPI(text) {
  const GROK_API_KEY = process.env.GROK_API_KEY;
  if (!GROK_API_KEY) {
    throw new Error('GROK_API_KEY not configured');
  }

  const prompt = `Sei un assistente intelligente per compilare moduli online. Analizza questa richiesta dell'utente e identifica le informazioni chiave per un servizio.

Richiesta utente: "${text}"

Opzioni disponibili per il modulo:
• Tipo di servizio: irrorazione (SPRAY), distribuzione (SPREAD), mappatura (MAPPING)
• Tipo di coltivazione: vite (VINEYARD), olivo (OLIVE_GROVE), cereali (CEREAL), ortaggi (VEGETABLES), frutta (FRUIT), altro (OTHER)
• Tipo di lavorazione: per irrorazione usa termini come protezione (FUNGICIDE), insetti (INSECTICIDE), erbe (HERBICIDE), nutrienti (FERTILIZER); per distribuzione usa organico (ORGANIC_FERTILIZER), chimicoICAL_FERTILIZER), calce (LIME); per mappatura usa vegetazione (NDVI), termico (THERMAL), spettri (MULTISPECTRAL), foto (ORTHOPHOTO)
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
      max_tokens: 500
    })
  });

  if (!response.ok) {
    throw new Error(`Grok API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const grokText = data.choices[0].message.content;

  // Parse JSON response
  const jsonMatch = grokText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      parsed_fields: {
        field_name: parsed.field_name || undefined,
        service_type: parsed.service_type || undefined,
        crop_type: parsed.crop_type || undefined,
        treatment_type: parsed.treatment_type || undefined,
        terrain_conditions: parsed.terrain_conditions || undefined,
        notes: parsed.notes || undefined
      },
      suggestions: [],
      unrecognized: []
    };
  }

  throw new Error('No JSON found in response');
}

async function runE2ETests() {
  console.log('🚀 Test End-to-End Assistente Vocale');
  console.log('=====================================\n');

  const testCases = [
    { text: "Tratta il vigneto con fungica in collina", expected: { service_type: "SPRAY", crop_type: "VINEYARD", treatment_type: "FUNGICIDE", terrain_conditions: "HILLY" }},
    { text: "Devo concimare il frumento domani", expected: { service_type: "SPREAD", crop_type: "CEREAL", treatment_type: "CHEMICAL_FERTILIZER" }},
    { text: "Diserbo nell'oliveto pianeggiante", expected: { service_type: "SPRAY", crop_type: "OLIVE_GROVE", treatment_type: "HERBICIDE", terrain_conditions: "FLAT" }},
    { text: "Irrigazione goccia su pomodori in serra", expected: { service_type: null, crop_type: "VEGETABLES" }},
    { text: "Trinciatura erba tra i filari", expected: { service_type: null, crop_type: "VINEYARD" }},
    { text: "Raccolta olive zona scoscesa", expected: { service_type: null, crop_type: "OLIVE_GROVE", terrain_conditions: "MOUNTAINOUS" }},
    { text: "Semina mais appezzamento nord", expected: { service_type: null, crop_type: "CEREAL" }},
    { text: "Trattamento rameico su vite", expected: { service_type: "SPRAY", crop_type: "VINEYARD" }},
    { text: "Spandimento letame su prato", expected: { service_type: "SPREAD" }},
    { text: "Non so, devo fare un lavoro nel campo", expected: { service_type: null, crop_type: null } }
  ];

  let passed = 0;
  let total = testCases.length;

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`🧪 Test ${i + 1}/${total}: "${testCase.text}"`);
    console.log(`   Atteso: ${JSON.stringify(testCase.expected)}`);

    try {
      const result = await callVoiceAssistantAPI(testCase.text);
      const fields = result.parsed_fields;

      console.log(`   Risultato: service=${fields.service_type}, crop=${fields.crop_type}, treatment=${fields.treatment_type}, terrain=${fields.terrain_conditions}`);

      // Valutazione semplice: controlla se i campi principali corrispondono
      let testPassed = true;
      if (testCase.expected.service_type && fields.service_type !== testCase.expected.service_type) testPassed = false;
      if (testCase.expected.crop_type && fields.crop_pe !== testCase.expected.crop_type) testPassed = false;
      if (testCase.expected.treatment_type && fields.treatment_type !== testCase.expected.treatment_type) testPassed = false;
      if (testCase.expected.terrain_conditions && fields.terrain_conditions !== testCase.expected.terrain_conditions) testPassed = false;

      if (testPassed) {
        console.log('   ✅ PASSATO');
        passed++;
      } else {
        console.log('   ❌ FALLITO');
      }

    } catch (error) {
      console.log(`   💥 ERRORE: ${error.message}`);
    }

    console.log('');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa tra richieste
  }

  console.log('📊 RISULTATI FINALI');
  console.log('===================');
  console.log(`✅ Test passati: ${passed}/${total} (${Math.round(passed/total*100)}%)`);
  
  if (passed >= total * 0.8) { // 80% di successo
    console.log('\n🎉 SISTEMA PRONTO PER DEPLOY!');
    console.log('L\'assistente vocale ha superato i test con successo.');
  } else {
   ('\n⚠️  SISTEMA NECESSITA MIGLIORAMENTI');
    console.log('Rivedere prompt AI o logica di parsing.');
  }
}

runE2ETests().catch(console.error);
