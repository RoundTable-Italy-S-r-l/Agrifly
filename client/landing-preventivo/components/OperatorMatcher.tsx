import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  Users,
  MapPin,
  Clock,
  Star,
  CheckCircle,
  Sparkles,
} from "lucide-react";
import { fetchOperators } from "@/lib/api";
import {
  AvailableOperator,
  GisData,
  PricingBreakdown,
  ServiceConfiguration,
} from "../types/preventivo.types";

interface OperatorMatcherProps {
  gisData: GisData;
  serviceConfig: ServiceConfiguration;
  pricing: PricingBreakdown;
  selectedOperator: AvailableOperator | null;
  autoSelectOperator: boolean;
  onSelectOperator: (
    operator: AvailableOperator | null,
    autoSelect: boolean,
  ) => void;
  onBack: () => void;
  onProceed: () => void;
  className?: string;
}

// Mock function to simulate operator availability calculation
// In production, this would call an API endpoint
function calculateOperatorAvailability(
  operators: any[],
  gisData: GisData,
  serviceConfig: ServiceConfiguration,
  pricing: PricingBreakdown,
): AvailableOperator[] {
  return operators
    .filter(
      (op) =>
        op.status === "ACTIVE" &&
        op.service_tags.includes(
          serviceConfig.treatment?.type === "solid" ? "SPREAD" : "SPRAY",
        ),
    )
    .slice(0, 3) // Limit to 3 for demo
    .map((op, index) => {
      const distance = 5 + Math.random() * 45; // 5-50 km
      const dailyRate = 300 + Math.random() * 200; // €300-500/day
      const travelCost = distance * 1.2; // €1.20/km
      const daysNeeded = Math.ceil(
        parseFloat(gisData.area) / (op.max_ha_per_day || 20),
      );
      const totalCost = dailyRate * daysNeeded + travelCost + pricing.total;

      return {
        id: op.id,
        first_name: op.first_name,
        last_name: op.last_name,
        email: op.email,
        distance_km: Math.round(distance),
        daily_rate_cents: Math.round(dailyRate * 100),
        travel_cost_cents: Math.round(travelCost * 100),
        total_cost_cents: Math.round(totalCost * 100),
        availability_score: 95 - index * 10, // Best match first
        estimated_days: daysNeeded,
        service_tags: op.service_tags,
        rating: 4.5 + Math.random() * 0.5, // 4.5-5.0 stars
        review_count: Math.floor(Math.random() * 50) + 10,
      };
    })
    .sort((a, b) => a.total_cost_cents - b.total_cost_cents); // Sort by total cost
}

