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
  imageUrl?: string;
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

interface Crop {
  id: string;
  name: string;
  yieldPerHa: number;
  marketPrice: number;
  grossRevenue: number;
  tramplingImpact: number;
  tramplingEnabled: boolean;
}

interface Treatment {
  id: string;
  name: string;
  type: 'liquid' | 'solid';
  targetCrops: string[];
  dosage: string;
  operatingSpeed: number;
  marketPrice: { min: number; max: number };
}

const CROPS: Crop[] = [
  {
    id: 'mais-granella',
    name: 'Mais (Granella)',
    yieldPerHa: 13.0,
    marketPrice: 220,
    grossRevenue: 2860,
    tramplingImpact: 0.045,
    tramplingEnabled: true
  },
  {
    id: 'mais-trinciato',
    name: 'Mais (Trinciato)',
    yieldPerHa: 60.0,
    marketPrice: 55,
    grossRevenue: 3300,
    tramplingImpact: 0.045,
    tramplingEnabled: true
  },
  {
    id: 'riso',
    name: 'Riso',
    yieldPerHa: 7.0,
    marketPrice: 450,
    grossRevenue: 3150,
    tramplingImpact: 0.025,
    tramplingEnabled: true
  },
  {
    id: 'grano-tenero',
    name: 'Grano Tenero',
    yieldPerHa: 7.5,
    marketPrice: 230,
    grossRevenue: 1725,
    tramplingImpact: 0.03,
    tramplingEnabled: true
  },
  {
    id: 'vigneto',
    name: 'Vigneto (Collina)',
    yieldPerHa: 10.0,
    marketPrice: 600,
    grossRevenue: 6000,
    tramplingImpact: 0,
    tramplingEnabled: false
  },
  {
    id: 'pomodoro',
    name: 'Pomodoro',
    yieldPerHa: 80.0,
    marketPrice: 110,
    grossRevenue: 8800,
    tramplingImpact: 0.05,
    tramplingEnabled: true
  }
];

const TREATMENTS: Treatment[] = [
  {
    id: 'diserbo-pre',
    name: 'Diserbo Pre-Emergenza',
    type: 'liquid',
    targetCrops: ['mais-granella', 'mais-trinciato', 'riso'],
    dosage: '30-40 L/ha',
    operatingSpeed: 11,
    marketPrice: { min: 45, max: 55 }
  },
  {
    id: 'fungicida-insetticida',
    name: 'Fungicida / Insetticida',
    type: 'liquid',
    targetCrops: ['grano-tenero', 'mais-granella'],
    dosage: '15-20 L/ha',
    operatingSpeed: 19,
    marketPrice: { min: 35, max: 45 }
  },
  {
    id: 'vigneto-peronospora',
    name: 'Trattamento Vigneto (Peronospora)',
    type: 'liquid',
    targetCrops: ['vigneto'],
    dosage: '40-60 L/ha',
    operatingSpeed: 5,
    marketPrice: { min: 80, max: 120 }
  },
  {
    id: 'disseccante',
    name: 'Disseccante',
    type: 'liquid',
    targetCrops: ['pomodoro'],
    dosage: '20 L/ha',
    operatingSpeed: 15,
    marketPrice: { min: 40, max: 50 }
  },
  {
    id: 'lotta-biologica',
    name: 'Lotta Biologica (Capsule Piralide)',
    type: 'solid',
    targetCrops: ['mais-granella', 'mais-trinciato'],
    dosage: '< 1 kg/ha',
    operatingSpeed: 35,
    marketPrice: { min: 20, max: 25 }
  },
  {
    id: 'semina-cover',
    name: 'Semina Cover Crops',
    type: 'solid',
    targetCrops: ['mais-granella', 'grano-tenero'],
    dosage: '20-30 kg/ha',
    operatingSpeed: 15,
    marketPrice: { min: 30, max: 40 }
  }
];

