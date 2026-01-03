import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import {
  fetchRateCards,
  RateCard,
  updateRateCard,
  fetchGeoAreas,
  fetchCropTypes,
} from "@/lib/api";
import {
  ArrowLeft,
  Droplet,
  Package,
  Map,
  Save,
  Settings,
  Euro,
  MapPin,
  Users,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

type ServiceType = "SPRAY" | "SPREAD" | "MAPPING";

const serviceTypeConfig: Record<
  ServiceType,
  { label: string; icon: any; description: string; color: string }
> = {
  SPRAY: {
    label: "Irrorazione",
    icon: Droplet,
    description: "SPRAY",
    color: "text-blue-600",
  },
  SPREAD: {
    label: "Spandimento",
    icon: Package,
    description: "SPREAD",
    color: "text-green-600",
  },
  MAPPING: {
    label: "Mappatura",
    icon: Map,
    description: "MAPPING",
    color: "text-purple-600",
  },
};

export default function ServiceDetail() {
  const { serviceType } = useParams<{ serviceType: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);

  // Form state
  const [baseRate, setBaseRate] = useState("");
  const [minCharge, setMinCharge] = useState("");
  const [travelRate, setTravelRate] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [showCompanyOnly, setShowCompanyOnly] = useState(false);
  const [selectedOperators, setSelectedOperators] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([
    "T30",
    "T50",
    "T70P",
  ]);
  const [selectedCropTypes, setSelectedCropTypes] = useState<string[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const orgId = localStorage.getItem("currentOrgId");
    setCurrentOrgId(orgId);
  }, []);

  const { data: rateCards = [], isLoading } = useQuery({
    queryKey: ["rateCards", currentOrgId],
    queryFn: () =>
      currentOrgId ? fetchRateCards(currentOrgId) : Promise.resolve([]),
    enabled: !!currentOrgId,
  });

  const { data: geoAreas } = useQuery({
    queryKey: ["geoAreas"],
    queryFn: fetchGeoAreas,
  });

  const { data: cropTypes } = useQuery({
    queryKey: ["cropTypes"],
    queryFn: fetchCropTypes,
  });

  const rateCard = rateCards.find((rc) => rc.service_type === serviceType);

  useEffect(() => {
    if (rateCard) {
      setBaseRate((rateCard.base_rate_per_ha_cents / 100).toString());
      setMinCharge((rateCard.min_charge_cents / 100).toString());
      setTravelRate((rateCard.travel_rate_per_km_cents / 100).toString());
      setHourlyRate(
        rateCard.hourly_operator_rate_cents
          ? (rateCard.hourly_operator_rate_cents / 100).toString()
          : "",
      );
      setShowCompanyOnly(rateCard.show_company_only || false);
      // TODO: Load selected operators, models, crop types and areas from database
      setSelectedOperators(rateCard.assigned_operator_ids || []);
      setSelectedModels(rateCard.supported_model_codes || []);
      setSelectedCropTypes(rateCard.crop_types || []);
      // TODO: Load selected areas from service_area_set
      setIsDirty(false);
    }
  }, [rateCard]);

  const updateServiceMutation = useMutation({
    mutationFn: async (updatedRateCard: Partial<RateCard>) => {
      console.log("🔄 Updating service with data:", updatedRateCard);
      if (!rateCard) throw new Error("Service not found");
      const result = await updateRateCard(currentOrgId, rateCard.id, {
        ...rateCard,
        ...updatedRateCard,
      });
      console.log("✅ Service update result:", result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rateCards", currentOrgId] });
      toast.success("Servizio aggiornato con successo");

      // Avvisa che operatori e modelli non sono ancora salvati
      if (selectedOperators.length > 0 || selectedModels.length < 3) {
        toast.info(
          "Nota: Le selezioni di operatori e modelli non vengono ancora salvate nel database",
          {
            duration: 4000,
          },
        );
      }

      setIsDirty(false);
    },
    onError: (error: any) => {
      toast.error("Errore nell'aggiornamento del servizio");
      console.error("❌ Update service error:", error);
    },
  });

  const handleSave = () => {
    if (!rateCard) return;

    console.log("💾 Tentativo salvataggio servizio:", {
      serviceType: rateCard.service_type,
      baseRate,
      minCharge,
      travelRate,
      hourlyRate,
      showCompanyOnly,
      selectedOperators,
      selectedModels,
    });

    const updates: Partial<RateCard> = {
      base_rate_per_ha_cents: Math.round(parseFloat(baseRate) * 100),
      min_charge_cents: Math.round(parseFloat(minCharge) * 100),
      travel_rate_per_km_cents: Math.round(parseFloat(travelRate) * 100),
      hourly_operator_rate_cents: hourlyRate
        ? Math.round(parseFloat(hourlyRate) * 100)
        : null,
      show_company_only: showCompanyOnly,
      assigned_operator_ids: selectedOperators,
      supported_model_codes: selectedModels,
      crop_types: selectedCropTypes,
      operator_assignment_mode: "ASSIGNED_ONLY", // Per ora fisso, poi sarà configurabile
      // TODO: service_area_set_id: selected area set
    };

    // TODO: Save selectedOperators and selectedModels to database
    console.log("📝 Dati da salvare:", updates);
    console.log(
      "👥 Operatori selezionati (non ancora salvati):",
      selectedOperators,
    );
    console.log("🤖 Modelli selezionati (non ancora salvati):", selectedModels);

    updateServiceMutation.mutate(updates);
  };

  const handleInputChange =
    (setter: (value: string) => void) => (value: string) => {
      setter(value);
      setIsDirty(true);
    };

  const markDirty = () => setIsDirty(true);

  if (!serviceType || !Object.keys(serviceTypeConfig).includes(serviceType)) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-slate-900">
            Servizio non trovato
          </h1>
          <p className="text-slate-600 mt-2">
            Il servizio richiesto non esiste.
          </p>
          <Button onClick={() => navigate("/admin/servizi")} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Torna ai servizi
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const config = serviceTypeConfig[serviceType as ServiceType];
  const Icon = config.icon;

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-2 text-slate-600">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
            <span>Caricamento servizio...</span>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/admin/servizi")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Servizi
          </Button>
          <div className="flex items-center gap-3">
            <div className={`p-3 bg-emerald-50 rounded-xl`}>
              <Icon className={`w-6 h-6 ${config.color}`} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {config.label}
              </h1>
              <p className="text-slate-600">{config.description}</p>
            </div>
          </div>
        </div>

        {/* Service Status */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-slate-900">Servizio attivo</p>
                  <p className="text-sm text-slate-600">
                    Disponibile per prenotazioni
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-green-50 text-green-700">
                ATTIVO
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pricing Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Euro className="w-5 h-5" />
                Configurazione Prezzi
              </CardTitle>
              <CardDescription>
                Imposta i prezzi per questo servizio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="baseRate">Prezzo base (€/ha)</Label>
                  <Input
                    id="baseRate"
                    type="number"
                    step="0.01"
                    value={baseRate}
                    onChange={(e) =>
                      handleInputChange(setBaseRate)(e.target.value)
                    }
                    placeholder="18.00"
                  />
                </div>
                <div>
                  <Label htmlFor="minCharge">Minimo intervento (€)</Label>
                  <Input
                    id="minCharge"
                    type="number"
                    step="0.01"
                    value={minCharge}
                    onChange={(e) =>
                      handleInputChange(setMinCharge)(e.target.value)
                    }
                    placeholder="250.00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="travelRate">Spostamento (€/km)</Label>
                  <Input
                    id="travelRate"
                    type="number"
                    step="0.01"
                    value={travelRate}
                    onChange={(e) =>
                      handleInputChange(setTravelRate)(e.target.value)
                    }
                    placeholder="1.20"
                  />
                </div>
                <div>
                  <Label htmlFor="hourlyRate">Orario operatore (€/ora)</Label>
                  <Input
                    id="hourlyRate"
                    type="number"
                    step="0.01"
                    value={hourlyRate}
                    onChange={(e) =>
                      handleInputChange(setHourlyRate)(e.target.value)
                    }
                    placeholder="45.00"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Impostazioni Servizio
              </CardTitle>
              <CardDescription>
                Configura come offrire questo servizio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-semibold text-slate-900 mb-3 block">
                  Modelli compatibili
                </Label>
                <div className="flex flex-wrap gap-2">
                  {["T30", "T50", "T70P"].map((model) => (
                    <button
                      key={model}
                      onClick={() => {
                        console.log("🔄 Toggle modello:", model);
                        setSelectedModels((prev) =>
                          prev.includes(model)
                            ? prev.filter((m) => m !== model)
                            : [...prev, model],
                        );
                        markDirty();
                      }}
                      className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                        selectedModels.includes(model)
                          ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                          : "bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      DJI Agras {model}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Coverage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Copertura Servizio
              </CardTitle>
              <CardDescription>
                Seleziona le aree geografiche e i tipi di coltura supportati
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Crop Types */}
              <div>
                <Label className="text-sm font-semibold text-slate-900 mb-3 block">
                  Tipi di coltura supportati
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {cropTypes?.map((crop) => (
                    <button
                      key={crop.id}
                      onClick={() => {
                        setSelectedCropTypes((prev) =>
                          prev.includes(crop.id)
                            ? prev.filter((id) => id !== crop.id)
                            : [...prev, crop.id],
                        );
                        markDirty();
                      }}
                      className={`p-2 rounded-lg border text-left transition-colors text-sm ${
                        selectedCropTypes.includes(crop.id)
                          ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className="font-medium">{crop.name}</div>
                      <div className="text-xs opacity-75 capitalize">
                        {crop.category}
                      </div>
                    </button>
                  ))}
                </div>
                {selectedCropTypes.length === 0 && (
                  <p className="text-sm text-slate-500 mt-2">
                    Nessuna coltura selezionata
                  </p>
                )}
              </div>

              <Separator />

              {/* Geographic Areas */}
              <div>
                <Label className="text-sm font-semibold text-slate-900 mb-3 block">
                  Aree geografiche coperte
                </Label>

                {/* Provinces */}
                <div className="mb-4">
                  <Label className="text-xs text-slate-500 uppercase mb-2 block">
                    Province
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {geoAreas?.provinces?.map((province) => (
                      <button
                        key={province.code}
                        onClick={() => {
                          // Per ora semplice toggle, in futuro logica più complessa
                          console.log("Toggle provincia:", province.name);
                          markDirty();
                        }}
                        className="px-3 py-1 rounded-full text-sm border bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      >
                        {province.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Municipalities */}
                <div>
                  <Label className="text-xs text-slate-500 uppercase mb-2 block">
                    Comuni (Provincia di Trento)
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {geoAreas?.comuni?.slice(0, 10).map(
                      (
                        comune, // Limita a 10 per ora
                      ) => (
                        <button
                          key={comune.code}
                          onClick={() => {
                            // Per ora semplice toggle, in futuro logica più complessa
                            console.log("Toggle comune:", comune.name);
                            markDirty();
                          }}
                          className="px-3 py-1 rounded-full text-sm border bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        >
                          {comune.name}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                <p className="text-sm text-slate-500 mt-2">
                  🔧 Sistema di selezione aree in sviluppo - per ora logging
                  delle interazioni
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coverage Areas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Aree coperte
            </CardTitle>
            <CardDescription>
              Zone geografiche in cui è disponibile questo servizio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="px-3 py-1">
                Trentino
              </Badge>
              <Badge variant="secondary" className="px-3 py-1">
                Alto Adige
              </Badge>
              <Badge variant="secondary" className="px-3 py-1">
                Veneto
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Assigned Operators */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Operatori assegnabili
            </CardTitle>
            <CardDescription>
              Seleziona gli operatori qualificati per questo servizio
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="showCompanyOnly">Mostra solo azienda</Label>
                <p className="text-sm text-slate-500">
                  I clienti vedranno solo il nome dell'azienda invece dei
                  singoli operatori
                </p>
              </div>
              <Checkbox
                id="showCompanyOnly"
                checked={showCompanyOnly}
                onCheckedChange={(checked) => {
                  setShowCompanyOnly(checked as boolean);
                  markDirty();
                }}
              />
            </div>

            <Separator />

            {!showCompanyOnly && (
              <div>
                <Label className="text-sm font-semibold text-slate-900 mb-3 block">
                  Operatori selezionati
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {[
                    { id: "mario-rossi", name: "Mario Rossi", role: "Pilota" },
                    {
                      id: "giovanni-verdi",
                      name: "Giovanni Verdi",
                      role: "Pilota",
                    },
                    {
                      id: "luca-bianchi",
                      name: "Luca Bianchi",
                      role: "Pilota",
                    },
                  ].map((operator) => (
                    <button
                      key={operator.id}
                      onClick={() => {
                        console.log(
                          "👤 Toggle operatore:",
                          operator.name,
                          operator.id,
                        );
                        setSelectedOperators((prev) =>
                          prev.includes(operator.id)
                            ? prev.filter((id) => id !== operator.id)
                            : [...prev, operator.id],
                        );
                        markDirty();
                      }}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        selectedOperators.includes(operator.id)
                          ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className="font-medium">{operator.name}</div>
                      <div className="text-sm opacity-75">{operator.role}</div>
                    </button>
                  ))}
                </div>
                {selectedOperators.length === 0 && (
                  <p className="text-sm text-slate-500 mt-2">
                    Nessun operatore selezionato
                  </p>
                )}
              </div>
            )}

            {showCompanyOnly && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-sm text-emerald-800">
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                  Il servizio verrà offerto dall'azienda stessa
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        {isDirty && (
          <div className="fixed bottom-6 right-6">
            <Button
              onClick={handleSave}
              disabled={updateServiceMutation.isPending}
              className="shadow-lg"
            >
              <Save className="w-4 h-4 mr-2" />
              {updateServiceMutation.isPending
                ? "Salvataggio..."
                : "Salva modifiche"}
            </Button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
