import { useState, useEffect } from 'react';
import L from 'leaflet';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingBag,
  Map as MapIcon,
  ChevronRight,
  Calculator,
  Plane,
  X,
  ArrowRight,
  Wind,
  CheckCircle,
  TrendingUp,
  Droplet,
  DollarSign,
  Target,
  Users,
  Save,
  FolderOpen,
  Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { LeafletAreaMap } from '@/components/LeafletAreaMap';
import {
  fetchDrones,
  fetchCrops,
  fetchTreatments,
  fetchTreatmentsByCategory,
  fetchAffiliates,
  fetchGisCategories,
  fetchSavedFields,
  createSavedField,
  deleteSavedField,
  type Drone,
  type Crop,
  type Treatment,
  type Affiliate,
  type GisCategory,
  type SavedField as SavedFieldType
} from '@/lib/api';

interface GisData {
  area: string;
  points: L.LatLng[];
  slope: number;
}

const BASE_RATE_PER_HA = 45;
const LOGISTICS_FIXED = 100;
const KM_RATE = 0.50;

const calculatePricing = (
  area: number,
  slope: number,
  distance_km: number = 20,
  treatment: Treatment | null = null,
  isHilly: boolean = false,
  hasObstacles: boolean = false
) => {
  let slopeMultiplier = 1.0;
  let recommendedDrone = 'DJI Agras T50';

  // Base price from treatment or default
  const basePricePerHa = treatment
    ? (treatment.marketPriceMin + treatment.marketPriceMax) / 2
    : BASE_RATE_PER_HA;

  // Slope multiplier from terrain data
  if (slope <= 10) {
    slopeMultiplier = 1.0;
    recommendedDrone = area > 20 ? 'DJI Agras T50' : 'DJI Agras T30';
  } else if (slope <= 20) {
    slopeMultiplier = 1.2;
    recommendedDrone = 'DJI Agras T30';
  } else {
    slopeMultiplier = 1.5;
    recommendedDrone = 'DJI Agras T30';
  }

  // Additional complexity multipliers
  const terrainMultiplier = isHilly ? 1.2 : 1.0;
  const obstacleMultiplier = hasObstacles ? 1.15 : 1.0;

  const serviceBase = area * basePricePerHa * slopeMultiplier * terrainMultiplier * obstacleMultiplier;
  const logistics = LOGISTICS_FIXED + (distance_km * KM_RATE);
  const total = serviceBase + logistics;

  return {
    serviceBase,
    basePricePerHa,
    slopeMultiplier,
    terrainMultiplier,
    obstacleMultiplier,
    logistics,
    total,
    recommendedDrone
  };
};

