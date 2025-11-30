import { useState } from 'react';
import { 
  ShoppingBag, 
  Map as MapIcon, 
  ChevronRight, 
  Calculator, 
  Plane, 
  X,
  ArrowRight,
  Wind,
  CheckCircle
} from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

interface GisData {
  area: string;
  points: Point[];
}

interface Drone {
  id: string;
  model: string;
  price: number;
  category: string;
  image: string;
  tagline: string;
  specs: {
    tank: string;
    battery: string;
    efficiency: string;
  };
  roi_months: number;
}

interface Affiliate {
  id: number;
  name: string;
  region: string;
  status: 'active' | 'busy';
  jobs_done: number;
  rating: number;
}

const DRONES: Drone[] = [
  {
    id: 't40',
    model: 'DJI Agras T40',
    price: 26500,
    category: 'Spraying',
    image: 'T40',
    tagline: 'Il gigante per grandi estensioni',
    specs: { tank: '40L', battery: '30Ah', efficiency: '21 ha/h' },
    roi_months: 8
  },
  {
    id: 't10',
    model: 'DJI Agras T10',
    price: 11200,
    category: 'Spraying',
    image: 'T10',
    tagline: 'Agile e compatto per colline',
    specs: { tank: '8L', battery: '9.5Ah', efficiency: '6 ha/h' },
    roi_months: 6
  },
  {
    id: 'm3m',
    model: 'Mavic 3 Multispectral',
    price: 4600,
    category: 'Analysis',
    image: 'M3M',
    tagline: 'Mappatura di precisione NDVI',
    specs: { tank: 'N/A', battery: 'N/A', efficiency: '200 ha/volo' },
    roi_months: 3
  }
];

const AFFILIATES: Affiliate[] = [
  { id: 1, name: 'AgriFly Veneto', region: 'Veneto', status: 'active', jobs_done: 124, rating: 4.9 },
  { id: 2, name: 'Droni Toscana Srl', region: 'Toscana', status: 'busy', jobs_done: 89, rating: 4.7 },
  { id: 3, name: 'Sud Tech', region: 'Puglia', status: 'active', jobs_done: 45, rating: 4.5 },
];

