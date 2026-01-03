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

// Function to call Grok API with timeout and retry
async function callGrokAPI(text: string, context: any) {
  const GROK_API_KEY = process.env.GROK_API_KEY;

  if (!GROK_API_KEY) {
    console.log('❌ [GROK API] Key not configured - hasKey:', false);
    throw new Error("GROK_API_KEY not configured");
  }

  console.log('🔑 [GROK API] Key configured - hasKey:', true, 'prefix:', GROK_API_KEY.substring(0, 8) + '...');

  const prompt = `Sei un assistente intelligente per compilare moduli online. Analizza questa richiesta dell'utente e identifica le informazioni chiave per un servizio.

Richiesta utente: "${text}"

Opzioni disponibili per il modulo:
• Tipo di servizio: irrorazione (IRRORAZIONE), spandimento (SPANDIMENTO), rilievo aereo (RILIEVO_AEREO)
• Tipo di coltivazione: vite (VINEYARD), olivo (OLIVE_GROVE), cereali (CEREAL), ortaggi (VEGETABLES), frutta (FRUIT), altro (OTHER)
• Tipo di lavorazione: per irrorazione usa termini come fungicida (FUNGICIDE), insetticida (INSECTICIDE), erbicida (HERBICIDA), fertilizzante (FERTILIZER); per spandimento usa organico (ORGANIC_FERTILIZER), chimico (CHEMICAL_FERTILIZER), calce (LIME); per rilievo aereo usa NDVI (NDVI), termico (THERMAL), multispettrale (MULTISPECTRAL), ortofoto (ORTHOPHOTO)
• Condizioni terreno: pianura (FLAT), collina (HILLY), montagna (MOUNTAINOUS)

Restituisci un oggetto JSON con le categorie identificate (usa SOLO i valori enum italiani):
{
  "service_type": "IRRORAZIONE/SPANDIMENTO/RILIEVO_AEREO o null",
  "crop_type": "VINEYARD/OLIVE_GROVE/CEREAL/VEGETABLES/FRUIT/OTHER o null",
  "treatment_type": "valore appropriato o null",
  "terrain_conditions": "FLAT/HILLY/MOUNTAINOUS o null",
  "field_name": "nome del campo se presente, altrimenti null",
  "notes": "qualsiasi altra informazione rilevante"
}`;

  // Retry logic for network errors
  let lastError: Error | null = null;
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🌐 [GROK API] Attempt ${attempt + 1}/${maxRetries + 1}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

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
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Don't retry on client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`Grok API client error: ${response.status} ${response.statusText}`);
        }
        // Retry on server errors (5xx) or network issues
        throw new Error(`Grok API server error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;

    } catch (error: any) {
      lastError = error;
      console.warn(`⚠️ [GROK API] Attempt ${attempt + 1} failed:`, error.message);

      // Don't retry on client errors or if this was the last attempt
      if (error.message.includes('client error') || attempt === maxRetries) {
        break;
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s...
        console.log(`⏳ [GROK API] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Grok API call failed after all retries');

  const data = await response.json();
  return data.choices[0].message.content;
}

// Schema validation for AI responses
const VALID_SERVICE_TYPES = ['IRRORAZIONE', 'SPANDIMENTO', 'RILIEVO_AEREO', 'SOLLEVAMENTO'];
const VALID_CROP_TYPES = ['VINEYARD', 'OLIVE_GROVE', 'CEREAL', 'VEGETABLES', 'FRUIT', 'OTHER'];
const VALID_TREATMENT_TYPES = {
  SPRAY: ['FUNGICIDE', 'INSECTICIDE', 'HERBICIDE', 'FERTILIZER'],
  SPREAD: ['ORGANIC_FERTILIZER', 'CHEMICAL_FERTILIZER', 'LIME', 'OTHER'],
  MAPPING: ['NDVI', 'THERMAL', 'MULTISPECTRAL', 'ORTHOPHOTO']
};
const VALID_TERRAIN_CONDITIONS = ['FLAT', 'HILLY', 'MOUNTAINOUS'];

function validateAndNormalizeField(field: string | null | undefined, validValues: string[]): string | undefined {
  if (!field || typeof field !== 'string') return undefined;
  const normalized = field.trim().toUpperCase();
  return validValues.includes(normalized) ? normalized : undefined;
}

function validateParsedFields(parsed: any): ParsedFields {
  return {
    field_name: parsed.field_name && typeof parsed.field_name === 'string' ? parsed.field_name.trim() : undefined,
    service_type: validateAndNormalizeField(parsed.service_type, VALID_SERVICE_TYPES),
    crop_type: validateAndNormalizeField(parsed.crop_type, VALID_CROP_TYPES),
    treatment_type: parsed.treatment_type && parsed.service_type
      ? validateAndNormalizeField(parsed.treatment_type, VALID_TREATMENT_TYPES[parsed.service_type] || [])
      : undefined,
    terrain_conditions: validateAndNormalizeField(parsed.terrain_conditions, VALID_TERRAIN_CONDITIONS),
    notes: parsed.notes && typeof parsed.notes === 'string' ? parsed.notes.trim() : undefined
  };
}

// Function to parse Grok response with schema validation
function parseGrokResponse(grokText: string): ParsedFields {
  try {
    const parsed = JSON.parse(grokText);
    return validateParsedFields(parsed);
  } catch (error) {
    console.warn('Failed to parse Grok response as JSON:', grokText);
    // Fallback: try to extract JSON from text
    const jsonMatch = grokText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return validateParsedFields(parsed);
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
        { value: 'SPRAY', label: 'Irrorazione' },
        { value: 'SPREAD', label: 'Spandimento' },
        { value: 'MAPPING', label: 'Rilievo aereo' }
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
