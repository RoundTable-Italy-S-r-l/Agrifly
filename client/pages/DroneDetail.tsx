import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ShoppingBag,
  Calculator,
  Download,
  BookOpen,
  Image as ImageIcon,
  Settings,
  CheckCircle,
  TrendingUp,
  Droplet,
  Wind,
  Battery,
  Zap,
  ChevronRight,
  X
} from 'lucide-react';
import { fetchDroneById, type Drone } from '@/lib/api';
import { translateSpecKey, translateSection } from '@/lib/specs-translations';
import { Layout } from '@/components/Layout';

const DroneDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'specs' | 'gallery' | 'manuals' | 'faq'>('overview');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  const { data: drone, isLoading, error } = useQuery({
    queryKey: ['drone', id],
    queryFn: () => fetchDroneById(id!),
    enabled: !!id
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Caricamento dettagli drone...</p>
        </div>
      </div>
    );
  }

  if (error || !drone) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Drone non trovato</h1>
          <Link to="/" className="text-emerald-600 hover:underline">Torna al catalogo</Link>
        </div>
      </div>
    );
  }

  const droneAny = drone as any;
  // Gestisci sia array che null/undefined
  const coreSpecs = Array.isArray(droneAny.specs_core_json) ? droneAny.specs_core_json : [];
  const extraSpecs = Array.isArray(droneAny.specs_extra_json) ? droneAny.specs_extra_json : [];
  const images = Array.isArray(droneAny.images) ? droneAny.images : [];
  const manuals = Array.isArray(droneAny.manuals_pdf_json) ? droneAny.manuals_pdf_json : [];

  // Raggruppa specs per sezione
  const groupSpecsBySection = (specs: any[]) => {
    const grouped: { [key: string]: any[] } = {};
    specs.forEach(spec => {
      const section = spec.section || 'other';
      if (!grouped[section]) {
        grouped[section] = [];
      }
      grouped[section].push(spec);
    });
    return grouped;
  };

  const coreSpecsGrouped = groupSpecsBySection(coreSpecs);
  const extraSpecsGrouped = groupSpecsBySection(extraSpecs);

  // Ordine preferenziale delle sezioni per visualizzazione
  const sectionOrder = [
    'aircraft',
    'spray_system',
    'spreading_system',
    'battery',
    'charger',
    'generator',
    'radar',
    'propulsion',
    'vision',
    'controller',
    'gps',
    'camera',
    'sensors',
    'safety',
    'performance',
    'dimensions',
    'power',
    'communication'
  ];

  const getOrderedSections = (grouped: { [key: string]: any[] }) => {
    const ordered: string[] = [];
    const other: string[] = [];
    
    sectionOrder.forEach(section => {
      if (grouped[section]) {
        ordered.push(section);
      }
    });
    
    Object.keys(grouped).forEach(section => {
      if (!sectionOrder.includes(section)) {
        other.push(section);
      }
    });
    
    return [...ordered, ...other];
  };

  return (
    <Layout>
        {/* Breadcrumb */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/catalogo')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-2"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Torna al catalogo</span>
          </button>
          <h1 className="text-2xl font-bold text-slate-900">{drone.model}</h1>
        </div>
        {/* Hero Section con GLB 3D */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* GLB Viewer - Lato sinistro */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden sticky top-24 h-[600px]">
            {droneAny.glbUrl ? (
              <div className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100">
                {/* @ts-ignore */}
                <model-viewer
                  src={droneAny.glbUrl}
                  alt={`Modello 3D ${drone.model}`}
                  auto-rotate
                  camera-controls
                  interaction-policy="allow-when-focused"
                  style={{ width: '100%', height: '100%' }}
                  className="object-contain"
                  loading="eager"
                />
              </div>
            ) : drone.imageUrl ? (
              <img
                src={drone.imageUrl}
                alt={drone.model}
                className="w-full h-full object-contain p-8"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center text-slate-400">
                  <Settings size={64} className="mx-auto mb-4" />
                  <p>Immagine non disponibile</p>
                </div>
              </div>
            )}
          </div>

          {/* Info e CTA - Lato destro */}
          <div className="space-y-6">
            {/* Badge e categoria */}
            <div>
              <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full mb-3">
                {drone.category}
              </span>
              <h2 className="text-4xl font-bold text-slate-900 mb-2">{drone.model}</h2>
              <p className="text-lg text-slate-600">{drone.tagline}</p>
            </div>

            {/* Prezzo */}
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-6 border border-emerald-200">
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-4xl font-bold text-slate-900">
                  € {typeof drone.price === 'number' ? drone.price.toLocaleString('it-IT') : 'N/D'}
                </span>
              </div>
              <p className="text-sm text-slate-600">IVA esclusa • Kit completo</p>
            </div>

            {/* Core Specs Quick View */}
            {coreSpecs.length > 0 && (
              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Settings size={18} />
                  Specifiche Principali
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {coreSpecs.slice(0, 6).map((spec: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                        {spec.section === 'spray_system' && <Droplet size={16} className="text-emerald-600" />}
                        {spec.section === 'battery' && <Battery size={16} className="text-emerald-600" />}
                        {spec.section === 'aircraft' && <Wind size={16} className="text-emerald-600" />}
                        {!['spray_system', 'battery', 'aircraft'].includes(spec.section) && <Zap size={16} className="text-emerald-600" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-slate-500">{translateSpecKey(spec.key)}</p>
                        <p className="text-sm font-bold text-slate-900">
                          {spec.value} {spec.unit}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA Buttons */}
            <div className="space-y-3">
              <button 
                onClick={() => {
                  // TODO: Implementare preventivo
                  alert('Funzionalità preventivo in arrivo!');
                }}
                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <ShoppingBag size={20} />
                Richiedi Preventivo
              </button>
              <button 
                onClick={() => {
                  // Naviga al catalogo con ROI calculator aperto
                  navigate('/?view=shop&roi=' + drone.id);
                }}
                className="w-full border-2 border-emerald-600 text-emerald-600 py-4 rounded-xl font-bold text-lg hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
              >
                <Calculator size={20} />
                Calcola ROI
              </button>
            </div>

            {/* Disponibilità */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
              <CheckCircle size={20} className="text-emerald-600" />
              <div>
                  <p className="font-semibold text-slate-900">
                    {droneAny.stock > 0 ? 'Disponibile' : 'Non disponibile'}
                  </p>
                  <p className="text-sm text-slate-600">
                    {droneAny.stock > 0 
                      ? `${droneAny.stock} unità disponibili`
                      : 'Temporaneamente esaurito'
                    }
                  </p>
                </div>
              </div>
              {droneAny.skus && droneAny.skus.length > 0 && (
                <div className="pt-2 border-t border-slate-200">
                  <p className="text-xs font-semibold text-slate-700 mb-2">Disponibilità per SKU:</p>
                  <div className="space-y-1">
                    {droneAny.skus.map((sku: any) => (
                      <div key={sku.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">{sku.skuCode}</span>
                        <span className={`font-medium ${
                          sku.stock > 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {sku.stock} unità
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-slate-500 pt-2 border-t border-slate-200">
                Tempi di consegna: 7-10 giorni lavorativi
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
          <div className="flex border-b border-slate-200">
            {[
              { id: 'overview', label: 'Panoramica', icon: Settings },
              { id: 'specs', label: 'Specifiche', icon: BookOpen },
              { id: 'gallery', label: 'Gallery', icon: ImageIcon },
              { id: 'manuals', label: 'Manuali', icon: Download },
              { id: 'faq', label: 'FAQ', icon: CheckCircle }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 px-6 py-4 font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
                  activeTab === tab.id
                    ? 'text-emerald-600 border-b-2 border-emerald-600'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-8">
            {activeTab === 'overview' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-4">Descrizione</h3>
                  <p className="text-slate-700 leading-relaxed">{drone.targetUse || drone.tagline}</p>
                </div>

                {/* Core Specs Grid - Raggruppate per sezione */}
                {coreSpecs.length > 0 && (
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-6">Specifiche Principali</h3>
                    <div className="space-y-6">
                      {getOrderedSections(coreSpecsGrouped).map(section => (
                        <div key={section} className="bg-white rounded-lg border border-slate-200 p-6">
                          <h4 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <span className="w-1 h-6 bg-emerald-600 rounded"></span>
                            {translateSection(section)}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {coreSpecsGrouped[section].map((spec: any, idx: number) => (
                              <div key={idx} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">
                                  {translateSpecKey(spec.key)}
                                </p>
                                <p className="text-lg font-bold text-slate-900">
                                  {spec.value} {spec.unit}
                                </p>
                                {spec.source_text && (
                                  <p className="text-xs text-slate-400 mt-1">{spec.source_text}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Features */}
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-4">Caratteristiche</h3>
                  <div className="bg-emerald-50 rounded-lg p-6 border border-emerald-200">
                    <p className="text-slate-800 font-medium">{drone.features}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'specs' && (
              <div className="space-y-8">
                {/* Core Specs - Raggruppate per sezione */}
                {coreSpecs.length > 0 && (
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-6">Specifiche Core</h3>
                    <div className="space-y-8">
                      {getOrderedSections(coreSpecsGrouped).map(section => (
                        <div key={section} className="bg-white rounded-lg border border-slate-200 p-6">
                          <h4 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <span className="w-1 h-6 bg-emerald-600 rounded"></span>
                            {translateSection(section)}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {coreSpecsGrouped[section].map((spec: any, idx: number) => (
                              <div key={idx} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                <p className="text-sm font-semibold text-slate-900 mb-1">
                                  {translateSpecKey(spec.key)}
                                </p>
                                <p className="text-2xl font-bold text-slate-900 mb-1">
                                  {spec.value} <span className="text-sm text-slate-500">{spec.unit}</span>
                                </p>
                                {spec.source_text && (
                                  <p className="text-xs text-slate-500 mt-2">{spec.source_text}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extra Specs - Raggruppate per sezione */}
                {extraSpecs.length > 0 && (
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-6">Specifiche Dettagliate</h3>
                    <div className="space-y-8 max-h-[800px] overflow-y-auto">
                      {getOrderedSections(extraSpecsGrouped).map(section => (
                        <div key={section} className="bg-white rounded-lg border border-slate-200 p-6">
                          <h4 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <span className="w-1 h-6 bg-slate-400 rounded"></span>
                            {translateSection(section)}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {extraSpecsGrouped[section].map((spec: any, idx: number) => (
                              <div key={idx} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                <p className="text-sm font-semibold text-slate-900 mb-1">
                                  {translateSpecKey(spec.key)}
                                </p>
                                <p className="text-lg text-slate-700">
                                  {spec.value} {spec.unit}
                                </p>
                                {spec.source_text && (
                                  <p className="text-xs text-slate-400 mt-1">{spec.source_text}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'gallery' && (
              <div>
                {images.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {images.map((img: any, idx: number) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedImageIndex(idx)}
                        className="aspect-square bg-slate-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        <img
                          src={img.url}
                          alt={img.alt || drone.model}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <ImageIcon size={48} className="mx-auto mb-4 text-slate-300" />
                    <p>Nessuna immagine disponibile</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'manuals' && (
              <div>
                {manuals.length > 0 ? (
                  <div className="space-y-3">
                    {manuals.map((manual: any, idx: number) => (
                      <a
                        key={idx}
                        href={manual.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <Download size={20} className="text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{manual.filename || `Manuale ${idx + 1}`}</p>
                            <p className="text-xs text-slate-500">{manual.type || 'PDF'}</p>
                          </div>
                        </div>
                        <ChevronRight size={20} className="text-slate-400 group-hover:text-slate-600" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <BookOpen size={48} className="mx-auto mb-4 text-slate-300" />
                    <p>Nessun manuale disponibile</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'faq' && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Domande Frequenti</h2>
                  <p className="text-slate-600">Risposte alle domande più comuni sui nostri droni agricoli</p>
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                    <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <CheckCircle size={20} className="text-emerald-600" />
                      Quanto dura la batteria in volo?
                    </h3>
                    <p className="text-slate-700 leading-relaxed">
                      La durata della batteria dipende dal modello e dal carico di lavoro. In condizioni ottimali,
                      i nostri droni possono volare da 10 a 25 minuti. La batteria agli ioni di litio ad alta densità
                      garantisce prestazioni costanti durante tutto il volo.
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                    <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <CheckCircle size={20} className="text-emerald-600" />
                      Qual è l'area massima che posso coprire?
                    </h3>
                    <p className="text-slate-700 leading-relaxed">
                      L'area di copertura dipende dal modello e dalla configurazione. I nostri droni possono coprire
                      da 10 a 50 ettari per ora, con una larghezza di lavoro che va da 3 a 13 metri.
                      L'efficienza può raggiungere fino a 40 ettari/ora con i modelli più avanzati.
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                    <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <CheckCircle size={20} className="text-emerald-600" />
                      È difficile da pilotare?
                    </h3>
                    <p className="text-slate-700 leading-relaxed">
                      Assolutamente no! I nostri droni sono dotati di sistemi di pilotaggio automatico avanzati.
                      Con l'app dedicata, puoi pianificare missioni precise, impostare percorsi automatici e
                      monitorare il volo in tempo reale. Anche gli operatori alle prime armi possono utilizzarli
                      dopo un breve training.
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                    <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <CheckCircle size={20} className="text-emerald-600" />
                      Cosa succede se perdo il segnale?
                    </h3>
                    <p className="text-slate-700 leading-relaxed">
                      I nostri droni sono equipaggiati con sistemi di sicurezza avanzati. In caso di perdita di segnale,
                      il drone attiva automaticamente la modalità RTH (Return to Home) e torna al punto di partenza.
                      Inoltre, i sistemi radar e di visione artificiale garantiscono un volo sicuro anche in condizioni
                      di scarsa visibilità.
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                    <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <CheckCircle size={20} className="text-emerald-600" />
                      Quanto costa la manutenzione?
                    </h3>
                    <p className="text-slate-700 leading-relaxed">
                      I nostri droni richiedono una manutenzione minima. I componenti principali hanno una durata
                      elevata e sono progettati per resistere alle condizioni agricole più difficili.
                      Offriamo contratti di manutenzione preventiva e supporto tecnico dedicato.
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                    <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <CheckCircle size={20} className="text-emerald-600" />
                      È sicuro per l'ambiente?
                    </h3>
                    <p className="text-slate-700 leading-relaxed">
                      Sì! I nostri droni utilizzano tecnologie di precisione che riducono significativamente l'uso
                      di prodotti chimici. La distribuzione mirata permette di applicare solo dove necessario,
                      proteggendo l'ambiente e riducendo i costi operativi fino al 30%.
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                    <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <CheckCircle size={20} className="text-emerald-600" />
                      Posso personalizzare le configurazioni?
                    </h3>
                    <p className="text-slate-700 leading-relaxed">
                      Certamente! Offriamo diverse configurazioni per adattarci alle tue esigenze specifiche.
                      Puoi scegliere tra serbatoi di diverse capacità, sistemi di distribuzione multipli,
                      e accessori speciali per diversi tipi di colture e terreni.
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                    <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <CheckCircle size={20} className="text-emerald-600" />
                      Qual è il ROI (ritorno sull'investimento)?
                    </h3>
                    <p className="text-slate-700 leading-relaxed">
                      Il ritorno sull'investimento varia dai 6 ai 24 mesi, a seconda del modello e dell'utilizzo.
                      I nostri clienti tipicamente risparmiano sui costi di manodopera, riducono l'uso di prodotti
                      chimici e aumentano la produttività. Molti clienti raggiungono il break-even entro il primo anno.
                    </p>
                  </div>
                </div>

                <div className="bg-emerald-50 rounded-lg p-6 border border-emerald-200 mt-8">
                  <h3 className="font-semibold text-emerald-900 mb-2">Hai altre domande?</h3>
                  <p className="text-emerald-800 mb-4">
                    Il nostro team di esperti è a tua disposizione per rispondere a qualsiasi domanda
                    sui nostri droni agricoli e aiutarti a scegliere la soluzione migliore per le tue esigenze.
                  </p>
                  <button className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors font-medium">
                    Contattaci
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      {/* Image Modal */}
      {selectedImageIndex !== null && images[selectedImageIndex] && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImageIndex(null)}
        >
          <button
            onClick={() => setSelectedImageIndex(null)}
            className="absolute top-4 right-4 text-white hover:text-slate-300"
          >
            <X size={32} />
          </button>
          <img
            src={images[selectedImageIndex].url}
            alt={images[selectedImageIndex].alt || drone.model}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </Layout>
  );
};

export default DroneDetail;

