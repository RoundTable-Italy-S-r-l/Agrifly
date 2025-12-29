import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Settings, Calculator, Droplet, Package, Map as MapIcon, CheckCircle } from 'lucide-react';
import { fetchGisCategories, fetchTreatments, fetchDrones } from '@/lib/api';
import { GisCategory, Treatment, Drone, ServiceConfiguration, PricingBreakdown, GisData } from '../types/preventivo.types';

interface ServiceConfiguratorProps {
  gisData: GisData;
  serviceConfig: ServiceConfiguration;
  pricing: PricingBreakdown | null;
  isLoadingPricing: boolean;
  onUpdateConfig: (updates: Partial<ServiceConfiguration>) => void;
  onCalculatePricing: () => void;
  onBack: () => void;
  onProceed: () => void;
  className?: string;
}

export function ServiceConfigurator({
  gisData,
  serviceConfig,
  pricing,
  isLoadingPricing,
  onUpdateConfig,
  onCalculatePricing,
  onBack,
  onProceed,
  className = ''
}: ServiceConfiguratorProps) {
  // Fetch data
  const { data: categories = [], isLoading: categoriesLoading, error: categoriesError } = useQuery({
    queryKey: ['gisCategories'],
    queryFn: fetchGisCategories
  });

  const { data: allTreatments = [], isLoading: treatmentsLoading, error: treatmentsError } = useQuery({
    queryKey: ['treatments'],
    queryFn: fetchTreatments
  });

  const { data: availableDrones = [], isLoading: dronesLoading } = useQuery({
    queryKey: ['drones'],
    queryFn: fetchDrones
  });

  // Filter treatments by selected category
  const availableTreatments = serviceConfig.category && Array.isArray(allTreatments)
    ? allTreatments.filter(t => t.categoryId === serviceConfig.category!.id)
    : [];

  const canProceed = serviceConfig.category && serviceConfig.treatment && serviceConfig.selectedDrone;

  const handleCategorySelect = (category: GisCategory) => {
    onUpdateConfig({
      category,
      treatment: null, // Reset treatment when category changes
      selectedDrone: null // Reset drone when category changes
    });
  };

  const handleTreatmentSelect = (treatment: Treatment) => {
    onUpdateConfig({ treatment });
    // Auto-calculate pricing when treatment is selected
    setTimeout(onCalculatePricing, 100);
  };

  const handleDroneSelect = (drone: Drone) => {
    onUpdateConfig({ selectedDrone: drone });
  };

  const handleTerrainToggle = (field: 'isHillyTerrain' | 'hasObstacles') => {
    const newConfig = { ...serviceConfig, [field]: !serviceConfig[field] };
    onUpdateConfig(newConfig);
    // Auto-recalculate if we have a treatment
    if (serviceConfig.treatment) {
      setTimeout(onCalculatePricing, 100);
    }
  };

  return (
    <div className={`max-w-4xl mx-auto ${className}`}>
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="bg-slate-100 px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-lg">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="p-2 bg-emerald-50 rounded-lg">
                <Settings className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900">Configura il servizio</h3>
                <p className="text-sm text-slate-600">Scegli coltura, trattamento e condizioni del campo</p>
              </div>
            </div>
          </div>
        </div>

        {/* GIS Data Summary */}
        <div className="px-6 py-4 bg-emerald-50 border-b border-slate-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-emerald-700">Campo selezionato:</span>
            <span className="font-semibold text-emerald-800">
              {gisData.area} ha • Pendenza {gisData.slope}%
            </span>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Step 1: Category Selection */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-sm font-bold text-emerald-700">
                1
              </div>
              <h4 className="font-bold text-slate-900">Seleziona la coltura</h4>
            </div>

            {categoriesLoading ? (
              <div className="text-center py-8 text-slate-500">Caricamento categorie...</div>
            ) : categoriesError || !Array.isArray(categories) ? (
              <div className="text-center py-8 text-red-500">
                Errore nel caricamento delle categorie: {categoriesError?.message || 'Dati non validi'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {categories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => handleCategorySelect(category)}
                    className={`p-4 rounded-xl border-2 transition-all hover:shadow-lg ${
                      serviceConfig.category?.id === category.id
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

          {/* Step 2: Treatment Selection */}
          {serviceConfig.category && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-sm font-bold text-emerald-700">
                  2
                </div>
                <h4 className="font-bold text-slate-900">Tipo di intervento</h4>
              </div>

              {treatmentsLoading ? (
                <div className="text-center py-4 text-slate-500">Caricamento trattamenti...</div>
              ) : (
                <div className="space-y-3">
                  {availableTreatments.map(treatment => (
                    <label
                      key={treatment.id}
                      className={`flex items-center gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        serviceConfig.treatment?.id === treatment.id
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="treatment"
                        value={treatment.id}
                        checked={serviceConfig.treatment?.id === treatment.id}
                        onChange={() => handleTreatmentSelect(treatment)}
                        className="sr-only"
                      />

                      <div className={`p-2 rounded-lg ${
                        treatment.type === 'liquid' ? 'bg-blue-50' : 'bg-purple-50'
                      }`}>
                        {treatment.type === 'liquid' ? (
                          <Droplet className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Package className="w-5 h-5 text-purple-600" />
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="font-semibold text-slate-900">{treatment.name}</div>
                        <div className="text-sm text-slate-600 mt-1">
                          {treatment.type === 'liquid' ? ' 💧 Liquido' : ' 📦 Solido'} •
                          ~{treatment.operatingSpeed} ha/h
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{treatment.dosage}</div>
                      </div>

                      {serviceConfig.treatment?.id === treatment.id && (
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      )}
                    </label>
                  ))}

                  {availableTreatments.length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                      Nessun trattamento disponibile per questa coltura
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Drone Selection */}
          {serviceConfig.treatment && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-sm font-bold text-emerald-700">
                  3
                </div>
                <h4 className="font-bold text-slate-900">Seleziona il drone</h4>
              </div>

              {dronesLoading ? (
                <div className="text-center py-4 text-slate-500">Caricamento droni...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableDrones.map(drone => (
                    <label
                      key={drone.id}
                      className={`flex items-center gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        serviceConfig.selectedDrone?.id === drone.id
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="drone"
                        value={drone.id}
                        checked={serviceConfig.selectedDrone?.id === drone.id}
                        onChange={() => handleDroneSelect(drone)}
                        className="sr-only"
                      />

                      <div className="flex-1">
                        <div className="font-semibold text-slate-900">{drone.name}</div>
                        <div className="text-sm text-slate-600 mt-1">{drone.model}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          Carico max: {drone.maxPayload}kg • Autonomia: {drone.maxFlightTime}min
                        </div>
                        <div className="text-xs text-slate-500">
                          Larghezza spruzzo: {drone.sprayingWidth}m
                        </div>
                      </div>

                      {serviceConfig.selectedDrone?.id === drone.id && (
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      )}
                    </label>
                  ))}

                  {availableDrones.length === 0 && (
                    <div className="text-center py-8 text-slate-500 col-span-full">
                      Nessun drone disponibile
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Terrain Conditions */}
          {serviceConfig.selectedDrone && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-sm font-bold text-emerald-700">
                  4
                </div>
                <h4 className="font-bold text-slate-900">Condizioni del campo</h4>
              </div>

              <div className="space-y-4">
                {/* Hilly Terrain */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⛰️</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Terreno collinare / pendente</p>
                      <p className="text-xs text-slate-500">Aumenta la complessità dell'intervento</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleTerrainToggle('isHillyTerrain')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      serviceConfig.isHillyTerrain ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        serviceConfig.isHillyTerrain ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Obstacles */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🌳</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Presenza ostacoli (alberi/pali)</p>
                      <p className="text-xs text-slate-500">Richiede maggiore precisione</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleTerrainToggle('hasObstacles')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      serviceConfig.hasObstacles ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        serviceConfig.hasObstacles ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pricing Preview */}
      {serviceConfig.treatment && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-100 px-6 py-3 border-b border-slate-200">
            <h3 className="font-bold text-sm uppercase tracking-wide text-slate-700 flex items-center gap-2">
              <Calculator className="text-emerald-600" size={18} />
              Anteprima Preventivo
            </h3>
          </div>

          {isLoadingPricing ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-2"></div>
              <p className="text-sm text-slate-600">Calcolo preventivo in corso...</p>
            </div>
          ) : pricing ? (
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase">Prezzo Base Trattamento</p>
                  <p className="text-sm text-slate-600 mt-1">
                    {serviceConfig.treatment.name} • {gisData.area} ha
                  </p>
                </div>
                <p className="text-2xl font-bold font-mono text-emerald-600">
                  €{pricing.basePricePerHa.toFixed(2)}/ha
                </p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Stima Totale Servizio</p>
                    <p className="text-xs text-emerald-600 mt-1">
                      Include trasporti e adeguamenti per condizioni del campo
                    </p>
                  </div>
                  <p className="text-3xl font-bold font-mono text-emerald-700">
                    €{pricing.total.toFixed(2)}
                  </p>
                </div>
              </div>

              <button
                onClick={onProceed}
                className="w-full mt-4 bg-emerald-600 text-white py-3 rounded-lg font-bold uppercase tracking-wide text-sm hover:bg-emerald-700 transition-all shadow-md flex items-center justify-center gap-2"
              >
                <CheckCircle size={16} />
                Procedi alla Selezione Operatore
              </button>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-500">
              <p>Seleziona le condizioni del campo per vedere il preventivo</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
