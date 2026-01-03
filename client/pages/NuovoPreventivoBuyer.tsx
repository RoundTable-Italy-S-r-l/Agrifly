import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BuyerLayout } from "@/components/BuyerLayout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { GisMapSelector } from "../landing-preventivo/components/GisMapSelector";
import { fetchCertifiedQuotes, CertifiedQuote } from "@/lib/api";
import { CheckCircle } from "lucide-react";
import { VoiceAssistantPanel } from "@/components/VoiceAssistantPanel";

interface JobFormData {
  field_name: string;
  service_type: string;
  crop_type?: string;
  treatment_type?: string;
  terrain_conditions?: string;
  field_polygon: any;
  area_ha: number;
  location_json?: any;
  requested_window_start?: string;
  requested_window_end?: string;
  constraints_json?: any;
}

const SERVICE_TYPES = [
  { value: "IRRORAZIONE", label: "Irrorazione", icon: "🌿" },
  { value: "SPANDIMENTO", label: "Spandimento", icon: "🌱" },
  { value: "RILIEVO_AEREO", label: "Rilievo aereo", icon: "🗺️" },
  { value: "SOLLEVAMENTO", label: "Sollevamento", icon: "🚁" },
];

const CROP_TYPES = [
  { value: "VINEYARD", label: "Vigneto" },
  { value: "OLIVE_GROVE", label: "Oliveto" },
  { value: "CEREAL", label: "Cereali" },
  { value: "VEGETABLES", label: "Ortaggi" },
  { value: "FRUIT", label: "Frutteto" },
  { value: "OTHER", label: "Altro" },
];

const TREATMENT_TYPES = {
  IRRORAZIONE: [
    { value: "FUNGICIDE", label: "Trattamento fungicida" },
    { value: "INSECTICIDE", label: "Trattamento insetticida" },
    { value: "HERBICIDE", label: "Trattamento erbicida" },
    { value: "FERTILIZER", label: "Concimazione fogliare" },
  ],
  SPANDIMENTO: [
    { value: "ORGANIC_FERTILIZER", label: "Concime organico" },
    { value: "CHEMICAL_FERTILIZER", label: "Concime chimico" },
    { value: "LIME", label: "Spandimento calce" },
    { value: "OTHER", label: "Altro" },
  ],
  RILIEVO_AEREO: [
    { value: "NDVI", label: "Mappatura NDVI" },
    { value: "THERMAL", label: "Termografia" },
    { value: "MULTISPECTRAL", label: "Multispettrale" },
    { value: "ORTHOPHOTO", label: "Ortofoto" },
  ],
};

const TERRAIN_CONDITIONS = [
  { value: "FLAT", label: "Terreno pianeggiante", icon: "🏞️" },
  { value: "HILLY", label: "Terreno collinare", icon: "🏔️" },
  { value: "MOUNTAINOUS", label: "Terreno montuoso", icon: "⛰️" },
];

