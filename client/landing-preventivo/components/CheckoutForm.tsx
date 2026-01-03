import { useState } from "react";
import {
  ChevronLeft,
  CheckCircle,
  User,
  Phone,
  Mail,
  Building,
  FileText,
  CreditCard,
} from "lucide-react";
import {
  GisData,
  ServiceConfiguration,
  PricingBreakdown,
  AvailableOperator,
  CheckoutData,
} from "../types/preventivo.types";

interface CheckoutFormProps {
  gisData: GisData;
  serviceConfig: ServiceConfiguration;
  pricing: PricingBreakdown;
  selectedOperator: AvailableOperator | null;
  autoSelectOperator: boolean;
  onBack: () => void;
  onSubmit: (checkoutData: CheckoutData) => void;
  isSubmitting?: boolean;
  className?: string;
}

export function CheckoutForm({
  gisData,
  serviceConfig,
  pricing,
  selectedOperator,
  autoSelectOperator,
  onBack,
  onSubmit,
  isSubmitting = false,
  className = "",
}: CheckoutFormProps) {
  const [formData, setFormData] = useState<CheckoutData>({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    companyName: "",
    notes: "",
  });

  const [errors, setErrors] = useState<Partial<CheckoutData>>({});

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(cents / 100);
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<CheckoutData> = {};

    if (!formData.customerName.trim()) {
      newErrors.customerName = "Nome obbligatorio";
    }
    if (!formData.customerEmail.trim()) {
      newErrors.customerEmail = "Email obbligatoria";
    } else if (!/\S+@\S+\.\S+/.test(formData.customerEmail)) {
      newErrors.customerEmail = "Email non valida";
    }
    if (!formData.customerPhone.trim()) {
      newErrors.customerPhone = "Telefono obbligatorio";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleInputChange = (field: keyof CheckoutData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const totalCost = selectedOperator
    ? selectedOperator.total_cost_cents
    : pricing.total * 100;

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
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900">
                  Conferma prenotazione
                </h3>
                <p className="text-sm text-slate-600">
                  Rivedi i dettagli e completa la richiesta
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Service Summary */}
          <div className="bg-slate-50 rounded-lg p-4">
            <h4 className="font-semibold text-slate-900 mb-3">
              Riepilogo Servizio
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-600">Campo:</span>
                <div className="font-semibold text-slate-900">
                  {gisData.area} ha • Pendenza {gisData.slope}%
                </div>
              </div>
              <div>
                <span className="text-slate-600">Coltura:</span>
                <div className="font-semibold text-slate-900">
                  {serviceConfig.category?.name}
                </div>
              </div>
              <div>
                <span className="text-slate-600">Trattamento:</span>
                <div className="font-semibold text-slate-900">
                  {serviceConfig.treatment?.name}
                </div>
              </div>
              <div>
                <span className="text-slate-600">Condizioni:</span>
                <div className="font-semibold text-slate-900">
                  {serviceConfig.isHillyTerrain ? "Collinare" : "Pianeggiante"}
                  {serviceConfig.hasObstacles
                    ? " • Con ostacoli"
                    : " • Senza ostacoli"}
                </div>
              </div>
            </div>
          </div>

          {/* Operator Summary */}
          <div className="bg-slate-50 rounded-lg p-4">
            <h4 className="font-semibold text-slate-900 mb-3">
              Operatore Assegnato
            </h4>
            {autoSelectOperator ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">
                    Selezione automatica
                  </div>
                  <div className="text-sm text-slate-600">
                    Ti assegneremo il miglior operatore disponibile
                  </div>
                </div>
              </div>
            ) : selectedOperator ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-600">
                  {selectedOperator.first_name[0]}
                  {selectedOperator.last_name[0]}
                </div>
                <div>
                  <div className="font-semibold text-slate-900">
                    {selectedOperator.first_name} {selectedOperator.last_name}
                  </div>
                  <div className="text-sm text-slate-600">
                    {selectedOperator.distance_km} km •{" "}
                    {selectedOperator.estimated_days} giorni stimati
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Cost Breakdown */}
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <h4 className="font-semibold text-slate-900 mb-4">
              Dettagli Costi
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">
                  Servizio base ({pricing.basePricePerHa.toFixed(2)}€/ha ×{" "}
                  {gisData.area} ha)
                </span>
                <span className="font-mono text-slate-900">
                  {formatPrice(pricing.serviceBase * 100)}
                </span>
              </div>

              {pricing.slopeMultiplier > 1 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">
                    Adeguamento pendenza ({gisData.slope}%)
                  </span>
                  <span className="font-mono text-slate-900">
                    ×{pricing.slopeMultiplier.toFixed(1)}
                  </span>
                </div>
              )}

              {pricing.terrainMultiplier > 1 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Terreno collinare</span>
                  <span className="font-mono text-slate-900">
                    ×{pricing.terrainMultiplier.toFixed(1)}
                  </span>
                </div>
              )}

              {pricing.obstacleMultiplier > 1 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Presenza ostacoli</span>
                  <span className="font-mono text-slate-900">
                    ×{pricing.obstacleMultiplier.toFixed(1)}
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-slate-600">Logistica e trasporti</span>
                <span className="font-mono text-slate-900">
                  {formatPrice(pricing.logistics * 100)}
                </span>
              </div>

              {selectedOperator && (
                <>
                  <div className="border-t border-slate-200 my-2"></div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      Tariffa operatore ({selectedOperator.estimated_days}{" "}
                      giorni)
                    </span>
                    <span className="font-mono text-slate-900">
                      {formatPrice(
                        selectedOperator.daily_rate_cents *
                          selectedOperator.estimated_days,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Spese trasferta</span>
                    <span className="font-mono text-slate-900">
                      {formatPrice(selectedOperator.travel_cost_cents)}
                    </span>
                  </div>
                </>
              )}

              <div className="border-t border-slate-200 my-2"></div>
              <div className="flex justify-between text-lg font-bold">
                <span className="text-slate-900">TOTALE</span>
                <span className="font-mono text-emerald-600">
                  {formatPrice(totalCost)}
                </span>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <h4 className="font-semibold text-slate-900">Dati di Contatto</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nome e Cognome *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={formData.customerName}
                    onChange={(e) =>
                      handleInputChange("customerName", e.target.value)
                    }
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      errors.customerName
                        ? "border-red-300"
                        : "border-slate-300"
                    }`}
                    placeholder="Mario Rossi"
                  />
                </div>
                {errors.customerName && (
                  <p className="text-red-600 text-xs mt-1">
                    {errors.customerName}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Azienda (opzionale)
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) =>
                      handleInputChange("companyName", e.target.value)
                    }
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Azienda Agricola Rossi S.r.l."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) =>
                      handleInputChange("customerEmail", e.target.value)
                    }
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      errors.customerEmail
                        ? "border-red-300"
                        : "border-slate-300"
                    }`}
                    placeholder="mario@email.com"
                  />
                </div>
                {errors.customerEmail && (
                  <p className="text-red-600 text-xs mt-1">
                    {errors.customerEmail}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Telefono *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    value={formData.customerPhone}
                    onChange={(e) =>
                      handleInputChange("customerPhone", e.target.value)
                    }
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      errors.customerPhone
                        ? "border-red-300"
                        : "border-slate-300"
                    }`}
                    placeholder="+39 333 123 4567"
                  />
                </div>
                {errors.customerPhone && (
                  <p className="text-red-600 text-xs mt-1">
                    {errors.customerPhone}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Note aggiuntive (opzionale)
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  rows={3}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  placeholder="Specifiche particolari, orari preferiti, accessibilità..."
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-slate-200">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-600 text-white py-4 px-6 rounded-lg font-bold text-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center gap-3"
              >
                <CreditCard className="w-5 h-5" />
                {isSubmitting
                  ? "Invio richiesta..."
                  : `Conferma Prenotazione - ${formatPrice(totalCost)}`}
              </button>

              <p className="text-xs text-slate-500 text-center mt-2">
                Riceverai una conferma via email entro 24 ore con tutti i
                dettagli operativi
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