const DRONES: Drone[] = [
  {
    id: 't50',
    model: 'DJI Agras T50',
    price: 28500,
    category: 'Flagship (Top Gamma)',
    tagline: 'Efficienza massima per grandi estensioni',
    targetUse: 'Grandi estensioni, Cerealicoltura intensiva. Efficienza massima.',
    imageUrl: 'https://cdn.builder.io/api/v1/image/assets%2F2465e073f7c94097be8616ce134014fe%2F58d74d38d1fb4075a2b3a226cc229907?format=webp&width=800',
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
    id: 't30',
    model: 'DJI Agras T30',
    price: 16500,
    category: 'Standard Industry',
    tagline: 'Rapporto Q/P eccellente',
    targetUse: 'Soluzione collaudata per aziende medie.',
    imageUrl: 'https://cdn.builder.io/api/v1/image/assets%2F2465e073f7c94097be8616ce134014fe%2Fd8d2c5c643ae4c44b415ab8d453b6b93?format=webp&width=800',
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
    imageUrl: 'https://cdn.builder.io/api/v1/image/assets%2F2465e073f7c94097be8616ce134014fe%2Fbc07e146eb984c448fb3fe46a05699c8?format=webp&width=800',
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
    imageUrl: 'https://cdn.builder.io/api/v1/image/assets%2F2465e073f7c94097be8616ce134014fe%2Fd5ca49f288ac47d8932ade07a9b066ae?format=webp&width=800',
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
    recommendedDrone = 'DJI Agras T30';
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

const calculateROI = (
  drone: Drone,
  hectaresPerYear: number = 500,
  crop: Crop = CROPS[0],
  treatment: Treatment = TREATMENTS[0],
  interventionsPerYear: number = 1,
  isHilly: boolean = false
) => {
  const terrainMultiplier = isHilly ? 1.4 : 1.0;
  const speedReduction = isHilly ? 0.7 : 1.0;

  const croppingDamageSaved = crop.tramplingEnabled
    ? hectaresPerYear * crop.grossRevenue * crop.tramplingImpact * interventionsPerYear
    : 0;

  const avgTreatmentPrice = (treatment.marketPrice.min + treatment.marketPrice.max) / 2;
  const externalServiceCost = hectaresPerYear * avgTreatmentPrice * terrainMultiplier * interventionsPerYear;

  const droneOperatingCost = hectaresPerYear * 2.5 * interventionsPerYear;
  const serviceSavings = externalServiceCost - droneOperatingCost;

  const chemicalSavings = treatment.type === 'liquid' ? hectaresPerYear * 150 * 0.18 * interventionsPerYear : 0;
  const waterSavings = treatment.type === 'liquid' ? hectaresPerYear * 50 * interventionsPerYear : 0;

  const totalAnnualSavings = croppingDamageSaved + serviceSavings + chemicalSavings + waterSavings;

  const operatingHoursPerYear = (hectaresPerYear / (treatment.operatingSpeed * speedReduction)) * interventionsPerYear;
  const potentialServiceRevenue = hectaresPerYear * avgTreatmentPrice * interventionsPerYear;

  const breakEvenMonths = totalAnnualSavings > 0
    ? Math.ceil((drone.price / totalAnnualSavings) * 12)
    : 999;

  return {
    croppingDamageSaved,
    serviceSavings,
    chemicalSavings,
    waterSavings,
    droneOperatingCost,
    externalServiceCost,
    totalAnnualSavings,
    potentialServiceRevenue,
    operatingHoursPerYear,
    breakEvenMonths,
    firstYearProfit: totalAnnualSavings - drone.price
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
    setStep(1);
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
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
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
                <div className="p-4 bg-emerald-50 rounded-lg">
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
        </div>
      </div>
    </div>
  );
};

const DroneShop = () => {
  const [selectedDrone, setSelectedDrone] = useState<Drone | null>(null);
  const [roiData, setRoiData] = useState<ReturnType<typeof calculateROI> | null>(null);
  const [hectaresInput, setHectaresInput] = useState(500);
  const [selectedCrop, setSelectedCrop] = useState<Crop>(CROPS[0]);
  const [selectedTreatment, setSelectedTreatment] = useState<Treatment>(TREATMENTS[0]);
  const [interventionsPerYear, setInterventionsPerYear] = useState(1);
  const [isHilly, setIsHilly] = useState(false);

  const openROI = (drone: Drone) => {
    setSelectedDrone(drone);
    setRoiData(calculateROI(drone, hectaresInput, selectedCrop, selectedTreatment, interventionsPerYear, isHilly));
  };

  const recalculateROI = () => {
    if (selectedDrone) {
      setRoiData(calculateROI(selectedDrone, hectaresInput, selectedCrop, selectedTreatment, interventionsPerYear, isHilly));
    }
  };

  const updateROI = (hectares: number) => {
    setHectaresInput(hectares);
    if (selectedDrone) {
      setRoiData(calculateROI(selectedDrone, hectares, selectedCrop, selectedTreatment, interventionsPerYear, isHilly));
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold text-slate-900 mb-2">Catalogo Droni Agricoli DJI</h2>
      <p className="text-slate-500 mb-8">Prezzi IVA esclusa, kit completo con batterie e accessori. Supporto tecnico certificato incluso.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {DRONES.map(drone => (
          <div key={drone.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-2xl hover:-translate-y-1 hover:border-emerald-400 transition-all group relative">
            {/* Discount Badge */}
            <span className="absolute top-3 left-3 z-10 text-[10px] font-bold text-white bg-emerald-600 px-2.5 py-1 rounded-full shadow-md">
              -13%
            </span>

            <div className="h-56 bg-white flex items-center justify-center relative overflow-hidden">
              {drone.imageUrl ? (
                <img
                  src={drone.imageUrl}
                  alt={`Drone agricolo ${drone.model}`}
                  className="h-52 w-auto object-contain drop-shadow-2xl transition-transform duration-300 group-hover:scale-110"
                />
              ) : (
                <Plane size={100} className="text-slate-300 group-hover:scale-110 transition duration-300" />
              )}
            </div>
            <div className="p-5">
              <div className="mb-3">
                <h3 className="font-bold text-base text-slate-900 uppercase tracking-wide">{drone.model}</h3>
                <p className="text-xs text-slate-500 font-medium mb-1">{drone.category}</p>
                <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  <span className="font-semibold">Disponibile</span>
                </div>
              </div>
              <p className="text-xs text-slate-600 mb-4 min-h-[2rem]">{drone.tagline}</p>

              {/* Specs with Icons - No Gray Background */}
              <div className="mb-4 py-3 border-t border-b border-slate-200">
                <div className="flex items-center justify-between text-xs mb-2">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Droplet size={14} className="text-slate-400" />
                    <span>Serbatoio</span>
                  </div>
                  <strong className="text-slate-900 text-sm">{drone.specs.tank.split(' ')[0]}</strong>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Wind size={14} className="text-slate-400" />
                    <span>Efficienza</span>
                  </div>
                  <strong className="text-slate-900 text-sm">{drone.specs.efficiency}</strong>
                </div>
              </div>

              {/* Tech Highlight */}
              <div className="text-[10px] text-center text-slate-600 font-medium mb-4 px-1 leading-tight min-h-[2.5rem]">
                {drone.specs.feature}
              </div>

              {/* Price - Bigger and Black */}
              <div className="mb-4">
                 <p className="text-[10px] text-slate-300 line-through mb-1">€ {(drone.price * 1.15).toFixed(0)}</p>
                 <p className="text-3xl font-bold text-black">€ {drone.price.toLocaleString()}</p>
              </div>

              {/* Outline Button */}
              <Button
                onClick={() => openROI(drone)}
                variant="outline"
                className="w-full text-sm py-2.5 border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white font-semibold uppercase tracking-wide transition-all"
              >
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

            {/* 3-Step Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Step 1: Coltura */}
              <div className="bg-slate-50 p-4 rounded-xl">
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                  Step 1: Coltura
                </label>
                <select
                  value={selectedCrop.id}
                  onChange={(e) => {
                    const crop = CROPS.find(c => c.id === e.target.value) || CROPS[0];
                    setSelectedCrop(crop);
                    recalculateROI();
                  }}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {CROPS.map(crop => (
                    <option key={crop.id} value={crop.id}>{crop.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-2">Ricavo: <strong>€ {selectedCrop.grossRevenue.toLocaleString()}/ha</strong></p>
              </div>

              {/* Step 2: Trattamento */}
              <div className="bg-slate-50 p-4 rounded-xl">
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                  Step 2: Trattamento
                </label>
                <select
                  value={selectedTreatment.id}
                  onChange={(e) => {
                    const treatment = TREATMENTS.find(t => t.id === e.target.value) || TREATMENTS[0];
                    setSelectedTreatment(treatment);
                    recalculateROI();
                  }}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {TREATMENTS.map(treatment => (
                    <option key={treatment.id} value={treatment.id}>{treatment.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-2">
                  {selectedTreatment.type === 'liquid' ? '💧' : '📦'} {selectedTreatment.dosage} • {selectedTreatment.operatingSpeed} ha/h
                </p>
              </div>

              {/* Step 3: Interventi */}
              <div className="bg-slate-50 p-4 rounded-xl">
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                  Step 3: Interventi/Anno
                </label>
                <select
                  value={interventionsPerYear}
                  onChange={(e) => {
                    setInterventionsPerYear(parseInt(e.target.value));
                    recalculateROI();
                  }}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {[1, 2, 3, 4, 5, 6].map(num => (
                    <option key={num} value={num}>{num} volt{num > 1 ? 'e' : 'a'}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-2">Ore volo: <strong>{roiData.operatingHoursPerYear.toFixed(1)}h/anno</strong></p>
              </div>
            </div>

            {/* Terrain Toggle */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⛰️</span>
                <div>
                  <p className="text-sm font-bold text-slate-800">Terreno Collinare / Complesso</p>
                  <p className="text-xs text-slate-600">+40% prezzo terzista, -30% velocità operativa</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsHilly(!isHilly);
                  recalculateROI();
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  isHilly ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    isHilly ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
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
                className="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                style={{
                  background: `linear-gradient(to right, #10b981 0%, #10b981 ${((hectaresInput - 100) / 900) * 100}%, #cbd5e1 ${((hectaresInput - 100) / 900) * 100}%, #cbd5e1 100%)`
                }}
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
                <div className="space-y-0 text-sm">
                  <div className="flex justify-between py-3 border-b border-dashed border-slate-200">
                    <span className="text-slate-600">Zero Calpestamento (4.5%)</span>
                    <strong className="text-slate-900 font-mono">€ {roiData.croppingDamageSaved.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong>
                  </div>
                  <div className="flex justify-between py-3 border-b border-dashed border-slate-200">
                    <span className="text-slate-600">Fitofarmaci (-18%)</span>
                    <strong className="text-slate-900 font-mono">€ {roiData.chemicalSavings.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong>
                  </div>
                  <div className="flex justify-between py-3 border-b border-dashed border-slate-200">
                    <span className="text-slate-600 flex items-center gap-1"><Droplet size={14}/> Acqua (-90%)</span>
                    <strong className="text-slate-900 font-mono">€ {roiData.waterSavings.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong>
                  </div>
                  <div className="flex justify-between p-3 bg-slate-900 text-white rounded font-bold mt-3">
                    <span>Totale Risparmi</span>
                    <span className="font-mono">€ {roiData.totalAnnualSavings.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#141414] text-white p-8 rounded-xl flex flex-col justify-between shadow-2xl">
                <div>
                   <p className="text-emerald-500 text-xs uppercase font-bold tracking-widest mb-3 letterspacing-2">Break Even Point</p>
                   <p className="text-7xl font-extrabold mb-2 leading-none text-white">{roiData.breakEvenMonths}</p>
                   <p className="text-2xl font-bold mb-1 text-white">Mesi</p>
                   <p className="text-sm text-slate-400">Basato su {hectaresInput} ha/anno</p>

                   <div className="mt-6 p-4 bg-[#222] rounded-lg border-l-4 border-emerald-500">
                     <p className="text-xs text-slate-400 uppercase font-bold mb-2">Profitto Primo Anno</p>
                     <p className="text-3xl font-bold font-mono text-emerald-500">
                       {roiData.firstYearProfit > 0 ? '+' : ''}€ {roiData.firstYearProfit.toLocaleString(undefined, {maximumFractionDigits: 0})}
                     </p>
                   </div>

                   <div className="mt-4 p-4 bg-[#222] rounded-lg border-l-4 border-emerald-500">
                     <p className="text-xs text-slate-400 uppercase font-bold mb-2">Ricavi Conto Terzi Potenziali</p>
                     <p className="text-3xl font-bold font-mono text-emerald-500">€ {roiData.serviceRevenue.toLocaleString(undefined, {maximumFractionDigits: 0})}<span className="text-lg text-slate-400">/anno</span></p>
                     <p className="text-xs text-slate-500 mt-1">@ €{BASE_RATE_PER_HA}/ha medio mercato</p>
                   </div>
                </div>

                <Button className="w-full mt-6 bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg font-bold uppercase tracking-wide">
                  <CheckCircle size={16}/> Richiedi Preventivo
                </Button>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-start gap-3">
              <span className="text-slate-400 text-lg">ℹ️</span>
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong className="text-slate-700">Metodologia:</strong> I calcoli si basano su medie di mercato reali. Zero calpestamento stimato su mais a €2.000/ha.
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
        <div className="space-y-0">
          {/* Hero con immagine di sfondo */}
          <div
            className="relative py-32 md:py-40 text-center bg-cover bg-center"
            style={{ backgroundImage: `url('https://images.pexels.com/photos/2278543/pexels-photo-2278543.jpeg?auto=compress&cs=tinysrgb&w=1920')` }}
          >
            <div className="absolute inset-0 bg-slate-900/75"></div>
            <div className="relative z-10 max-w-4xl mx-auto px-4">
              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight text-white">
                DJI <span className="font-semibold text-white/80">Agriculture</span>
              </h1>
              <p className="text-base md:text-lg text-white/90 max-w-2xl mx-auto font-light">
                Dalla vendita della flotta alla gestione operativa: la piattaforma completa per l'agricoltura di precisione.
              </p>
            </div>
          </div>

          <div className="max-w-5xl mx-auto px-4 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div
              onClick={() => setView('shop')}
              className="group bg-white p-10 rounded-lg border border-slate-200 cursor-pointer hover:border-slate-400 hover:shadow-lg transition-all text-left relative overflow-hidden hover:-translate-y-1"
            >
              <h3 className="text-2xl font-bold text-slate-900 mb-3 uppercase tracking-wide">Acquista Drone</h3>
              <p className="text-slate-600 mb-6 text-sm leading-relaxed">
                Catalogo DJI Enterprise con <strong>simulatore ROI dinamico</strong>.
                Scopri in quanti mesi recuperi l'investimento.
              </p>
              <button className="px-5 py-2.5 border-2 border-slate-900 text-slate-900 font-semibold text-sm uppercase tracking-wide rounded hover:bg-slate-900 hover:text-white transition">
                Esplora Catalogo
              </button>
            </div>

            <div
              onClick={() => setView('service')}
              className="group bg-white p-10 rounded-lg border border-slate-200 cursor-pointer hover:border-slate-400 hover:shadow-lg transition-all text-left relative overflow-hidden hover:-translate-y-1"
            >
              <h3 className="text-2xl font-bold text-slate-900 mb-3 uppercase tracking-wide">Richiedi Servizio</h3>
              <p className="text-slate-600 mb-6 text-sm leading-relaxed">
                Non vuoi comprare? <strong>Disegna il tuo campo sulla mappa</strong> e ottieni un preventivo istantaneo.
                Assegnazione pilota certificato automatica.
              </p>
              <button className="px-5 py-2.5 bg-emerald-600 text-white font-semibold text-sm uppercase tracking-wide rounded hover:bg-emerald-700 transition">
                Preventivo GIS
              </button>
            </div>
          </div>

          <div className="mt-20 pt-12 border-t border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
              <div className="p-6 bg-white border-l-4 border-emerald-600 rounded-lg shadow-sm">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-5xl font-bold text-slate-900">4-5%</span>
                </div>
                <h4 className="font-bold text-slate-800 mb-2 uppercase tracking-wide text-sm">Zero Calpestamento</h4>
                <p className="text-slate-600 text-sm">Raccolto salvato che il trattore distruggerebbe passando.</p>
              </div>
              <div className="p-6 bg-white border-l-4 border-blue-600 rounded-lg shadow-sm">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-5xl font-bold text-slate-900">-90%</span>
                </div>
                <h4 className="font-bold text-slate-800 mb-2 uppercase tracking-wide text-sm">Acqua</h4>
                <p className="text-slate-600 text-sm">Riduzione consumo idrico grazie a precisione millimetrica.</p>
              </div>
              <div className="p-6 bg-white border-l-4 border-amber-600 rounded-lg shadow-sm">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-5xl font-bold text-slate-900">6-8</span>
                  <span className="text-lg text-slate-600">mesi</span>
                </div>
                <h4 className="font-bold text-slate-800 mb-2 uppercase tracking-wide text-sm">ROI</h4>
                <p className="text-slate-600 text-sm">Break-even rapido con risparmi operativi e nuove opportunità.</p>
              </div>
            </div>
          </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-slate-200">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setView('home')}
          >
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2F2465e073f7c94097be8616ce134014fe%2Fab87517a72b04105b416c2482c4ec60b?format=webp&width=800"
              alt="DJI Agriculture app icon"
              className="h-9 w-9 rounded-2xl object-cover shadow-md group-hover:shadow-lg transition-shadow"
            />
            <span className="hidden sm:flex flex-col items-start leading-none">
              <span className="text-[10px] tracking-[0.28em] font-semibold text-slate-500 uppercase">DJI</span>
              <span className="text-xs tracking-[0.24em] font-semibold text-slate-900 uppercase">Agriculture</span>
            </span>
          </button>

          <nav className="hidden md:flex items-center justify-center flex-1">
            <div className="inline-flex items-center gap-1 rounded-full bg-slate-100/70 px-1.5 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-600">
              <button
                onClick={() => setView('home')}
                className={`px-3 py-1 rounded-full transition-colors ${view === 'home' ? 'bg-slate-900 text-white' : 'hover:bg-white hover:text-slate-900'}`}
              >
                Home
              </button>
              <button
                onClick={() => setView('shop')}
                className={`px-3 py-1 rounded-full transition-colors ${view === 'shop' ? 'bg-slate-900 text-white' : 'hover:bg-white hover:text-slate-900'}`}
              >
                Catalogo Droni
              </button>
              <button
                onClick={() => setView('service')}
                className={`px-3 py-1 rounded-full transition-colors ${view === 'service' ? 'bg-slate-900 text-white' : 'hover:bg-white hover:text-slate-900'}`}
              >
                Servizi GIS
              </button>
            </div>
          </nav>

          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={() => setView('admin')}
              className="hidden sm:inline-flex items-center gap-1.5 text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-full hover:bg-slate-50 transition-colors"
            >
              <span>Login Rivenditori</span>
            </button>
            <Button className="text-xs md:text-sm py-2 px-4 md:px-5 font-semibold tracking-wide rounded-full bg-slate-900 text-white hover:bg-black">
              Contattaci
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12">
        {renderView()}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-20">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center text-sm text-slate-500">
          <p>© 2024 DJI Agriculture Partner Platform – soluzione white‑label per rivenditori autorizzati.</p>
          <p className="text-xs mt-2">Dati ROI basati su medie di mercato reali. Consulta il tuo commerciale per dettagli.</p>
        </div>
      </footer>
    </div>
  );
}
