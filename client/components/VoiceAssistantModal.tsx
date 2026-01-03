import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// TypeScript declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
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
}

interface VoiceAssistantModalProps {
  onParsedFields: (fields: ParsedFields) => void;
  trigger?: React.ReactNode;
}

const SERVICE_TYPES = [
  { value: 'SPRAY', label: 'Trattamento fitosanitario' },
  { value: 'SPREAD', label: 'Spandimento fertilizzanti' },
  { value: 'MAPPING', label: 'Mappatura territoriale' },
];

const CROP_TYPES = [
  { value: 'VINEYARD', label: 'Vigneto' },
  { value: 'OLIVE_GROVE', label: 'Oliveto' },
  { value: 'CEREAL', label: 'Cereali' },
  { value: 'VEGETABLES', label: 'Ortaggi' },
  { value: 'FRUIT', label: 'Frutteto' },
  { value: 'OTHER', label: 'Altro' },
];

const TREATMENT_TYPES = {
  SPRAY: [
    { value: 'FUNGICIDE', label: 'Trattamento fungicida' },
    { value: 'INSECTICIDE', label: 'Trattamento insetticida' },
    { value: 'HERBICIDE', label: 'Trattamento erbicida' },
    { value: 'FERTILIZER', label: 'Concimazione fogliare' },
  ],
  SPREAD: [
    { value: 'ORGANIC_FERTILIZER', label: 'Concime organico' },
    { value: 'CHEMICAL_FERTILIZER', label: 'Concime chimico' },
    { value: 'LIME', label: 'Spandimento calce' },
    { value: 'OTHER', label: 'Altro' },
  ],
  MAPPING: [
    { value: 'NDVI', label: 'Mappatura NDVI' },
    { value: 'THERMAL', label: 'Termografia' },
    { value: 'MULTISPECTRAL', label: 'Multispettrale' },
    { value: 'ORTHOPHOTO', label: 'Ortofoto' },
  ],
};

const TERRAIN_CONDITIONS = [
  { value: 'FLAT', label: 'Terreno pianeggiante' },
  { value: 'HILLY', label: 'Terreno collinare' },
  { value: 'MOUNTAINOUS', label: 'Terreno montuoso' },
];