export function OperatorMatcher({
  gisData,
  serviceConfig,
  pricing,
  selectedOperator,
  autoSelectOperator,
  onSelectOperator,
  onBack,
  onProceed,
  className = "",
}: OperatorMatcherProps) {
  const [availableOperators, setAvailableOperators] = useState<
    AvailableOperator[]
  >([]);

  // Fetch operators
  const { data: operators = [], isLoading } = useQuery({
    queryKey: ["operators"],
    queryFn: () => fetchOperators("org_default"), // Use default org for demo
    enabled: true,
  });

  // Calculate available operators when data changes
  useEffect(() => {
    if (operators.length > 0 && serviceConfig.treatment) {
      const available = calculateOperatorAvailability(
        operators,
        gisData,
        serviceConfig,
        pricing,
      );
      setAvailableOperators(available);

      // Auto-select best match if no manual selection
      if (!selectedOperator && !autoSelectOperator && available.length > 0) {
        onSelectOperator(available[0], false);
      }
    }
  }, [
    operators,
    gisData,
    serviceConfig,
    pricing,
    selectedOperator,
    autoSelectOperator,
    onSelectOperator,
  ]);

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(cents / 100);
  };

  const getAvailabilityColor = (score: number) => {
    if (score >= 90) return "text-green-600 bg-green-50";
    if (score >= 70) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  return (
    <div className={`max-w-4xl mx-auto ${className}`}>
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="bg-slate-100 px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 hover:bg-slate-200 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="p-2 bg-emerald-50 rounded-lg">
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900">
                  Scegli il tuo operatore
                </h3>
                <p className="text-sm text-slate-600">
                  Operatori qualificati disponibili nella tua zona
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Service Summary */}
        <div className="px-6 py-4 bg-emerald-50 border-b border-slate-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-emerald-700">Servizio richiesto:</span>
            <span className="font-semibold text-emerald-800">
              {serviceConfig.treatment?.name} • {gisData.area} ha
            </span>
          </div>
        </div>

        <div className="p-6">
          {/* Auto-select option */}
          <div className="mb-6">
            <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-emerald-300">
              <input
                type="radio"
                name="operator_selection"
                checked={autoSelectOperator}
                onChange={() => onSelectOperator(null, true)}
                className="sr-only"
              />
              <div
                className={`p-2 rounded-lg ${autoSelectOperator ? "bg-emerald-50" : "bg-slate-50"}`}
              >
                <Sparkles
                  className={`w-5 h-5 ${autoSelectOperator ? "text-emerald-600" : "text-slate-600"}`}
                />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-slate-900">
                  Troviamo noi il miglior operatore per te
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  Selezioniamo automaticamente l'operatore più adatto basandoci
                  su disponibilità, distanza e recensioni
                </div>
              </div>
              {autoSelectOperator && (
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              )}
            </label>
          </div>

          {/* Manual selection */}
          <div className="mb-4">
            <label className="flex items-center gap-3 mb-4">
              <input
                type="radio"
                name="operator_selection"
                checked={!autoSelectOperator}
                onChange={() => onSelectOperator(null, false)}
                className="sr-only"
              />
              <span
                className={`font-semibold ${!autoSelectOperator ? "text-emerald-700" : "text-slate-600"}`}
              >
                Oppure scegli manualmente
              </span>
            </label>
          </div>

          {/* Available Operators */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-2"></div>
              <p className="text-sm text-slate-600">
                Ricerca operatori disponibili...
              </p>
            </div>
          ) : availableOperators.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <p>Nessun operatore disponibile al momento</p>
              <p className="text-sm mt-1">
                Riprova più tardi o contattaci direttamente
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {availableOperators.map((operator, index) => (
                <div
                  key={operator.id}
                  className={`border-2 rounded-lg p-4 transition-all cursor-pointer ${
                    selectedOperator?.id === operator.id
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-slate-200 hover:border-emerald-300"
                  } ${index === 0 ? "ring-2 ring-emerald-200" : ""}`}
                  onClick={() => onSelectOperator(operator, false)}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-600">
                        {operator.first_name[0]}
                        {operator.last_name[0]}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">
                          {operator.first_name} {operator.last_name}
                          {index === 0 && (
                            <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                              MIGLIOR MATCH
                            </span>
                          )}
                        </h4>
                        <div className="flex items-center gap-4 text-sm text-slate-600 mt-1">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {operator.distance_km} km
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            {operator.rating?.toFixed(1)} (
                            {operator.review_count} recensioni)
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getAvailabilityColor(operator.availability_score)}`}
                      >
                        <Clock className="w-3 h-3" />
                        {operator.availability_score}% disponibile
                      </div>
                    </div>
                  </div>

                  {/* Service Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-500 uppercase">
                        Tariffa Giornaliera
                      </div>
                      <div className="font-bold text-slate-900">
                        {formatPrice(operator.daily_rate_cents)}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-500 uppercase">
                        Spese Trasferta
                      </div>
                      <div className="font-bold text-slate-900">
                        {formatPrice(operator.travel_cost_cents)}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-500 uppercase">
                        Giorni Stimati
                      </div>
                      <div className="font-bold text-slate-900">
                        {operator.estimated_days} giorni
                      </div>
                    </div>
                  </div>

                  {/* Total Cost */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                    <div className="text-sm text-slate-600">
                      Costo totale servizio completo
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold font-mono text-slate-900">
                        {formatPrice(operator.total_cost_cents)}
                      </div>
                      <div className="text-xs text-slate-500">
                        Include tutti i costi
                      </div>
                    </div>
                  </div>

                  {/* Selection Indicator */}
                  {selectedOperator?.id === operator.id && (
                    <div className="mt-3 flex items-center gap-2 text-emerald-700">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        Operatore selezionato
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Action Button */}
          {(selectedOperator || autoSelectOperator) && (
            <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-emerald-800">
                    Pronto per procedere
                  </h4>
                  <p className="text-sm text-emerald-600 mt-1">
                    {autoSelectOperator
                      ? "Ti assegneremo il miglior operatore disponibile"
                      : `Hai selezionato ${selectedOperator?.first_name} ${selectedOperator?.last_name}`}
                  </p>
                </div>
                <button
                  onClick={onProceed}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-all shadow-md flex items-center gap-2"
                >
                  <CheckCircle size={16} />
                  Conferma e Procedi
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
