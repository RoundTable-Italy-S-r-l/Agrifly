import { useState } from 'react';
import L from 'leaflet';
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
import { LeafletAreaMap } from '@/components/LeafletAreaMap';

interface GisData {
  area: string;
  points: L.LatLng[];
  slope: number;
}

interface SavedField {
  id: string;
  clientName: string;
  fieldName: string;
  gisData: GisData;
  savedAt: string;
}

interface Drone {
  id: string;
  model: string;
  price: number;
  category: string;
  tagline: string;
  targetUse: string;
  specs: {
    tank: string;
    battery: string;
    efficiency: string;
    feature: string;
  };
  roi_months: number;
  efficiency_ha_per_hour: number;
}

interface Affiliate {
  id: number;
  name: string;
  region: string;
  status: 'active' | 'busy' | 'offline';
  jobs_done: number;
  rating: number;
  zone: string;
}

const DRONES: Drone[] = [
  {
    id: 't50',
    model: 'DJI Agras T50',
    price: 28500,
    category: 'Flagship (Top Gamma)',
    tagline: 'Efficienza massima per grandi estensioni',
    targetUse: 'Grandi estensioni, Cerealicoltura intensiva. Efficienza massima.',
    specs: {
      tank: '40L (Liq) / 50kg (Sol)',
      battery: 'N/A',
      efficiency: '25 ha/h',
      feature: 'Radar Phased Array + Doppia nebulizzazione centrifuga'
    },
    roi_months: 8,
    efficiency_ha_per_hour: 25
  },
  {
    id: 't25',
    model: 'DJI Agras T25',
    price: 14200,
    category: 'Compact Precision',
    tagline: 'La versione agile del T50',
    targetUse: 'Vigneti, Frutteti, Terreni complessi.',
    specs: {
      tank: '20L (Liq) / 25kg (Sol)',
      battery: 'N/A',
      efficiency: '12 ha/h',
      feature: 'Dimensioni ridotte + Manovrabilità estrema'
    },
    roi_months: 6,
    efficiency_ha_per_hour: 12
  },
  {
    id: 't30',
    model: 'DJI Agras T30',
    price: 16500,
    category: 'Standard Industry',
    tagline: 'Rapporto Q/P eccellente',
    targetUse: 'Soluzione collaudata per aziende medie.',
    specs: {
      tank: '30L',
      battery: 'N/A',
      efficiency: '16 ha/h',
      feature: 'Branch Targeting Tech + Radar Sferico'
    },
    roi_months: 7,
    efficiency_ha_per_hour: 16
  },
  {
    id: 't70p',
    model: 'DJI Agras T70P',
    price: 32000,
    category: 'Heavy Lift (Next Gen)',
    tagline: 'Sostituisce trattori di grandi dimensioni',
    targetUse: 'Trattamenti massivi su pianura.',
    specs: {
      tank: 'Alta Capacità (70L+)',
      battery: 'N/A',
      efficiency: '30 ha/h',
      feature: 'Aggiornamento recente + Power System potenziato'
    },
    roi_months: 9,
    efficiency_ha_per_hour: 30
  },
  {
    id: 't100',
    model: 'DJI Agras T100',
    price: 45000,
    category: 'Ultra Heavy / Custom',
    tagline: 'Creazione rivoluzionaria',
    targetUse: 'Applicazioni industriali e vaste superfici.',
    specs: {
      tank: 'Capacità Record (100L stima)',
      battery: 'N/A',
      efficiency: '40 ha/h',
      feature: 'Autonomia estesa + Mappatura Cloud integrata'
    },
    roi_months: 10,
    efficiency_ha_per_hour: 40
  }
];

