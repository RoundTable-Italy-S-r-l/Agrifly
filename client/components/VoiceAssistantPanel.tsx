import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, MicOff, Loader2, CheckCircle, Sparkles, MessageSquare } from 'lucide-react';
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
  suggestions: string[];
  unrecognized: string[];
}

interface VoiceAssistantPanelProps {
  onParsedFields: (fields: ParsedFields) => void;
  className?: string;
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

interface VoiceAssistantPanelProps {
  onParsedFields: (fields: ParsedFields) => void;
  className?: string;
}

export function VoiceAssistantPanel({ onParsedFields, className = "" }: VoiceAssistantPanelProps) {
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
      toast.success(`Analizzati ${fieldsCount} campi automaticamente`);

    } catch (error: any) {
      console.error('Voice assistant error:', error);
      toast.error(error.message || 'Errore nell\'analisi del testo');
    } finally {
      setIsProcessing(false);
    }
  };


  return (
    <Card className={`h-full flex flex-col ${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="w-5 h-5 text-emerald-600" />
          Assistente AI
        </CardTitle>
        <p className="text-sm text-slate-600">
          Descrivi il servizio che vuoi richiedere
        </p>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
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
        <ScrollArea className="flex-1">
          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Campi identificati dall'AI
              </div>

              <div className="grid grid-cols-1 gap-2">
                {Object.entries(result.parsed_fields).map(([key, value]) =>
                  value ? (
                    <div key={key} className="flex items-center justify-between p-2 bg-slate-50 rounded-md">
                      <span className="text-sm font-medium text-slate-600 capitalize">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {value}
                      </Badge>
                    </div>
                  ) : null
                )}
              </div>

              <Button
                onClick={() => {
                  onParsedFields(result.parsed_fields);
                  toast.success('Campi applicati al form!');
                }}
                className="w-full gap-2"
                size="sm"
              >
                <MessageSquare className="w-4 h-4" />
                Applica al Form
              </Button>
            </div>
          )}

          {!result && (
            <div className="flex flex-col items-center justify-center h-32 text-center text-slate-500">
              <Sparkles className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">
                Descrivi il tuo servizio e l'AI compilerà automaticamente i campi
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
