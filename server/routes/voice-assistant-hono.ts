import { Hono } from "hono";

const app = new Hono();

interface VoiceAssistantRequest {
  text: string;
  context?: {
    available_services?: Array<{value: string, label: string}>;
    available_crops?: Array<{value: string, label: string}>;
    available_treatments?: Record<string, Array<{value: string, label: string}>>;
    available_terrain?: Array<{value: string, label: string, icon: string}>;
  };
}

interface ParsedFields {
  field_name?: string;
  service_type?: string;
  crop_type?: string;
  treatment_type?: string;
  terrain_conditions?: string;
  notes?: string;
}

interface VoiceAssistantResponse {
  parsed_fields: ParsedFields;
  suggestions: string[];
  unrecognized: string[];
}

// Function to call Grok API
async function callGrokAPI(text: string, context: any) {
  const GROK_API_KEY = process.env.GROK_API_KEY;
  
  if (!GROK_API_KEY) {
    throw new Error("GROK_API_KEY not configured");
  }

  const prompt = `Sei un assistente intelligente per compilare moduli online. Analizza questa richiesta dell'utente e identifica le informazioni chiave per un servizio.

Richiesta utente: "${text}"

Opzioni disponibili per il modulo:
• Tipo di servizio: irrorazione (SPRAY), distribuzione (SPREAD), mappatura (MAPPING)
• Tipo di coltivazione: vite (VINEYARD), olivo (OLIVE_GROVE), cereali (CEREAL), ortaggi (VEGETABLES), frutta (FRUIT), altro (OTHER)
• Tipo di lavorazione: per irrorazione usa termini come protezione (FUNGICIDE), insetti (INSECTICIDE), erbe (HERBICIDE), nutrienti (FERTILIZER); per distribuzione usa organico (ORGANIC_FERTILIZER), chimico (CHEMICAL_FERTILIZER), calce (LIME); per mappatura usa vegetazione (NDVI), termico (THERMAL), spettri (MULTISPECTRAL), foto (ORTHOPHOTO)
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
        model: 'grok-beta',
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
  return data.choices[0].message.content;
}

// Function to parse Grok response
function parseGrokResponse(grokText: string): ParsedFields {
  try {
    const parsed = JSON.parse(grokText);
    return {
      field_name: parsed.field_name || undefined,
      service_type: parsed.service_type || undefined,
      crop_type: parsed.crop_type || undefined,
      treatment_type: parsed.treatment_type || undefined,
      terrain_conditions: parsed.terrain_conditions || undefined,
      notes: parsed.notes || undefined
    };
  } catch (error) {
    console.warn('Failed to parse Grok response as JSON:', grokText);
    // Fallback: try to extract JSON from text
    const jsonMatch = grokText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          field_name: parsed.field_name || undefined,
          service_type: parsed.service_type || undefined,
          crop_type: parsed.crop_type || undefined,
          treatment_type: parsed.treatment_type || undefined,
          terrain_conditions: parsed.terrain_conditions || undefined,
          notes: parsed.notes || undefined
        };
      } catch (e) {
        console.error('Fallback JSON parsing also failed');
      }
    }
    throw new Error('Unable to parse Grok response');
  }
}

/**
 * POST /api/voice-assistant/parse-service-description
 * Parse natural language service description into structured form fields
 */
app.post('/parse-service-description', async (c) => {
  try {
    const body: VoiceAssistantRequest = await c.req.json();
    const { text, context } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return c.json({
        error: 'Text is required and must be a non-empty string'
      }, 400);
    }

    console.log('🎤 [VOICE ASSISTANT] Processing text:', text);
    console.log('📋 [VOICE ASSISTANT] Context:', context);

    // Default context if not provided
    const defaultContext = {
      available_services: [
        { value: 'SPRAY', label: 'Trattamento fitosanitario' },
        { value: 'SPREAD', label: 'Spandimento fertilizzanti' },
        { value: 'MAPPING', label: 'Mappatura territoriale' }
      ],
      available_crops: [
        { value: 'VINEYARD', label: 'Vigneto' },
        { value: 'OLIVE_GROVE', label: 'Oliveto' },
        { value: 'CEREAL', label: 'Cereali' },
        { value: 'VEBLES', label: 'Ortaggi' },
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

    const finalContext = { ...defaultContext, ...context };

    // Call Grok API
    const grokResponse = await callGrokAPI(text, finalContext);
    console.log('🤖 [VOICE ASSISTANT] Grok response:', grokResponse);

    // Parse the response
    const parsed = parseGrokResponse(grokResponse);
    console.log('📝 [VOICE ASSISTANT] Parsed result:', parsed);

    // No additional logic - pure AI only
    const suggestions: string[] = [];
    const unrecognized: string[] = [];

    const response: VoiceAssistantResponse = {
      parsed_fields: {
        field_name: parsed.field_name,
        service_type: parsed.service_type,
        crop_type: parsed.crop_type,
        treatment_type: parsed.treatment_type,
        terrain_conditions: parsed.terrain_conditions,
        notes: parsed.notes
      },
      suggestions,
      unrecognized
    };

    console.log('✅ [VOICE ASSISTANT] Final response:', response);
    return c.json(response);

  } catch (error: any) {
    console.error('❌ [VOICE ASSISTANT] Error:', error);
    return c.json({
      error: 'Internal server error',
      message: error.message
    }, 500);
  }
});

export default app;
