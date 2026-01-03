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
  confidence: number;
  suggestions: string[];
  unrecognized: string[];
  raw_response?: any;
}

// Function to call Grok API
async function callGrokAPI(text: string, context: any) {
  const GROK_API_KEY = process.env.GROK_API_KEY;
  
  if (!GROK_API_KEY) {
    throw new Error("GROK_API_KEY not configured");
  }

  const prompt = `Analizza questa descrizione di servizio agricolo e estrai i campi strutturati per un form di richiesta preventivo drone.

Testo da analizzare: "${text}"

Contesto disponibile:
- Servizi: ${context.available_services?.map(s => `${s.value} (${s.label})`).join(', ') || 'SPRAY, SPREAD, MAPPING'}
- Colture: ${context.available_crops?.map(c => `${c.value} (${c.label})`).join(', ') || 'VINEYARD, OLIVE_GROVE, CEREAL, VEGETABLES, FRUIT, OTHER'}
- Trattamenti SPRAY: ${context.available_treatments?.SPRAY?.map(t => `${t.value} (${t.label})`).join(', ') || 'FUNGICIDE, INSECTICIDE, HERBICIDE, FERTILIZER'}
- Trattamenti SPREAD: ${context.available_treatments?.SPREAD?.map(t => `${t.value} (${t.label})`).join(', ') || 'ORGANIC_FERTILIZER, CHEMICAL_FERTILIZER, LIME, OTHER'}
- Trattamenti MAPPING: ${context.available_treatments?.MAPPING?.map(t => `${t.value} (${t.label})`).join(', ') || 'NDVI, THERMAL, MULTISPECTRAL, ORTHOPHOTO'}
- Terreno: ${context.available_terrain?.map(t => `${t.value} (${t.label})`).join(', ') || 'FLAT, HILLY, MOUNTAINOUS'}

Istruzioni:
1. Identifica il tipo di servizio (service_type) dal testo
2. Identifica la coltura (crop_type) se menzionata
3. Identifica il tipo di trattamento/mappatura (treatment_type) in base al servizio scelto
4. Identifica le condizioni del terreno (terrain_conditions) se menzionate
5. Estrai un nome per il campo (field_name) se presente
6. Estrai eventuali note aggiuntive

Rispondi SOLO con un oggetto JSON valido, senza commenti aggiuntivi:
{
  "field_name": "nome estratto o null",
  "service_type": "SPRAY/SPREAD/MAPPING o null",
  "crop_type": "valore estratto o null", 
  "treatment_type": "valore estratto o null",
  "terrain_conditions": "FLAT/HILLY/MOUNTAINOUS o null",
  "notes": "note estratte o null",
  "confidence": 0.0-1.0,
  "explanation": "breve spiegazione della scelta"
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
function parseGrokResponse(grokText: string): ParsedFields & { confidence: number; explanation: string } {
  try {
    const parsed = JSON.parse(grokText);
    return {
      field_name: parsed.field_name || undefined,
      service_type: parsed.service_type || undefined,
      crop_type: parsed.crop_type || undefined,
      treatment_type: parsed.treatment_type || undefined,
      terrain_conditions: parsed.terrain_conditions || undefined,
      notes: parsed.notes || undefined,
      confidence: parsed.confidence || 0.5,
      explanation: parsed.explanation || ''
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
          notes: parsed.notes || undefined,
          confidence: parsed.confidence || 0.5,
          explanation: parsed.explanation || ''
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

    // Generate suggestions based on what's missing
    const suggestions: string[] = [];
    const unrecognized: string[] = [];

    if (!parsed.service_type) {
      suggestions.push('Specificare il tipo di servizio (trattamento, spandimento, mappatura)');
    }
    if (!parsed.crop_type && parsed.service_type) {
      suggestions.push('Indicare il tipo di coltura');
    }
    if (!parsed.treatment_type && parsed.service_type) {
      suggestions.push(`Specificare il tipo {parsed.service_type === 'MAPPING' ? 'mappatura' : parsed.service_type === 'SPREAD' ? 'spandimento' : 'trattamento'}`);
    }

    const response: VoiceAssistantResponse = {
      parsed_fields: {
        field_name: parsed.field_name,
        service_type: parsed.service_type,
        crop_type: parsed.crop_type,
        treatment_type: parsed.treatment_type,
        terrain_conditions: parsed.terrain_conditions,
        notes: parsed.notes
      },
      confidence: parsed.confidence,
      suggestions,
      unrecognized,
      raw_response: grokResponse
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