const AFFILIATES: Affiliate[] = [
  { id: 1, name: 'AgriFly Veneto', region: 'Veneto', zone: 'Nord-Est', status: 'active', jobs_done: 124, rating: 4.9 },
  { id: 2, name: 'Droni Toscana Srl', region: 'Toscana', zone: 'Centro', status: 'busy', jobs_done: 89, rating: 4.7 },
  { id: 3, name: 'Sud Tech', region: 'Puglia', zone: 'Sud', status: 'active', jobs_done: 45, rating: 4.5 },
  { id: 4, name: 'Piemonte Agri Drones', region: 'Piemonte', zone: 'Nord-Ovest', status: 'active', jobs_done: 67, rating: 4.8 },
  { id: 5, name: 'Emilia Precision', region: 'Emilia-Romagna', zone: 'Nord', status: 'offline', jobs_done: 112, rating: 4.9 },
];

const BASE_RATE_PER_HA = 45;
const LOGISTICS_FIXED = 100;
const KM_RATE = 0.50;

const calculatePricing = (area: number, slope: number, distance_km: number = 20) => {
  let slopeMultiplier = 1.0;
  let recommendedDrone = 'DJI Agras T50';

  if (slope <= 10) {
    slopeMultiplier = 1.0;
    recommendedDrone = area > 20 ? 'DJI Agras T50' : 'DJI Agras T30';
  } else if (slope <= 20) {
    slopeMultiplier = 1.2;
    recommendedDrone = 'DJI Agras T30';
  } else {
    slopeMultiplier = 1.5;
    recommendedDrone = 'DJI Agras T25';
  }

  const serviceBase = area * BASE_RATE_PER_HA * slopeMultiplier;
  const logistics = LOGISTICS_FIXED + (distance_km * KM_RATE);
  const total = serviceBase + logistics;

  return {
    serviceBase,
    slopeMultiplier,
    logistics,
    total,
    recommendedDrone
  };
};