export function VoiceAssistantModal({ onParsedFields, trigger }: VoiceAssistantModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<VoiceAssistantResponse | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  // Web Speech API setup
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Il tuo browser non supporta la sintesi vocale');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognitionInstance = new SpeechRecognition();
    
    recognitionInstance.continuous = false;
    recognitionInstance.interimResults = false;
    recognitionInstance.lang = 'it-IT'; // Italiano

    recognitionInstance.onstart = () => {
      setIsListening(true);
      toast.info('Ascolto in corso... parla ora');
    };

    recognitionInstance.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
      toast.success(`Testo riconosciuto: "${transcript}"`);
    };

    recognitionInstance.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      toast.error(`Errore riconoscimento vocale: ${event.error}`);
      setIsListening(false);
    };

    recognitionInstance.onend = () => {
      setIsListening(false);
      toast.info('Riconoscimento vocale completato');
    };

    setRecognition(recognitionInstance);
    recognitionInstance.start();
  };

  const stopListening = () => {
    if (recognition) {
      recognition.stop();
      setIsListening(false);
    }
  };

  const processText = async () => {
    if (!inputText.trim()) {
      toast.error('Inserisci una descrizione del servizio');
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        toast.error('Devi essere autenticato');
        return;
      }

      const response = await fetch('/api/voice-assistant/parse-service-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: inputText,
          context: {
            available_services: SERVICE_TYPES,
            available_crops: CROP_TYPES,
            available_treatments: TREATMENT_TYPES,
            available_terrain: TERRAIN_CONDITIONS,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Errore nell\'analisi del testo');
      }

      const data: VoiceAssistantResponse = await response.json();
      setResult(data);

      // Mostra un toast con il risultato
      const fieldsCount = Object.values(data.parsed_fields).filter(v => v !== undefined).length;
      toast.success(`Analizzati ${fieldsCount} campi con confidenza ${(data.confidence * 100).toFixed(0)}%`);

    } catch (error: any) {
      console.error('Voice assistant error:', error);
      toast.error(error.message || 'Errore nell\'analisi del testo');
    } finally {
      setIsProcessing(false);
    }
  };

  const applyParsedFields = () => {
    if (result && result.parsed_fields) {
      onParsedFields(result.parsed_fields);
      toast.success('Campi compilati automaticamente! 🤖');
      setIsOpen(false);
      setResult(null);
      setInputText('');
    }
  };

  const geieldLabel = (field: keyof ParsedFields, value: string) => {
    switch (field) {
      case 'service_type':
        return SERVICE_TYPES.find(s => s.value === value)?.label || value;
      case 'crop_type':
        return CROP_TYPES.find(c => c.value === value)?.label || value;
      case 'treatment_type':
        // Trova il label in base al service_type
        if (result?.parsed_fields.service_type) {
          const treatments = TREATMENT_TYPES[result.parsed_fields.service_type as keyof typeof TREATMENT_TYPES];
          return treatments?.find(t => t.value === value)?.label || value;
        }
        return value;
      case 'terrain_conditions':
        return TERRAIN_CONDITIONS.find(t => t.value === value)?.label || value;
      default:
        return value;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Mic className="w-4 h-4" />
            Aiuto Vocale
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5" />
            Assistente Vocale
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Input Section */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Descrivi il servizio che vuoi richiedere
              </label>
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Es: 'Voglio trattare il mio vigneto con fungicida in collina per la prossima settimana'"
                rows={4}
                className="resize-none"
              />
            </div>

            {/* Voice Input Buttons */}
            <div className="flex gap-2">
              {!isListening ? (
                <Button
                  onClick={startListening}
                  variant="outline"
                  className="gap-2"
                  disabled={isProcessing}
                >
                  <Mic className="w-4 h-4" />
                  Parla ora
                </Button>
              ) : (
                <Button
                  onClick={stopListening}
                  variant="destructive"
                  className="gap-2"
                >
                  <MicOff className="w-4 h-4" />
                  Ferma ascolto
                </Button>
              )}

              <Button
                onClick={processText}
                disabled={isProcessing || !inputText.trim()}
                className="gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analizzo...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Analizza Testo
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Results Section */}
          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={result.confidence > 0.7 ? "default" : "secondary"}>
                  Confidenza: {(result.confidence * 100).toFixed(0)}%
                </Badge>
                {result.parsed_fields.service_type && (
                  <Badge variant="outline">
                    🤖 AI Analizzato
                  </Badge>
                )}
              </div>

              {/* Parsed Fields */}
              <div className="space-y-2">
                <h4 className="font-medium text-slate-900">Campi riconosciuti:</h4>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(result.parsefields).map(([field, value]) => {
                    if (!value) return null;
                    return (
                      <div key={field} className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-medium text-emerald-900 capitalize">
                          {field.replace('_', ' ')}:
                        </span>
                        <span className="text-sm text-emerald-700">
                          {getFieldLabel(field as keyof ParsedFields, value)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Suggestions */}
              {result.suggestions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-slate-900 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    Suggerimenti:
                  </h4>
                  <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                    {result.suggestions.map((suggestion, index) => (
                      <li key={index}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={applyParsedFields}
                  className="gap-2"
                  disabled={!Object.values(result.parsed_fields).some(v => v)}
                >
                  <CheckCircle className="w-4 h-4" />
                  Applica Campi ({Object.values(result.parsed_fields).filter(v => v).length})
                </Button>
                <Button
                  onClick={() => {
                    setResult(null);
                    setInputText('');
                  }}
                  variant="outline"
                >
                  Riprova
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
