import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Loader2, MessageSquare, Sparkles, CheckCircle, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';

// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
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

interface VoiceAssistantPanelProps {
  onParsedFields: (fields: ParsedFields) => void;
  currentJobData: Partial<{
    service_type?: string;
    crop_type?: string;
    treatment_type?: string;
    terrain_conditions?: string;
  }>;
}

const SERVICE_TYPES = [
  { value: 'SPRAY', label: 'Irrorazione' },
  { value: 'SPREAD', label: 'Spandimento' },
  { value: 'MAPPING', label: 'Rilievo aereo' }
];

const CROP_TYPES = [
  { value: 'VINEYARD', label: 'Vite' },
  { value: 'OLIVE_GROVE', label: 'Olivo' },
  { value: 'CEREAL', label: 'Cereali' },
  { value: 'VEGETABLES', label: 'Ortaggi' },
  { value: 'FRUIT', label: 'Frutta' },
  { value: 'OTHER', label: 'Altro' }
];

const TREATMENT_TYPES = {
  SPRAY: [
    { value: 'FUNGICIDE', label: 'Fungicida' },
    { value: 'INSECTICIDE', label: 'Insetticida' },
    { value: 'HERBICIDE', label: 'Erbicida' },
    { value: 'FERTILIZER', label: 'Fertilizzante' }
  ],
  SPREAD: [
    { value: 'ORGANIC_FERTILIZER', label: 'Organico' },
    { value: 'CHEMICAL_FERTILIZER', label: 'Chimico' },
    { value: 'LIME', label: 'Calce' },
    { value: 'OTHER', label: 'Altro' }
  ],
  MAPPING: [
    { value: 'NDVI', label: 'NDVI' },
    { value: 'THERMAL', label: 'Termico' },
    { value: 'MULTISPECTRAL', label: 'Multispettrale' },
    { value: 'ORTHOPHOTO', label: 'Ortofoto' }
  ]
};

const TERRAIN_CONDITIONS = [
  { value: 'FLAT', label: 'Pianura' },
  { value: 'HILLY', label: 'Collina' },
  { value: 'MOUNTAINOUS', label: 'Montagna' }
];

export function VoiceAssistantPanel({ onParsedFields, currentJobData }: VoiceAssistantPanelProps) {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [isMinimized, setIsMinimized] = useState(false);

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

      const data = await response.json();
      setResult(data);

      // Mostra un toast con il risultato
      const fieldsCount = Object.values(data.parsed_fields).filter(v => v !== undefined).length;
      toast.success(`Analizzati ${fieldsCount} campi automaticamente`);

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
      setResult(null);
      setInputText('');
    }
  };

  const getFieldLabel = (field: keyof ParsedFields, value: string) => {
    switch (field) {
      case 'service_type':
        return SERVICE_TYPES.find(s => s.value === value)?.label || value;
      case 'crop_type':
        return CROP_TYPES.find(c => c.value === value)?.label || value;
    case 'treatment_type':
        // Trova il label in base al service_type corrente o parsed
        const serviceType = currentJobData.service_type || result?.parsed_fields.service_type;
        if (serviceType) {
          const treatments = TREATMENT_TYPES[serviceType as keyof typeof TREATMENT_TYPES];
          return treatments?.find(t => t.value === value)?.label || value;
        }
        return value;
      case 'terrain_conditions':
        return TERRAIN_CONDITIONS.find(t => t.value === value)?.label || value;
      default:
        return value;
    }
  };

  const clearResult = () => {
    setResult(null);
    setInputText('');
  };

  if (isMinimized) {
    return (
      <div className="fixed right-4 top-1/2 transform -translate-y-1/2 z-40">
        <Button
          onClick={() => setIsMinimized(false)}
          className="rounded-full w-12 h-12 shadow-lg bg-emerald-600 hover:bg-emerald-700"
          size="sm"
        >
          <MessageSquare className="w-5 h-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed right-4 top-20 bottom-4 w-96 z-30">
      <Card className="h-full flex flex-col shadow-xl border-2 border-emerald-200">
        <CardHeader className="pb-3 border-b bg-gradient-to-r from-emerald-50 to-emerald-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              <CardTitle className="text-lg">Assistente AI</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(true)}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Descrivi il servizio che vuoi richiedere
          </p>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
          {/* Input Section */}
          <div className="space-y-3">
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Es: 'Voglio trattare il vigneto con fungicida in collina'"
              rows={3}
              className="resize-none text-sm"
            />

            {/* Voice Input Buttons */}
            <div className="flex gap-2">
              {!isListening ? (
                <Button
                  onClick={startListening}
                  variant="outline"
                  size="sm"
                  className="gap-2 flex-1"
                  disabled={isProcessing}
                >
                  <Mic className="w-4 h-4" />
                  Parla
                </Button>
              ) : (
                <Button
                  onClick={stopListening}
                  variant="destructive"
                  size="sm"
                  className="gap-2 flex-1"
                >
                  <MicOff className="w-4 h-4" />
                  Ferma
                </Button>
              )}

              <Button
                onClick={processText}
                disabled={isProcessing || !inputText.trim()}
                size="sm"
                className="gap-2 flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Analizza
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Results Section */}
          {result && (
            <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">
                  🤖 AI Analizzato
              </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearResult}
                  className="h-6 px-2 text-xs"
                >
                  <X className="w-3 h-3 mr-1" />
                  Cancella
                </Button>
              </div>

              {/* Parsed Fields */}
              <div className="space-y-2 flex-1 overflow-y-auto">
                <h4 className="font-medium text-sm text-slate-900">Campi riconosciuti:</h4>
                <div className="space-y-1">
                  {Object.entries(result.parsed_fields).map(([field, value]) => {
                    if (!value) return null;
                    return (
                      <div key={field} className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg text-xs">
                        <CheckCircle className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                        <span className="font-medium text-emerald-900 capitalize flex-1">
                          {field.replace('_', ' ')}:
                        </span>
                        <span className="text-emerald-700 truncate">
                          {getFieldLabel(field as keyof ParsedFields, value as string)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Suggestions */}
              {result.suggestions && result.suggestions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-slate-900 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    Suggerimenti:
                  </h4>
                  <div className="text-xs text-slate-600 space-y-1">
                    {result.suggestions.map((suggestion: string, index: number) => (
                      <div key={index} className="p-2 bg-amber-50 rounded-lg">
                        {suggestion}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2 border-t">
                <Button
                  onClick={applyParsedFields}
                  className="w-full gap-2"
                  disabled={!Object.values(result.parsed_fields).some(v => v)}
                  size="sm"
                >
                  <CheckCircle className="w-4 h-4" />
                  Applica {Object.values(result.parsed_fields).filter(v => v).length} campi
                </Button>
              </div>
            </div>
          )}

          {!result && (
            <div className="flex-1 flex items-center justify-center text-center p-4">
              <div className="text-slate-500">
                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Descrivi il servizio che vuoi richiedere</p>
                <p className="text-xs mt-1">L'AI analizzerà e compilerà automaticamente i campi</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