const Badge = ({ children, color = 'emerald' }: { children: React.ReactNode; color?: string }) => {
  const colors = {
    emerald: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    slate: 'bg-slate-100 text-slate-600',
    red: 'bg-red-100 text-red-600'
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-bold ${colors[color as keyof typeof colors] || colors.emerald}`}>
      {children}
    </span>
  );
};

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false }: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  className?: string;
  disabled?: boolean;
}) => {
  const baseStyle = "px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 justify-center";
  const variants = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md",
    secondary: "bg-slate-800 text-white hover:bg-slate-700",
    outline: "border-2 border-slate-200 text-slate-700 hover:border-emerald-500 hover:text-emerald-600",
    ghost: "text-slate-500 hover:bg-slate-100"
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const ServiceConfigurator = ({ onBack }: { onBack: () => void }) => {
  const [step, setStep] = useState(1);
  const [gisData, setGisData] = useState<GisData | null>(null);
  const [pricing, setPricing] = useState<ReturnType<typeof calculatePricing> | null>(null);
  const [savedFields, setSavedFields] = useState<SavedFieldType[]>([]);
  const [clientName, setClientName] = useState('');
  const [fieldName, setFieldName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  // GIS drill-down configuration states
  const [selectedCategory, setSelectedCategory] = useState<GisCategory | null>(null);
  const [selectedTreatment, setSelectedTreatment] = useState<Treatment | null>(null);
  const [isHillyTerrain, setIsHillyTerrain] = useState(false);
  const [hasObstacles, setHasObstacles] = useState(false);

  // Fetch GIS categories and treatments from API
  const { data: gisCategories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['gisCategories'],
    queryFn: fetchGisCategories
  });

  const { data: treatments = [], isLoading: treatmentsLoading } = useQuery({
    queryKey: ['treatments'],
    queryFn: fetchTreatments
  });

  // Recalculate pricing when treatment or terrain changes
  const recalculatePricing = () => {
    if (gisData) {
      const calculatedPricing = calculatePricing(
        parseFloat(gisData.area),
        gisData.slope,
        20,
        selectedTreatment,
        isHillyTerrain,
        hasObstacles
      );
      setPricing(calculatedPricing);
    }
  };

  const handleGisComplete = (data: GisData) => {
    setGisData(data);
    const calculatedPricing = calculatePricing(
      parseFloat(data.area),
      data.slope,
      20,
      selectedTreatment,
      isHillyTerrain,
      hasObstacles
    );
    setPricing(calculatedPricing);
    setShowSaveForm(true);
    setStep(1);
  };

  const handleSaveField = () => {
    if (!gisData || !clientName || !fieldName) return;

    const newField: SavedFieldType = {
      id: Date.now().toString(),
      clientName,
      fieldName,
      gisData,
      savedAt: new Date().toLocaleString('it-IT')
    };

    setSavedFields([...savedFields, newField]);
    setClientName('');
    setFieldName('');
    setShowSaveForm(false);
  };

  const handleLoadField = (field: SavedFieldType) => {
    setGisData(field.gisData);
    const calculatedPricing = calculatePricing(parseFloat(field.gisData.area), field.gisData.slope);
    setPricing(calculatedPricing);
    setStep(2);
  };

  const handleDeleteField = (id: string) => {
    setSavedFields(savedFields.filter(f => f.id !== id));
  };

  if (step === 1) {
    return (
      <div className="w-full" style={{ height: 'calc(100vh - 64px)' }}>
        <LeafletAreaMap
          onComplete={handleGisComplete}
          onBack={onBack}
          gisData={gisData}
          pricing={pricing}
          onProceed={() => setStep(2)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pt-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setStep(1)} className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight className="rotate-180"/></button>
        <h2 className="text-2xl font-bold text-slate-800">Preventivatore Servizi GIS</h2>
      </div>

      <div className="space-y-6">
        <div className="space-y-6">

              {showSaveForm && gisData && (
                <div className="bg-[#f5f5f5] p-3 rounded-lg shadow-sm border border-slate-200 mb-6">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Nome Cliente (es. Azienda Rossi)"
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                    <input
                      type="text"
                      value={fieldName}
                      onChange={(e) => setFieldName(e.target.value)}
                      placeholder="Nome Campo (es. Campo Nord)"
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                    <button
                      onClick={handleSaveField}
                      disabled={!clientName || !fieldName}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 text-sm font-medium"
                    >
                      <Save size={14}/>
                    </button>
                    <button
                      onClick={() => setShowSaveForm(false)}
                      className="px-3 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition text-sm"
                    >
                      <X size={16}/>
                    </button>
                  </div>
                </div>
              )}

          {/* GIS Service Configuration - Drill-Down UI */}
          {gisData && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
              <h3 className="font-bold text-lg mb-4 text-slate-800">Configurazione Servizio</h3>

              {/* Step 1: Category Selection */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-700 mb-3">1. Seleziona Coltura</label>
                {categoriesLoading ? (
                  <div className="text-center py-8 text-slate-500">Caricamento categorie...</div>
                ) : (
                <div className="grid grid-cols-3 gap-4">
                    {gisCategories.map(category => (
                    <button
                      key={category.id}
                      onClick={() => {
                        setSelectedCategory(category);
                        setSelectedTreatment(null); // Reset treatment when changing category
                      }}
                      className={`p-4 rounded-xl border-2 transition-all hover:shadow-lg ${
                        selectedCategory?.id === category.id
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-slate-200 bg-white hover:border-emerald-300'
                      }`}
                    >
                      <div className="text-4xl mb-2">{category.icon}</div>
                      <div className="font-bold text-sm text-slate-900 mb-1">{category.name}</div>
                      <div className="text-xs text-slate-500">{category.description}</div>
                    </button>
                  ))}
                </div>
                )}
              </div>

              {/* Step 2: Treatment Selection (Dynamic based on category) */}
              {selectedCategory && (
                <div className="mb-6">
                  <label className="block text-sm font-bold text-slate-700 mb-3">2. Tipo di Intervento</label>
                  {treatmentsLoading ? (
                    <div className="text-center py-4 text-slate-500">Caricamento trattamenti...</div>
                  ) : (
                    <>
                  <select
                    value={selectedTreatment?.id || ''}
                    onChange={(e) => {
                          const treatment = treatments.find(t => t.id === e.target.value) || null;
                      setSelectedTreatment(treatment);
                      recalculatePricing();
                    }}
                    className="w-full p-3 rounded-lg border-2 border-slate-300 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  >
                    <option value="">Seleziona tipo di trattamento...</option>
                        {treatments.filter(t => t.categoryId === selectedCategory.id).map(treatment => {
                          const avgPrice = (treatment.marketPriceMin + treatment.marketPriceMax) / 2;
                          return (
                      <option key={treatment.id} value={treatment.id}>
                              {treatment.name} - €{avgPrice.toFixed(0)}/ha ({treatment.type === 'liquid' ? '💧 Liquido' : '📦 Solido'})
                      </option>
                          );
                        })}
                  </select>
                  {selectedTreatment && (
                    <p className="text-xs text-slate-600 mt-2 flex items-center gap-2">
                          <span className="font-semibold">Velocità operativa:</span> ~{selectedTreatment.operatingSpeed} ha/h • {selectedTreatment.dosage}
                    </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Step 3: Terrain Complexity Toggles */}
              {selectedTreatment && (
                <div className="mb-4">
                  <label className="block text-sm font-bold text-slate-700 mb-3">3. Condizioni del Campo</label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">⛰️</span>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Terreno Collinare / Pendente</p>
                          <p className="text-xs text-slate-500">+20% sul prezzo base</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setIsHillyTerrain(!isHillyTerrain);
                          setTimeout(recalculatePricing, 0);
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                          isHillyTerrain ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                            isHillyTerrain ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🌳</span>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Presenza Ostacoli (Alberi/Pali)</p>
                          <p className="text-xs text-slate-500">+15% sul prezzo base</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setHasObstacles(!hasObstacles);
                          setTimeout(recalculatePricing, 0);
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                          hasObstacles ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                            hasObstacles ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Price Preview */}
              {selectedTreatment && pricing && (
                <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <p className="text-xs text-emerald-700 font-bold uppercase">Prezzo Base Trattamento</p>
                      <p className="text-sm text-emerald-600 mt-1">
                        {selectedTreatment.name} • {gisData.area} ha
                      </p>
                    </div>
                    <p className="text-2xl font-bold font-mono text-emerald-700">
                      €{pricing.basePricePerHa.toFixed(2)}/ha
                    </p>
                  </div>
                  <button
                    onClick={() => setStep(2)}
                    className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold uppercase tracking-wide text-sm hover:bg-emerald-700 transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={16}/> Procedi al Preventivo Completo
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 2 && gisData && pricing && (
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-100 px-6 py-3 border-b border-slate-200">
                <h3 className="font-bold text-sm uppercase tracking-wide text-slate-700 flex items-center gap-2">
                  <CheckCircle className="text-emerald-600" size={18}/> Piano di Volo Commerciale
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-0.5 bg-[#141414]">
                <div className="p-6 bg-[#141414] text-white">
                  <span className="block text-xs text-slate-400 uppercase tracking-wider mb-2">Superficie Rilevata</span>
                  <div className="font-bold text-4xl font-mono">{gisData.area} <span className="text-lg text-slate-400">ha</span></div>
                </div>
                <div className="p-6 bg-[#141414] text-white border-l-4 border-emerald-500">
                  <span className="block text-xs text-slate-400 uppercase tracking-wider mb-2">Piattaforma Assegnata</span>
                  <div className="font-bold text-2xl text-emerald-500">{pricing.recommendedDrone}</div>
                </div>
              </div>

              <div className="px-6 py-6">
                <div className="space-y-0">
                  <div className="flex justify-between py-3 border-b border-slate-100 text-sm">
                    <span className="text-slate-700">
                      {selectedTreatment ? selectedTreatment.name : 'Servizio Base (Standard)'}
                    </span>
                    <span className="font-mono font-semibold text-slate-900">€ {(parseFloat(gisData.area) * pricing.basePricePerHa).toFixed(2)}</span>
                  </div>
                  {pricing.slopeMultiplier > 1 && (
                    <div className="flex justify-between py-3 border-b border-slate-100 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-700">Adeguamento Pendenza ({gisData.slope}%)</span>
                        {gisData.slope > 10 && (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Terrain Follow ON</span>
                        )}
                      </div>
                      <span className="font-mono font-semibold text-slate-900">
                        ×{pricing.slopeMultiplier.toFixed(1)}
                      </span>
                    </div>
                  )}
                  {isHillyTerrain && (
                    <div className="flex justify-between py-3 border-b border-slate-100 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-700">Terreno Collinare</span>
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Complessità Alta</span>
                      </div>
                      <span className="font-mono font-semibold text-slate-900">
                        ×{pricing.terrainMultiplier.toFixed(1)}
                      </span>
                    </div>
                  )}
                  {hasObstacles && (
                    <div className="flex justify-between py-3 border-b border-slate-100 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-700">Presenza Ostacoli</span>
                        <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Rischio +</span>
                      </div>
                      <span className="font-mono font-semibold text-slate-900">
                        ×{pricing.obstacleMultiplier.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-3 border-b border-slate-100 text-sm">
                    <span className="text-slate-700">Logistica (Uscita + ~20km)</span>
                    <span className="font-mono font-semibold text-slate-900">€ {pricing.logistics.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 px-6 py-5 flex justify-between items-center">
                <span className="text-xs uppercase tracking-widest text-slate-400 font-bold">Stima Totale Intervento</span>
                <span className="text-4xl font-bold font-mono text-emerald-500">€ {pricing.total.toFixed(2)}</span>
              </div>

              <div className="p-6">
                <button className="w-full bg-[#141414] text-white py-4 rounded-lg font-bold uppercase tracking-wider text-sm hover:bg-emerald-600 transition-all shadow-lg flex items-center justify-center gap-2">
                  <Users size={18}/> Prenota Flotta Ora
                </button>
                <button
                  onClick={() => setStep(1)}
                  className="w-full mt-3 text-slate-600 py-2 text-sm font-medium hover:text-emerald-600 transition"
                >
                  ← Ricalcola Parametri
                </button>
              </div>

              <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-start gap-3">
                <span className="text-slate-400 text-lg">ℹ️</span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong className="text-slate-700">Algoritmo Intelligente:</strong> Prezzo base €{pricing.basePricePerHa}/ha per {selectedTreatment?.name || 'servizio standard'}.
                  Moltiplicatori applicati: Pendenza {gisData.slope}% (×{pricing.slopeMultiplier.toFixed(1)})
                  {isHillyTerrain && `, Terreno Collinare (×${pricing.terrainMultiplier.toFixed(1)})`}
                  {hasObstacles && `, Ostacoli (×${pricing.obstacleMultiplier.toFixed(2)})`}.
                  Sistema adattivo per garantire qualità e margine operativo.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {savedFields.length > 0 && (
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
              <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <FolderOpen size={18}/> Campi Salvati ({savedFields.length})
              </h4>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {savedFields.map(field => (
                  <div key={field.id} className="bg-white p-3 rounded-lg border border-slate-200 hover:border-emerald-400 transition group">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-bold text-sm text-slate-800">{field.clientName}</p>
                        <p className="text-xs text-slate-500">{field.fieldName}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteField(field.id)}
                        className="p-1 text-slate-400 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                        title="Elimina"
                      >
                        <Trash2 size={14}/>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                      <div className="bg-slate-50 p-2 rounded">
                        <span className="text-slate-500">Area:</span>
                        <strong className="ml-1">{field.gisData.area} ha</strong>
                      </div>
                      <div className="bg-slate-50 p-2 rounded">
                        <span className="text-slate-500">Pendenza:</span>
                        <strong className="ml-1">{field.gisData.slope}%</strong>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mb-2">Salvato: {field.savedAt}</p>
                    <Button
                      onClick={() => handleLoadField(field)}
                      variant="outline"
                      className="w-full text-xs py-1.5"
                    >
                      <ChevronRight size={12}/> Carica Preventivo
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function ServiziGIS() {
  const navigate = useNavigate();
  return (
    <Layout>
      <ServiceConfigurator onBack={() => navigate('/')} />
    </Layout>
  );
}