const calculateROI = (drone: Drone, hectaresPerYear: number = 500) => {
  const croppingDamageSaved = hectaresPerYear * 2000 * 0.045;
  const chemicalSavings = hectaresPerYear * 150 * 0.18;
  const waterSavings = hectaresPerYear * 50;
  
  const totalAnnualSavings = croppingDamageSaved + chemicalSavings + waterSavings;
  const serviceRevenue = hectaresPerYear * BASE_RATE_PER_HA;
  
  const breakEvenMonths = Math.ceil((drone.price / (totalAnnualSavings + serviceRevenue)) * 12);

  return {
    croppingDamageSaved,
    chemicalSavings,
    waterSavings,
    totalAnnualSavings,
    serviceRevenue,
    breakEvenMonths,
    firstYearProfit: (totalAnnualSavings + serviceRevenue) - drone.price
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
  const [savedFields, setSavedFields] = useState<SavedField[]>([]);
  const [clientName, setClientName] = useState('');
  const [fieldName, setFieldName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  const handleGisComplete = (data: GisData) => {
    setGisData(data);
    const calculatedPricing = calculatePricing(parseFloat(data.area), data.slope);
    setPricing(calculatedPricing);
    setShowSaveForm(true);
    setTimeout(() => setStep(2), 1500);
  };

  const handleSaveField = () => {
    if (!gisData || !clientName || !fieldName) return;

    const newField: SavedField = {
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

  const handleLoadField = (field: SavedField) => {
    setGisData(field.gisData);
    const calculatedPricing = calculatePricing(parseFloat(field.gisData.area), field.gisData.slope);
    setPricing(calculatedPricing);
    setStep(2);
  };

  const handleDeleteField = (id: string) => {
    setSavedFields(savedFields.filter(f => f.id !== id));
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight className="rotate-180"/></button>
        <h2 className="text-2xl font-bold text-slate-800">Preventivatore Servizi GIS</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {step === 1 && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <MapIcon className="text-emerald-600"/> 1. Definisci Area Intervento
              </h3>
              <p className="text-slate-500 mb-4 text-sm">Disegna il perimetro del campo direttamente sulla mappa satellitare. Il sistema calcolerà automaticamente superficie (calcolo geodesico reale) e pendenza tramite dati DEM.</p>
              <LeafletAreaMap onComplete={handleGisComplete} />

              {showSaveForm && gisData && (
                <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <h4 className="font-bold text-emerald-900 mb-3 flex items-center gap-2">
                    <Save size={18}/> Salva Area Cliente
                  </h4>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-bold text-emerald-800 mb-1">Nome Cliente</label>
                      <input
                        type="text"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="es. Azienda Rossi"
                        className="w-full px-3 py-2 rounded-lg border border-emerald-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-emerald-800 mb-1">Nome Campo</label>
                      <input
                        type="text"
                        value={fieldName}
                        onChange={(e) => setFieldName(e.target.value)}
                        placeholder="es. Campo Nord"
                        className="w-full px-3 py-2 rounded-lg border border-emerald-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveField}
                      disabled={!clientName || !fieldName}
                      className="text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save size={14}/> Salva Perimetro
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setShowSaveForm(false)}
                      className="text-sm"
                    >
                      Annulla
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && gisData && pricing && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <CheckCircle className="text-emerald-600"/> 2. Preventivo Personalizzato
              </h3>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <span className="text-xs text-slate-500 uppercase">Superficie</span>
                  <div className="font-bold text-xl">{gisData.area} ha</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <span className="text-xs text-slate-500 uppercase">Pendenza</span>
                  <div className="font-bold text-xl text-amber-600">{gisData.slope}%</div>
                </div>
                <div className="p-4 bg-emerald-50 rounded-lg col-span-2">
                  <span className="text-xs text-emerald-700 uppercase font-bold">Drone Ottimale</span>
                  <div className="font-bold text-xl text-emerald-700">{pricing.recommendedDrone}</div>
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-100 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Servizio Base ({gisData.area} ha × €{BASE_RATE_PER_HA}/ha)</span>
                  <span className="font-medium">€ {(parseFloat(gisData.area) * BASE_RATE_PER_HA).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Adeguamento Pendenza ({gisData.slope}% → ×{pricing.slopeMultiplier.toFixed(1)})</span>
                  <span className="font-medium text-amber-600">
                    {pricing.slopeMultiplier > 1 ? `+ € ${(pricing.serviceBase - (parseFloat(gisData.area) * BASE_RATE_PER_HA)).toFixed(2)}` : 'Incluso'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Logistica (Uscita + ~20km)</span>
                  <span className="font-medium">€ {pricing.logistics.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-200">
                  <span>Totale Stimato</span>
                  <span className="text-emerald-700">€ {pricing.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                <p className="text-xs text-blue-700 mb-2">💡 <strong>Algoritmo Intelligente:</strong></p>
                <p className="text-xs text-blue-600">Il prezzo si adatta automaticamente alla difficoltà del terreno per proteggere il margine dell'operatore e garantire un servizio di qualità.</p>
              </div>

              <div className="mt-6 flex gap-3">
                <Button className="w-full">
                  <Users size={16}/> Prenota Affiliato Disponibile
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setStep(1)}>Ridisegna</Button>
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

          <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
            <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
              <Target size={20}/> Perché il Drone?
            </h4>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex gap-2">
                <CheckCircle size={16} className="mt-0.5 flex-shrink-0"/> 
                <span><strong>Zero calpestamento:</strong> Salvi il 4-5% del raccolto</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle size={16} className="mt-0.5 flex-shrink-0"/> 
                <span><strong>-20% fitofarmaci:</strong> Effetto Downwash ottimale</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle size={16} className="mt-0.5 flex-shrink-0"/> 
                <span><strong>-90% acqua:</strong> Precisione millimetrica</span>
              </li>
            </ul>
          </div>

          <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-100">
            <h4 className="font-bold text-emerald-900 mb-2">Garanzia Qualità</h4>
            <p className="text-sm text-emerald-700">Operatori certificati DJI con copertura assicurativa inclusa.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const DroneShop = () => {
  const [selectedDrone, setSelectedDrone] = useState<Drone | null>(null);
  const [roiData, setRoiData] = useState<ReturnType<typeof calculateROI> | null>(null);
  const [hectaresInput, setHectaresInput] = useState(500);

  const openROI = (drone: Drone) => {
    setSelectedDrone(drone);
    setRoiData(calculateROI(drone, hectaresInput));
  };

  const updateROI = (hectares: number) => {
    setHectaresInput(hectares);
    if (selectedDrone) {
      setRoiData(calculateROI(selectedDrone, hectares));
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold text-slate-900 mb-2">Catalogo Droni Agricoli DJI</h2>
      <p className="text-slate-500 mb-8">Prezzi IVA esclusa, kit completo con batterie e accessori. Supporto tecnico certificato incluso.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {DRONES.map(drone => (
          <div key={drone.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition group">
            <div className="h-40 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center relative">
              <Plane size={56} className="text-slate-400 group-hover:scale-110 group-hover:text-emerald-500 transition duration-500" />
              <div className="absolute top-3 right-3 bg-white px-2 py-1 rounded text-xs font-bold shadow-sm">
                ✓ Disponibile
              </div>
            </div>
            <div className="p-5">
              <div className="mb-2">
                <h3 className="font-bold text-lg text-slate-800">{drone.model}</h3>
                <p className="text-xs text-slate-500 font-medium">{drone.category}</p>
              </div>
              <p className="text-xs text-slate-600 mb-3 h-8">{drone.tagline}</p>
              
              <div className="grid grid-cols-1 gap-1 text-xs text-slate-600 mb-4 bg-slate-50 p-3 rounded-lg">
                <div className="flex justify-between">
                  <span>Capacità:</span> <strong>{drone.specs.tank}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Efficienza:</span> <strong>{drone.specs.efficiency}</strong>
                </div>
                <div className="col-span-2 text-emerald-700 font-bold text-center mt-1 pt-2 border-t border-slate-200">
                  {drone.specs.feature}
                </div>
              </div>

              <div className="flex items-baseline justify-between mb-4">
                 <div>
                   <p className="text-xs text-slate-400 line-through">€ {(drone.price * 1.15).toFixed(0)}</p>
                   <p className="text-xl font-bold text-emerald-600">€ {drone.price.toLocaleString()}</p>
                 </div>
                 <Badge color="emerald">-13%</Badge>
              </div>

              <Button onClick={() => openROI(drone)} className="w-full text-sm py-2">
                <Calculator size={14}/> Calcola ROI
              </Button>
            </div>
          </div>
        ))}
      </div>

      {selectedDrone && roiData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-8 relative my-8">
            <button onClick={() => setSelectedDrone(null)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
            
            <div className="flex items-center gap-3 mb-6">
              <Calculator className="text-emerald-600" size={28} />
              <div>
                <h3 className="text-2xl font-bold">Simulatore ROI: {selectedDrone.model}</h3>
                <p className="text-sm text-slate-500">Ritorno sull'Investimento Personalizzato</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Ettari da Trattare Annualmente
              </label>
              <input 
                type="range" 
                min="100" 
                max="1000" 
                step="50"
                value={hectaresInput}
                onChange={(e) => updateROI(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>100 ha</span>
                <span className="font-bold text-emerald-700 text-lg">{hectaresInput} ha/anno</span>
                <span>1000 ha</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-4">
                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                  <DollarSign size={18} className="text-emerald-600"/> Investimento
                </h4>
                <div className="bg-slate-100 p-4 rounded-lg">
                  <p className="text-sm text-slate-600">Costo Acquisto (Kit Completo)</p>
                  <p className="text-3xl font-bold text-slate-900">€ {selectedDrone.price.toLocaleString()}</p>
                </div>

                <h4 className="font-bold text-slate-800 flex items-center gap-2 mt-6">
                  <TrendingUp size={18} className="text-blue-600"/> Risparmi Annui
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between p-2 bg-blue-50 rounded">
                    <span className="text-blue-700">Zero Calpestamento (4.5%)</span>
                    <strong className="text-blue-900">€ {roiData.croppingDamageSaved.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong>
                  </div>
                  <div className="flex justify-between p-2 bg-emerald-50 rounded">
                    <span className="text-emerald-700">Fitofarmaci (-18%)</span>
                    <strong className="text-emerald-900">€ {roiData.chemicalSavings.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong>
                  </div>
                  <div className="flex justify-between p-2 bg-cyan-50 rounded">
                    <span className="text-cyan-700 flex items-center gap-1"><Droplet size={14}/> Acqua (-90%)</span>
                    <strong className="text-cyan-900">€ {roiData.waterSavings.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong>
                  </div>
                  <div className="flex justify-between p-3 bg-slate-800 text-white rounded font-bold border-t-2 border-slate-600 mt-2">
                    <span>Totale Risparmi</span>
                    <span>€ {roiData.totalAnnualSavings.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-6 rounded-xl flex flex-col justify-between">
                <div>
                   <p className="text-emerald-100 text-sm uppercase font-bold mb-2">Break Even Point</p>
                   <p className="text-5xl font-extrabold mb-3">{roiData.breakEvenMonths}</p>
                   <p className="text-2xl font-bold mb-1">Mesi</p>
                   <p className="text-sm text-emerald-100">Basato su {hectaresInput} ha/anno</p>

                   <div className="mt-6 p-4 bg-white/10 backdrop-blur rounded-lg border border-white/20">
                     <p className="text-xs text-emerald-100 uppercase font-bold mb-1">Profitto Primo Anno</p>
                     <p className="text-2xl font-bold">
                       {roiData.firstYearProfit > 0 ? '+' : ''}€ {roiData.firstYearProfit.toLocaleString(undefined, {maximumFractionDigits: 0})}
                     </p>
                   </div>

                   <div className="mt-4 p-4 bg-white/10 backdrop-blur rounded-lg border border-white/20">
                     <p className="text-xs text-emerald-100 uppercase font-bold mb-1">Ricavi Conto Terzi Potenziali</p>
                     <p className="text-2xl font-bold">€ {roiData.serviceRevenue.toLocaleString(undefined, {maximumFractionDigits: 0})}/anno</p>
                     <p className="text-xs text-emerald-100 mt-1">@ €{BASE_RATE_PER_HA}/ha medio mercato</p>
                   </div>
                </div>

                <Button className="w-full mt-6 bg-white text-emerald-700 hover:bg-emerald-50 shadow-lg">
                  <CheckCircle size={16}/> Richiedi Preventivo
                </Button>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-xs text-amber-800">
                <strong>📊 Metodologia:</strong> I calcoli si basano su medie di mercato reali. Zero calpestamento stimato su mais a €2.000/ha. 
                Risparmio fitofarmaci calcolato su €150/ha con riduzione 18% (effetto Downwash). Risparmio acqua su consumo medio €50/ha.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ResellerDashboard = () => {
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dashboard Rivenditore</h2>
          <p className="text-sm text-slate-500">Area di gestione rete affiliati e monitoraggio business</p>
        </div>
        <div className="text-sm text-slate-500">Ultimo aggiornamento: Oggi, 10:30</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-slate-500 text-xs font-bold uppercase">Vendita Hardware</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">€ 78.400</p>
          <span className="text-xs text-emerald-600 flex items-center mt-2">
            <TrendingUp size={12}/> +24% vs mese scorso
          </span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-slate-500 text-xs font-bold uppercase">Commissioni Servizi</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">€ 4.320</p>
          <span className="text-xs text-slate-400 mt-2">12% su fatturato affiliati</span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-slate-500 text-xs font-bold uppercase">Affiliati Attivi</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{AFFILIATES.filter(a => a.status !== 'offline').length}/{AFFILIATES.length}</p>
          <span className="text-xs text-emerald-600 mt-2">Rating medio: 4.76★</span>
        </div>
         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-slate-500 text-xs font-bold uppercase">Richieste Aperte</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">18</p>
          <span className="text-xs text-amber-500 mt-2">6 necessitano dispatching</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800">Rete Affiliati & Dispatching</h3>
              <p className="text-xs text-slate-500 mt-1">Gestione piloti certificati e assegnazione automatica lavori</p>
            </div>
            <Button variant="outline" className="text-xs py-1.5 px-3">
              <Users size={14}/> Aggiungi Affiliato
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-4 font-medium">Affiliato</th>
                  <th className="p-4 font-medium">Zona</th>
                  <th className="p-4 font-medium">Rating</th>
                  <th className="p-4 font-medium">Lavori</th>
                  <th className="p-4 font-medium">Stato</th>
                  <th className="p-4 font-medium text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {AFFILIATES.map(aff => (
                  <tr key={aff.id} className="hover:bg-slate-50 transition">
                    <td className="p-4">
                      <div className="font-medium text-slate-800">{aff.name}</div>
                      <div className="text-xs text-slate-500">{aff.region}</div>
                    </td>
                    <td className="p-4 text-slate-600 text-xs">{aff.zone}</td>
                    <td className="p-4 text-amber-500 font-bold">{aff.rating} ★</td>
                    <td className="p-4 text-slate-700 font-medium">{aff.jobs_done}</td>
                    <td className="p-4">
                      <Badge color={aff.status === 'active' ? 'emerald' : aff.status === 'busy' ? 'amber' : 'slate'}>
                        {aff.status === 'active' ? '✓ Disponibile' : aff.status === 'busy' ? '⏱ Occupato' : '⚫ Offline'}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => setSelectedAffiliate(aff)}
                        className="text-blue-600 font-medium hover:underline text-xs"
                      >
                        Dettagli →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
            <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
              <CheckCircle size={18}/> Modello White-Label
            </h4>
            <p className="text-sm text-blue-800 mb-3">
              Questa piattaforma è personalizzabile con il tuo logo e brand aziendale.
            </p>
            <Button variant="outline" className="text-xs w-full">Configura Branding</Button>
          </div>

          <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-200">
            <h4 className="font-bold text-emerald-900 mb-2">3 Flussi di Cassa</h4>
            <ul className="text-xs text-emerald-800 space-y-2">
              <li className="flex gap-2">
                <span className="font-bold">1.</span> Margine vendita hardware
              </li>
              <li className="flex gap-2">
                <span className="font-bold">2.</span> Commissioni servizi (10-15%)
              </li>
              <li className="flex gap-2">
                <span className="font-bold">3.</span> Ricambi & manutenzione post-vendita
              </li>
            </ul>
          </div>
        </div>
      </div>

      {selectedAffiliate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-8 relative">
            <button onClick={() => setSelectedAffiliate(null)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full">
              <X size={20}/>
            </button>
            
            <h3 className="text-2xl font-bold mb-6">{selectedAffiliate.name}</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-slate-50 rounded-lg">
                <span className="text-xs text-slate-500 uppercase">Regione Operativa</span>
                <div className="font-bold text-lg">{selectedAffiliate.region}</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <span className="text-xs text-slate-500 uppercase">Zona</span>
                <div className="font-bold text-lg">{selectedAffiliate.zone}</div>
              </div>
              <div className="p-4 bg-amber-50 rounded-lg">
                <span className="text-xs text-amber-700 uppercase">Rating Clienti</span>
                <div className="font-bold text-2xl text-amber-600">{selectedAffiliate.rating} ★</div>
              </div>
              <div className="p-4 bg-emerald-50 rounded-lg">
                <span className="text-xs text-emerald-700 uppercase">Lavori Completati</span>
                <div className="font-bold text-2xl text-emerald-600">{selectedAffiliate.jobs_done}</div>
              </div>
            </div>

            <div className="space-y-3">
              <Button className="w-full">Assegna Nuovo Lavoro</Button>
              <Button variant="outline" className="w-full">Visualizza Storico</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function Index() {
  const [view, setView] = useState<'home' | 'shop' | 'service' | 'admin'>('home');

  const renderView = () => {
    switch(view) {
      case 'shop': return <DroneShop />;
      case 'service': return <ServiceConfigurator onBack={() => setView('home')} />;
      case 'admin': return <ResellerDashboard />;
      default: return (
        <div className="text-center py-16 max-w-4xl mx-auto space-y-10">
          <div className="mb-8">
            <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight mb-6 leading-tight">
              Il Futuro dell'<span className="text-emerald-600">Agricoltura</span><br/>È Già Qui
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Piattaforma integrata per <strong>acquisto droni professionali</strong> e <strong>noleggio servizi</strong> di agricoltura di precisione. 
              Simulatore ROI e preventivatore GIS intelligente inclusi.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <div 
              onClick={() => setView('shop')}
              className="group bg-white p-8 rounded-2xl shadow-sm border-2 border-slate-200 cursor-pointer hover:border-emerald-500 hover:shadow-xl transition-all text-left relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition">
                <ShoppingBag size={140} />
              </div>
              <div className="bg-blue-100 w-14 h-14 rounded-xl flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition">
                <ShoppingBag size={28} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Acquista Drone</h3>
              <p className="text-slate-600 mb-4 text-sm leading-relaxed">
                Catalogo DJI Enterprise con <strong>simulatore ROI dinamico</strong>. 
                Scopri in quanti mesi recuperi l'investimento.
              </p>
              <span className="text-blue-600 font-bold flex items-center gap-2 group-hover:gap-3 transition-all">
                Esplora Catalogo <ChevronRight size={18}/>
              </span>
            </div>

            <div 
              onClick={() => setView('service')}
              className="group bg-white p-8 rounded-2xl shadow-sm border-2 border-slate-200 cursor-pointer hover:border-emerald-500 hover:shadow-xl transition-all text-left relative overflow-hidden"
            >
               <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition">
                <MapIcon size={140} />
              </div>
              <div className="bg-emerald-100 w-14 h-14 rounded-xl flex items-center justify-center text-emerald-600 mb-4 group-hover:scale-110 transition">
                <MapIcon size={28} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Richiedi Servizio</h3>
              <p className="text-slate-600 mb-4 text-sm leading-relaxed">
                Non vuoi comprare? <strong>Disegna il tuo campo sulla mappa</strong> e ottieni un preventivo istantaneo. 
                Assegnazione pilota certificato automatica.
              </p>
              <span className="text-emerald-600 font-bold flex items-center gap-2 group-hover:gap-3 transition-all">
                Preventivo GIS <ChevronRight size={18}/>
              </span>
            </div>
          </div>

          <div className="mt-16 pt-12 border-t border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div className="p-6 bg-slate-50 rounded-xl">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 mb-3">
                  <Target size={20}/>
                </div>
                <h4 className="font-bold text-slate-800 mb-2">Zero Calpestamento</h4>
                <p className="text-slate-600 text-xs">Salva il 4-5% del raccolto che il trattore distruggerebbe passando.</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-xl">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-3">
                  <Droplet size={20}/>
                </div>
                <h4 className="font-bold text-slate-800 mb-2">-90% Acqua</h4>
                <p className="text-slate-600 text-xs">Precisione millimetrica riduce drasticamente il consumo idrico.</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-xl">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 mb-3">
                  <TrendingUp size={20}/>
                </div>
                <h4 className="font-bold text-slate-800 mb-2">ROI 6-8 Mesi</h4>
                <p className="text-slate-600 text-xs">Break-even rapido grazie a risparmi operativi e nuove opportunità.</p>
              </div>
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 selection:bg-emerald-200">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-lg border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 font-bold text-xl cursor-pointer group"
            onClick={() => setView('home')}
          >
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white group-hover:bg-emerald-700 transition shadow-md">
              <Plane size={22} />
            </div>
            <span>Agri<span className="text-emerald-600">Tech</span> Solutions</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 font-medium text-sm text-slate-600">
            <button onClick={() => setView('home')} className="hover:text-emerald-600 transition">Home</button>
            <button onClick={() => setView('shop')} className="hover:text-emerald-600 transition">Catalogo Droni</button>
            <button onClick={() => setView('service')} className="hover:text-emerald-600 transition">Servizi GIS</button>
          </nav>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setView('admin')}
              className="text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition"
            >
              🔐 Area Rivenditore
            </button>
            <Button className="hidden md:flex text-sm py-2 px-5">Contattaci</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12">
        {renderView()}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-20">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center text-sm text-slate-500">
          <p>© 2024 AgriTech Solutions - Piattaforma White-Label per Rivenditori DJI Enterprise</p>
          <p className="text-xs mt-2">Dati ROI basati su medie di mercato reali. Consulta il tuo commerciale per dettagli.</p>
        </div>
      </footer>
    </div>
  );
}