export default function NuovoPreventivoBuyer() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [gisData, setGisData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [certifiedQuotes, setCertifiedQuotes] = useState<CertifiedQuote[]>([]);
  const [loadingCertifiedQuotes, setLoadingCertifiedQuotes] = useState(false);

  const [jobData, setJobData] = useState<Partial<JobFormData>>({
    service_type: "IRRORAZIONE",
  });

  // Check for pending field data from preventivo flow
  useEffect(() => {
    console.log(
      "🔍 NuovoPreventivoBuyer loaded, checking for pending field data...",
    );

    const pendingFieldData = localStorage.getItem("pending_field_data");
    const tempFieldData = localStorage.getItem("temp_field_data");

    console.log("📊 localStorage status:", {
      pendingFieldData: !!pendingFieldData,
      tempFieldData: !!tempFieldData,
    });

    if (pendingFieldData) {
      try {
        const fieldData = JSON.parse(pendingFieldData);
        console.log("📋 Loading pending field data:", fieldData);

        setJobData((prev) => ({
          ...prev,
          field_name: fieldData.field_name || prev.field_name,
          service_type: fieldData.service_type || prev.service_type,
          crop_type: fieldData.crop_type || prev.crop_type,
          treatment_type: fieldData.treatment_type || prev.treatment_type,
          terrain_conditions:
            fieldData.terrain_conditions || prev.terrain_conditions,
          field_polygon: fieldData.field_polygon || prev.field_polygon,
          area_ha: fieldData.area_ha || prev.area_ha,
          location_json: fieldData.location_json || prev.location_json,
        }));

        // Set GIS data for map display
        if (fieldData.field_polygon && fieldData.area_ha) {
          setGisData({
            polygon: fieldData.field_polygon,
            area_ha: fieldData.area_ha,
            location: fieldData.location_json,
          });
          setCurrentStep(2); // Skip to service configuration
        }

        // Clean up after loading
        localStorage.removeItem("pending_field_data");
        console.log("✅ Pending field data loaded and cleaned up");
      } catch (error) {
        console.error("❌ Error loading pending field data:", error);
        localStorage.removeItem("pending_field_data"); // Clean up corrupted data
      }
    }
  }, []);

  // Debug: log quando il componente si inizializza
  console.log("🚀 NuovoPreventivoBuyer inizializzato");
  console.log("📊 jobData attuale:", jobData);

  // Fetch certified quotes when all required fields are filled
  useEffect(() => {
    const loadCertifiedQuotes = async () => {
      // Only fetch if we're on step 2 and have all required data
      if (currentStep !== 2) {
        setCertifiedQuotes([]);
        return;
      }

      if (
        !jobData.service_type ||
        !jobData.terrain_conditions ||
        !gisData?.area_ha ||
        !gisData?.location
      ) {
        setCertifiedQuotes([]);
        return;
      }

      try {
        setLoadingCertifiedQuotes(true);

        // Extract location coordinates from gisData
        const location = gisData.location;
        const location_lat =
          location?.lat || location?.center?.lat || location?.coordinates?.[1];
        const location_lng =
          location?.lng || location?.center?.lng || location?.coordinates?.[0];

        const quotes = await fetchCertifiedQuotes({
          service_type: jobData.service_type,
          area_ha: gisData.area_ha,
          location_lat,
          location_lng,
          terrain_conditions: jobData.terrain_conditions,
          crop_type: jobData.crop_type,
          treatment_type: jobData.treatment_type,
        });

        setCertifiedQuotes(quotes.quotes || []);
      } catch (error: any) {
        console.error("Error fetching certified quotes:", error);
        // Don't show error toast - it's optional feature
        setCertifiedQuotes([]);
      } finally {
        setLoadingCertifiedQuotes(false);
      }
    };

    loadCertifiedQuotes();
  }, [
    currentStep,
    jobData.service_type,
    jobData.terrain_conditions,
    jobData.crop_type,
    jobData.treatment_type,
    gisData,
  ]);

  const handleGisComplete = (data: any) => {
    setGisData(data);
    setJobData((prev) => ({
      ...prev,
      field_polygon: data.polygon,
      area_ha: data.area_ha,
      location_json: data.location,
    }));
    setCurrentStep(2);
  };

  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log("🔍 DEBUG - Valori attuali del form:");
    console.log("  field_name:", `"${jobData.field_name}"`);
    console.log("  service_type:", `"${jobData.service_type}"`);
    console.log("  crop_type:", `"${jobData.crop_type}"`);
    console.log("  treatment_type:", `"${jobData.treatment_type}"`);
    console.log("  terrain_conditions:", `"${jobData.terrain_conditions}"`);
    console.log("  area_ha:", gisData?.area_ha);
    console.log("  jobData completo:", jobData);

    if (
      !jobData.field_name ||
      !jobData.service_type ||
      !jobData.crop_type ||
      !jobData.treatment_type ||
      !jobData.terrain_conditions
    ) {
      console.log("❌ DEBUG - Campi mancanti:", {
        field_name: !!jobData.field_name,
        service_type: !!jobData.service_type,
        crop_type: !!jobData.crop_type,
        treatment_type: !!jobData.treatment_type,
        terrain_conditions: !!jobData.terrain_conditions,
      });
      toast.error("Compila tutti i campi obbligatori");
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        toast.error("Devi essere autenticato");
        return;
      }

      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          field_name: jobData.field_name,
          service_type: jobData.service_type,
          crop_type: jobData.crop_type,
          treatment_type: jobData.treatment_type,
          terrain_conditions: jobData.terrain_conditions,
          field_polygon: jobData.field_polygon,
          area_ha: jobData.area_ha,
          location_json: jobData.location_json,
          requested_window_start: jobData.requested_window_start,
          requested_window_end: jobData.requested_window_end,
          constraints_json: {
            ...jobData.constraints_json,
            crop_type: jobData.crop_type,
            treatment_type: jobData.treatment_type,
            terrain_conditions: jobData.terrain_conditions,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore nella creazione del job");
      }

      const result = await response.json();

      toast.success(
        "Job pubblicato con successo! Gli operatori riceveranno le notifiche.",
      );

      // Navigate to job details or jobs list
      navigate("/buyer/servizi");
    } catch (error: any) {
      console.error("Error creating job:", error);
      toast.error(error.message || "Errore nella creazione del job");
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { id: 1, label: "Campo", description: "Seleziona area" },
    { id: 2, label: "Dettagli", description: "Configura servizio" },
  ];

  if (currentStep === 1) {
    return (
      <BuyerLayout>
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Nuovo Job</h1>
            <p className="text-slate-600 mt-1">
              Pubblica una richiesta di servizio - gli operatori ti manderanno
              le loro offerte
            </p>
          </div>

          {/* Progress indicator */}
          <div className="mb-8">
            <div className="flex items-center space-x-4">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step.id === currentStep
                        ? "bg-emerald-600 text-white"
                        : step.id < currentStep
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {step.id}
                  </div>
                  <div className="ml-3">
                    <div
                      className={`text-sm font-medium ${
                        step.id === currentStep
                          ? "text-slate-900"
                          : "text-slate-600"
                      }`}
                    >
                      {step.label}
                    </div>
                    <div className="text-xs text-slate-500">
                      {step.description}
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-12 h-px mx-4 ${
                        step.id < currentStep
                          ? "bg-emerald-600"
                          : "bg-slate-200"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <GisMapSelector
            onComplete={handleGisComplete}
            initialData={gisData}
          />
        </div>
      </BuyerLayout>
    );
  }

  return (
    <BuyerLayout>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Colonna principale del form */}
          <div className="lg:col-span-2">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900">
                Dettagli del Job
              </h1>
              <p className="text-slate-600 mt-1">
                Configura i dettagli del servizio richiesto
              </p>
            </div>

        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center space-x-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step.id === currentStep
                      ? "bg-emerald-600 text-white"
                      : step.id < currentStep
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {step.id}
                </div>
                <div className="ml-3">
                  <div
                    className={`text-sm font-medium ${
                      step.id === currentStep
                        ? "text-slate-900"
                        : "text-slate-600"
                    }`}
                  >
                    {step.label}
                  </div>
                  <div className="text-xs text-slate-500">
                    {step.description}
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-12 h-px mx-4 ${
                      step.id < currentStep ? "bg-emerald-600" : "bg-slate-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Job Form */}
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200">
          <form onSubmit={handleServiceSubmit} className="space-y-6">
            {/* Campo selezionato info */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="mb-2">
                <h3 className="font-medium text-emerald-900">
                  Campo Selezionato
                </h3>
              </div>
              <div className="text-sm text-emerald-700">
                <div>Area: {gisData?.area_ha?.toFixed(2)} ha</div>
                {gisData?.location && (
                  <div>
                    Ubicazione: {gisData.location.address || "Non specificata"}
                  </div>
                )}
              </div>
            </div>

            {/* Field Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Nome del Campo *
              </label>
              <input
                type="text"
                required
                value={jobData.field_name || ""}
                onChange={(e) =>
                  setJobData((prev) => ({
                    ...prev,
                    field_name: e.target.value,
                  }))
                }
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="es. Vigneto Chianti Classico"
              />
            </div>

            {/* Service Type */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Tipo di Servizio *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {SERVICE_TYPES.map((service) => (
                  <button
                    key={service.value}
                    type="button"
                    onClick={() => {
                      console.log("🎯 Click servizio:", service.value);
                      setJobData((prev) => {
                        const newData = {
                          ...prev,
                          service_type: service.value,
                        };
                        console.log(
                          "📝 Nuovo stato servizio:",
                          newData.service_type,
                        );
                        return newData;
                      });
                    }}
                    className={`p-4 border rounded-lg text-left transition-colors ${
                      jobData.service_type === service.value
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-2xl mb-2">{service.icon}</div>
                    <div className="font-medium">{service.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Crop Type */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Tipo di Coltura *
              </label>
              <select
                value={jobData.crop_type || ""}
                onChange={(e) => {
                  console.log("🌾 Cambio coltura:", e.target.value);
                  setJobData((prev) => {
                    const newData = { ...prev, crop_type: e.target.value };
                    console.log("📝 Nuovo stato coltura:", newData.crop_type);
                    return newData;
                  });
                }}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              >
                <option value="">Seleziona tipo di coltura</option>
                {CROP_TYPES.map((crop) => (
                  <option key={crop.value} value={crop.value}>
                    {crop.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Treatment Type - shown only when service is selected */}
            {jobData.service_type &&
              TREATMENT_TYPES[
                jobData.service_type as keyof typeof TREATMENT_TYPES
              ] && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Tipo di{" "}
                    {jobData.service_type === "IRRORAZIONE"
                      ? "Trattamento"
                      : jobData.service_type === "SPANDIMENTO"
                        ? "Spandimento"
                        : jobData.service_type === "RILIEVO_AEREO"
                          ? "Mappatura"
                          : "Servizio"}{" "}
                    *
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {TREATMENT_TYPES[
                      jobData.service_type as keyof typeof TREATMENT_TYPES
                    ].map((treatment) => (
                      <button
                        key={treatment.value}
                        type="button"
                        onClick={() => {
                          console.log("💊 Click trattamento:", treatment.value);
                          setJobData((prev) => {
                            const newData = {
                              ...prev,
                              treatment_type: treatment.value,
                            };
                            console.log(
                              "📝 Nuovo stato trattamento:",
                              newData.treatment_type,
                            );
                            return newData;
                          });
                        }}
                        className={`p-3 border rounded-lg text-left transition-colors ${
                          jobData.treatment_type === treatment.value
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <div className="font-medium">{treatment.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

            {/* Terrain Conditions */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Condizioni del Terreno *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {TERRAIN_CONDITIONS.map((condition) => (
                  <button
                    key={condition.value}
                    type="button"
                    onClick={() => {
                      console.log("🏔️ Click terreno:", condition.value);
                      setJobData((prev) => {
                        const newData = {
                          ...prev,
                          terrain_conditions: condition.value,
                        };
                        console.log(
                          "📝 Nuovo stato terreno:",
                          newData.terrain_conditions,
                        );
                        return newData;
                      });
                    }}
                    className={`p-3 border rounded-lg text-center transition-colors ${
                      jobData.terrain_conditions === condition.value
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-2xl mb-1">{condition.icon}</div>
                    <div className="font-medium text-sm">{condition.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Time Window */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Data Inizio Preferita
                </label>
                <input
                  type="date"
                  value={jobData.requested_window_start || ""}
                  onChange={(e) =>
                    setJobData((prev) => ({
                      ...prev,
                      requested_window_start: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Data Fine Preferita
                </label>
                <input
                  type="date"
                  value={jobData.requested_window_end || ""}
                  onChange={(e) =>
                    setJobData((prev) => ({
                      ...prev,
                      requested_window_end: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Constraints */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Note Aggiuntive (opzionale)
              </label>
              <textarea
                value={jobData.constraints_json?.notes || ""}
                onChange={(e) =>
                  setJobData((prev) => ({
                    ...prev,
                    constraints_json: {
                      ...prev.constraints_json,
                      notes: e.target.value,
                    },
                  }))
                }
                rows={3}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Specifiche particolari, condizioni del terreno, urgenza, ecc."
              />
            </div>

            {/* Certified Quotes Section */}
            {certifiedQuotes.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-semibold text-emerald-900">
                    Preventivi Immediati da Aziende Certificate
                  </h3>
                </div>
                <p className="text-sm text-emerald-700 mb-4">
                  Ecco i preventivi immediati delle aziende certificate per
                  questo servizio:
                </p>
                <div className="space-y-3">
                  {certifiedQuotes.map((quote) => (
                    <div
                      key={quote.org_id}
                      className="bg-white rounded-lg p-4 border border-emerald-200 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        {quote.logo_url ? (
                          <img
                            src={quote.logo_url}
                            alt={quote.org_name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                            <span className="text-emerald-600 font-semibold text-lg">
                              {quote.org_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-slate-900">
                            {quote.org_name}
                          </div>
                          <div className="text-xs text-slate-500">
                            Distanza: {quote.distance_km} km
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-emerald-600">
                          €{" "}
                          {((quote.total_cents || 0) / 100).toLocaleString(
                            "it-IT",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            },
                          )}
                        </div>
                        <div className="text-xs text-slate-500">
                          Preventivo immediato
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loadingCertifiedQuotes && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mt-6 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600 mx-auto mb-2"></div>
                <p className="text-sm text-slate-600">
                  Caricamento preventivi certificati...
                </p>
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-4 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="flex-1"
              >
                Indietro
              </Button>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {isSubmitting ? "Pubblicando..." : "Pubblica Job"}
              </Button>
            </div>
          </form>
        </div>

            {/* Info */}
            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-medium text-blue-900 mb-2">Come funziona?</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Pubblichi la tua richiesta senza specificare un prezzo</li>
                <li>• Gli operatori qualificati ricevono una notifica</li>
                <li>• Ricevi offerte competitive con prezzi e tempi</li>
                <li>• Confronti le offerte e scegli quella migliore</li>
                <li>• Paghi solo quando accetti un'offerta</li>
              </ul>
            </div>
          </div>

          {/* Colonna AI Assistant */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 mt-20">
              <VoiceAssistantPanel
                onParsedFields={(fields) => {
                  console.log("🤖 Campi parsati dall'assistente AI:", fields);
                  setJobData((prev) => {
                    const newData = { ...prev, ...fields };
                    console.log("📝 Nuovo stato jobData dopo assistente AI:", newData);
                    return newData;
                  });
                  toast.success("Campi compilati automaticamente dall'AI! 🤖");
                }}
                currentJobData={jobData}
              />
            </div>
          </div>
        </div>
      </div>
    </BuyerLayout>
  );
}