const Badge = ({ children, color = 'emerald' }: { children: React.ReactNode; color?: string }) => (
  <span className={`px-2 py-1 rounded-full text-xs font-bold ${color === 'emerald' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
    {children}
  </span>
);

const Button = ({ children, onClick, variant = 'primary', className = '' }: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  className?: string;
}) => {
  const baseStyle = "px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 justify-center";
  const variants = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md",
    secondary: "bg-slate-800 text-white hover:bg-slate-700",
    outline: "border-2 border-slate-200 text-slate-700 hover:border-emerald-500 hover:text-emerald-600",
    ghost: "text-slate-500 hover:bg-slate-100"
  };
  return (
    <button onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const GisMapSimulator = ({ onComplete }: { onComplete: (data: GisData) => void }) => {
  const [points, setPoints] = useState<Point[]>([]);
  const [isClosed, setIsClosed] = useState(false);
  const [area, setArea] = useState('0');

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isClosed) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (points.length > 2 && Math.abs(x - points[0].x) < 20 && Math.abs(y - points[0].y) < 20) {
      setIsClosed(true);
      const simulatedArea = (Math.random() * 10 + 5).toFixed(2); 
      setArea(simulatedArea);
      onComplete({ area: simulatedArea, points: points });
    } else {
      setPoints([...points, { x, y }]);
    }
  };

  const resetMap = () => {
    setPoints([]);
    setIsClosed(false);
    setArea('0');
  };

  return (
    <div className="relative w-full h-96 bg-slate-200 rounded-xl overflow-hidden border-2 border-slate-300 cursor-crosshair group shadow-inner">
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-60 group-hover:opacity-100 transition duration-500"
        style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80")' }}
        onClick={handleMapClick}
      >
        {!isClosed && points.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 px-4 py-2 rounded-lg shadow-lg text-slate-700 font-medium animate-bounce">
              📍 Clicca sulla mappa per disegnare il perimetro
            </div>
          </div>
        )}
      </div>

      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {points.length > 0 && (
          <>
            <polygon 
              points={points.map(p => `${p.x},${p.y}`).join(' ')}
              className={`fill-emerald-500/30 stroke-emerald-600 stroke-2 ${isClosed ? 'block' : 'hidden'}`}
            />
            <polyline 
              points={points.map(p => `${p.x},${p.y}`).join(' ')}
              className={`fill-none stroke-emerald-600 stroke-2 ${isClosed ? 'hidden' : 'block'}`}
            />
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="4" className="fill-white stroke-emerald-600 stroke-2" />
            ))}
          </>
        )}
      </svg>

      <div className="absolute top-4 right-4 flex flex-col gap-2">
         <button onClick={resetMap} className="bg-white p-2 rounded shadow text-slate-600 hover:text-red-500" title="Resetta">
           <X size={20} />
         </button>
      </div>

      {isClosed && (
        <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur p-4 rounded-xl shadow-xl border-l-4 border-emerald-500 flex justify-between items-center">
          <div>
            <p className="text-xs text-slate-500 uppercase font-bold">Area Rilevata</p>
            <p className="text-2xl font-bold text-slate-800">{area} Ettari</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase font-bold">Pendenza Media (DEM)</p>
            <p className="text-lg font-bold text-slate-800 flex items-center gap-1">
              <Wind size={16} className="text-amber-500"/> ~8%
            </p>
          </div>
          <div className="text-right">
             <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-bold">Ottimo per DJI T40</span>
          </div>
        </div>
      )}
    </div>
  );
};

const ServiceConfigurator = ({ onBack }: { onBack: () => void }) => {
  const [step, setStep] = useState(1);
  const [gisData, setGisData] = useState<GisData | null>(null);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight className="rotate-180"/></button>
        <h2 className="text-2xl font-bold text-slate-800">Preventivatore Servizi</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {step === 1 && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <MapIcon className="text-emerald-600"/> 1. Definisci Area Intervento
              </h3>
              <p className="text-slate-500 mb-4 text-sm">Disegna il perimetro del campo direttamente sulla mappa satellitare per un calcolo preciso.</p>
              <GisMapSimulator onComplete={(data) => {
                setGisData(data);
                setTimeout(() => setStep(2), 1500);
              }} />
            </div>
          )}

          {step === 2 && gisData && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <CheckCircle className="text-emerald-600"/> 2. Analisi & Costi
              </h3>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <span className="text-xs text-slate-500 uppercase">Superficie</span>
                  <div className="font-bold text-xl">{gisData.area} ha</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <span className="text-xs text-slate-500 uppercase">Drone Consigliato</span>
                  <div className="font-bold text-xl text-emerald-600">DJI Agras T40</div>
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-100 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Servizio Base (€45/ha)</span>
                  <span className="font-medium">€ {(parseFloat(gisData.area) * 45).toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Supplemento Pendenza (8%)</span>
                  <span className="font-medium text-emerald-600">Incluso</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Logistica & Setup</span>
                  <span className="font-medium">€ 120</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-200">
                  <span>Totale Stimato</span>
                  <span className="text-emerald-700">€ {(parseFloat(gisData.area) * 45 + 120).toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Button className="w-full">Prenota Affiliato</Button>
                <Button variant="outline" className="w-full" onClick={() => setStep(1)}>Modifica Area</Button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
            <h4 className="font-bold text-blue-900 mb-2">Perché usare il drone?</h4>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex gap-2"><CheckCircle size={16}/> Zero calpestamento (Salvi il 5%)</li>
              <li className="flex gap-2"><CheckCircle size={16}/> Precisione centimetrica</li>
              <li className="flex gap-2"><CheckCircle size={16}/> Risparmio acqua fino al 90%</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

const DroneShop = () => {
  const [selectedDrone, setSelectedDrone] = useState<Drone | null>(null);

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold text-slate-900 mb-2">Vendita Droni Agricoli</h2>
      <p className="text-slate-500 mb-8">Soluzioni professionali con supporto tecnico incluso.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {DRONES.map(drone => (
          <div key={drone.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition group">
            <div className="h-48 bg-slate-100 flex items-center justify-center relative">
              <Plane size={64} className="text-slate-300 group-hover:scale-110 transition duration-500" />
              <div className="absolute top-4 right-4 bg-white px-2 py-1 rounded text-xs font-bold shadow-sm">
                Disponibile
              </div>
            </div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-xl text-slate-800">{drone.model}</h3>
              </div>
              <p className="text-sm text-slate-500 mb-4 h-10">{drone.tagline}</p>
              
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mb-6 bg-slate-50 p-3 rounded-lg">
                <div>Capacità: <strong>{drone.specs.tank}</strong></div>
                <div>Batteria: <strong>{drone.specs.battery}</strong></div>
                <div className="col-span-2">Efficienza: <strong>{drone.specs.efficiency}</strong></div>
              </div>

              <div className="flex items-center justify-between mb-4">
                 <div>
                   <p className="text-xs text-slate-400 line-through">Listino € {(drone.price * 1.1).toFixed(0)}</p>
                   <p className="text-2xl font-bold text-emerald-600">€ {drone.price.toLocaleString()}</p>
                 </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button onClick={() => setSelectedDrone(drone)}>Vedi ROI & Dettagli</Button>
                <button className="text-xs text-center text-slate-500 hover:text-emerald-600 underline">Scarica Scheda Tecnica</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedDrone && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-8 relative">
            <button onClick={() => setSelectedDrone(null)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
            
            <div className="flex items-center gap-3 mb-6">
              <Calculator className="text-emerald-600" />
              <h3 className="text-2xl font-bold">Analisi Redditività: {selectedDrone.model}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <p className="text-slate-600">Investimento Iniziale: <strong>€ {selectedDrone.price.toLocaleString()}</strong></p>
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <h4 className="font-bold text-blue-900 mb-2">Risparmio vs Trattore</h4>
                  <ul className="space-y-2 text-sm text-blue-800">
                    <li>• Nessun danno da calpestamento</li>
                    <li>• -20% uso fitofarmaci</li>
                    <li>• -90% consumo acqua</li>
                  </ul>
                </div>
              </div>

              <div className="bg-slate-900 text-white p-6 rounded-xl flex flex-col justify-between">
                <div>
                   <p className="text-slate-400 text-sm uppercase font-bold">Break Even Point</p>
                   <p className="text-4xl font-bold text-emerald-400 mt-2">{selectedDrone.roi_months} Mesi</p>
                   <p className="text-sm text-slate-400 mt-2">Stimato su 500ha/anno</p>
                </div>
                <Button className="w-full mt-6 bg-white text-slate-900 hover:bg-slate-200">Contatta Commerciale</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ResellerDashboard = () => (
  <div className="max-w-6xl mx-auto">
    <div className="flex justify-between items-center mb-8">
      <h2 className="text-2xl font-bold text-slate-900">Dashboard Partner</h2>
      <div className="text-sm text-slate-500">Ultimo aggiornamento: Oggi, 10:30</div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <p className="text-slate-500 text-xs font-bold uppercase">Fatturato Mese</p>
        <p className="text-2xl font-bold text-slate-800 mt-1">€ 45.200</p>
        <span className="text-xs text-emerald-600 flex items-center mt-2"><ArrowRight size={12} className="-rotate-45"/> +12% vs scorso mese</span>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <p className="text-slate-500 text-xs font-bold uppercase">Commissioni Noleggio</p>
        <p className="text-2xl font-bold text-slate-800 mt-1">€ 3.450</p>
        <span className="text-xs text-slate-400 mt-2">15% fee su servizi</span>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <p className="text-slate-500 text-xs font-bold uppercase">Affiliati Attivi</p>
        <p className="text-2xl font-bold text-slate-800 mt-1">8</p>
        <span className="text-xs text-emerald-600 mt-2">2 nuovi in attesa</span>
      </div>
       <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <p className="text-slate-500 text-xs font-bold uppercase">Richieste Aperte</p>
        <p className="text-2xl font-bold text-slate-800 mt-1">14</p>
        <span className="text-xs text-amber-500 mt-2">4 urgenti</span>
      </div>
    </div>

    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center">
        <h3 className="font-bold text-slate-800">Rete Affiliati</h3>
        <Button variant="outline" className="text-xs py-1 px-3">Aggiungi Nuovo</Button>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="p-4 font-medium">Nome Azienda</th>
            <th className="p-4 font-medium">Regione</th>
            <th className="p-4 font-medium">Rating</th>
            <th className="p-4 font-medium">Stato</th>
            <th className="p-4 font-medium text-right">Azioni</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {AFFILIATES.map(aff => (
            <tr key={aff.id} className="hover:bg-slate-50">
              <td className="p-4 font-medium text-slate-800">{aff.name}</td>
              <td className="p-4 text-slate-600">{aff.region}</td>
              <td className="p-4 text-amber-500 font-bold">{aff.rating} ★</td>
              <td className="p-4">
                <Badge color={aff.status === 'active' ? 'emerald' : 'amber'}>
                  {aff.status === 'active' ? 'Disponibile' : 'Occupato'}
                </Badge>
              </td>
              <td className="p-4 text-right">
                <button className="text-blue-600 font-medium hover:underline">Gestisci</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default function Index() {
  const [view, setView] = useState<'home' | 'shop' | 'service' | 'admin'>('home');

  const renderView = () => {
    switch(view) {
      case 'shop': return <DroneShop />;
      case 'service': return <ServiceConfigurator onBack={() => setView('home')} />;
      case 'admin': return <ResellerDashboard />;
      default: return (
        <div className="text-center py-12 max-w-3xl mx-auto space-y-8">
          <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-4">
            Il Futuro dell'<span className="text-emerald-600">Agricoltura</span>
          </h1>
          <p className="text-xl text-slate-600">
            Piattaforma integrata per acquisto droni professionali e noleggio servizi di agricoltura di precisione.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
            <div 
              onClick={() => setView('shop')}
              className="group bg-white p-8 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:border-emerald-500 hover:shadow-md transition text-left relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
                <ShoppingBag size={120} />
              </div>
              <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center text-blue-600 mb-4">
                <ShoppingBag size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Acquista Drone</h3>
              <p className="text-slate-500 mb-4">Sfoglia il catalogo DJI Enterprise. Include simulazione ROI e finanziamenti.</p>
              <span className="text-blue-600 font-bold flex items-center gap-1">Vai allo Shop <ChevronRight size={16}/></span>
            </div>

            <div 
              onClick={() => setView('service')}
              className="group bg-white p-8 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:border-emerald-500 hover:shadow-md transition text-left relative overflow-hidden"
            >
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
                <MapIcon size={120} />
              </div>
              <div className="bg-emerald-100 w-12 h-12 rounded-lg flex items-center justify-center text-emerald-600 mb-4">
                <MapIcon size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Richiedi Servizio</h3>
              <p className="text-slate-500 mb-4">Non vuoi comprare? Noleggia un pilota certificato per trattamenti o mappature.</p>
              <span className="text-emerald-600 font-bold flex items-center gap-1">Calcola Preventivo <ChevronRight size={16}/></span>
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 selection:bg-emerald-200">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 font-bold text-xl cursor-pointer"
            onClick={() => setView('home')}
          >
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
              <Plane size={20} />
            </div>
            <span>Agri<span className="text-emerald-600">Tech</span> Solutions</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 font-medium text-sm text-slate-600">
            <button onClick={() => setView('home')} className="hover:text-emerald-600 transition">Home</button>
            <button onClick={() => setView('shop')} className="hover:text-emerald-600 transition">Droni</button>
            <button onClick={() => setView('service')} className="hover:text-emerald-600 transition">Servizi</button>
          </nav>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setView('admin')}
              className="text-xs font-bold uppercase tracking-wide text-slate-400 hover:text-slate-800 border border-slate-200 px-3 py-1 rounded hover:bg-slate-50 transition"
            >
              Area Rivenditore
            </button>
            <Button className="hidden md:flex text-sm py-1.5 px-4">Contattaci</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {renderView()}
      </main>
    </div>
  );
}
