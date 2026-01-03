import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import {
  fetchRateCards,
  RateCard,
  createRateCard,
  updateRateCard,
  deleteRateCard,
  fetchServiceConfig,
  updateServiceConfig,
  fetchDrones,
  Drone,
} from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth";
import {
  Droplet,
  Package,
  Map,
  Settings,
  Plus,
  Edit,
  Copy,
  Power,
  PowerOff,
  MapPin,
  Users,
  Euro,
  Search,
  Filter,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type ServiceType = "IRRORAZIONE" | "SPANDIMENTO" | "RILIEVO_AEREO" | "SOLLEVAMENTO";

const serviceTypeConfig: Record<
  ServiceType,
  { label: string; icon: any; description: string }
> = {
  SPRAY: {
    label: "Irrorazione",
    icon: Droplet,
    description: "SPRAY",
  },
  SPREAD: { label: "Spandimento", icon: Package, description: "SPREAD" },
  MAPPING: { label: "Mappatura", icon: Map, description: "MAPPING" },
};

const REGIONS = [
  { value: "abruzzo", label: "Abruzzo" },
  { value: "basilicata", label: "Basilicata" },
  { value: "calabria", label: "Calabria" },
  { value: "campania", label: "Campania" },
  { value: "emilia-romagna", label: "Emilia-Romagna" },
  { value: "friuli-venezia-giulia", label: "Friuli-Venezia Giulia" },
  { value: "lazio", label: "Lazio" },
  { value: "liguria", label: "Liguria" },
  { value: "lombardia", label: "Lombardia" },
  { value: "marche", label: "Marche" },
  { value: "molise", label: "Molise" },
  { value: "piemonte", label: "Piemonte" },
  { value: "puglia", label: "Puglia" },
  { value: "sardegna", label: "Sardegna" },
  { value: "sicilia", label: "Sicilia" },
  { value: "toscana", label: "Toscana" },
  { value: "trentino-alto-adige", label: "Trentino-Alto Adige" },
  { value: "umbria", label: "Umbria" },
  { value: "valle-d-aosta", label: "Valle d'Aosta" },
  { value: "veneto", label: "Veneto" },
];

export default function Servizi() {
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<RateCard | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();

  // Stati per ricerca indirizzo base operativa
  const [baseAddressQuery, setBaseAddressQuery] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(
    null,
  );
  const [isUpdatingServiceConfig, setIsUpdatingServiceConfig] = useState(false);
  const [enableJobFilters, setEnableJobFilters] = useState(false);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [regionsOpen, setRegionsOpen] = useState(false);
  const [hasUserModifiedAddress, setHasUserModifiedAddress] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);

  // Ottieni l'ID dell'organizzazione corrente
  useEffect(() => {
    const orgData = localStorage.getItem("organization");
    if (orgData) {
      try {
        const org = JSON.parse(orgData);
        setCurrentOrgId(org.id);
      } catch (error) {
        console.error("Errore nel parsing dei dati organizzazione:", error);
      }
    }
  }, []);

  // Cleanup timeout ricerca indirizzo
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  // Query per rate cards
  const { data: rateCards = [], isLoading } = useQuery({
    queryKey: ["rateCards", currentOrgId],
    queryFn: () =>
      currentOrgId ? fetchRateCards(currentOrgId) : Promise.resolve([]),
    enabled: !!currentOrgId,
  });

  const { data: serviceConfig } = useQuery({
    queryKey: ["serviceConfig", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return null;

      try {
        const dbConfig = await fetchServiceConfig(currentOrgId);

        // Se la configurazione dal DB è vuota (tabella non esiste), prova dal localStorage
        if (!dbConfig.base_location_address) {
          const localConfig = localStorage.getItem(
            `serviceConfig_${currentOrgId}`,
          );
          if (localConfig) {
            const parsed = JSON.parse(localConfig);
            return { ...dbConfig, ...parsed };
          }
        }

        return dbConfig;
      } catch (error) {
        // Se errore DB, prova dal localStorage
        console.warn("DB error, trying localStorage fallback");
        const localConfig = localStorage.getItem(
          `serviceConfig_${currentOrgId}`,
        );
        if (localConfig) {
          return JSON.parse(localConfig);
        }
        return null;
      }
    },
    enabled: !!currentOrgId,
  });

  // Sincronizza il valore dell'input con il serviceConfig (solo se l'utente non ha modificato)
  useEffect(() => {
    if (
      serviceConfig?.base_location_address &&
      !hasUserModifiedAddress &&
      baseAddressQuery !== serviceConfig.base_location_address
    ) {
      setBaseAddressQuery(serviceConfig.base_location_address);
    }
    // Rimuoviamo baseAddressQuery dalle dipendenze per evitare loop infiniti
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceConfig, hasUserModifiedAddress]);

  // Inizializza enableJobFilters quando serviceConfig cambia
  useEffect(() => {
    if (serviceConfig?.enable_job_filters !== undefined) {
      setEnableJobFilters(serviceConfig.enable_job_filters);
    }
    // Inizializza regioni selezionate
    if (serviceConfig?.operating_regions) {
      const regions = serviceConfig.operating_regions
        .split(",")
        .filter((r) => r.trim());
      setSelectedRegions(regions);
    } else {
      setSelectedRegions([]);
    }
  }, [serviceConfig?.enable_job_filters, serviceConfig?.operating_regions]);

  // Mutation per creare/aggiornare rate card
  const upsertMutation = useMutation({
    mutationFn: ({ orgId, rateCard }: { orgId: string; rateCard: any }) => {
      // Usa sempre POST per upsert (il backend gestisce CREATE o UPDATE automaticamente)
      // Questo evita problemi di routing ambigui in Hono
      return createRateCard(orgId, rateCard);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rateCards", currentOrgId] });
      setSheetOpen(false);
      setSelectedService(null);
      setIsEditing(false);
    },
  });

  const updateServiceConfigMutation = useMutation({
    mutationFn: ({
      orgId,
      config,
    }: {
      orgId: string;
      config: Partial<ServiceConfiguration>;
    }) => updateServiceConfig(orgId, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["serviceConfig"] });
      toast.success("Configurazioni salvate con successo");
    },
  });

  // Mutation per eliminare rate card
  const deleteMutation = useMutation({
    mutationFn: ({
      orgId,
      serviceType,
    }: {
      orgId: string;
      serviceType: string;
    }) => deleteRateCard(orgId, serviceType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rateCards", currentOrgId] });
    },
  });

  const handleCreateService = (serviceType: ServiceType) => {
    setSelectedService(null);
    setIsEditing(true);
    setSheetOpen(true);
    // Pre-compila con valori di default
    // (sarà gestito nel form)
  };

  const handleEditService = (rateCard: RateCard) => {
    setSelectedService(rateCard);
    setIsEditing(true);
    setSheetOpen(true);
  };

  const handleDuplicateService = (rateCard: RateCard) => {
    // TODO: implementare duplicazione
    console.log("Duplica servizio:", rateCard);
  };

  // Mutation per toggle is_active
  const toggleActiveMutation = useMutation({
    mutationFn: async ({
      orgId,
      rateCardId,
      serviceType,
      isActive,
    }: {
      orgId: string;
      rateCardId: string;
      serviceType: string;
      isActive: boolean;
    }) => {
      // Il backend endpoint PUT /:orgId/:serviceType si aspetta serviceType, non rateCardId
      // Facciamo una richiesta diretta usando fetch con l'endpoint corretto
      const response = await fetch(`/api/services/${orgId}/${serviceType}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ is_active: !isActive }),
      });
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error || "Failed to update");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rateCards", currentOrgId] });
      toast.success("Stato servizio aggiornato");
    },
    onError: (error: any) => {
      toast.error("Errore nell'aggiornamento dello stato", {
        description: error.message || "Si è verificato un errore",
      });
    },
  });

  const handleToggleService = (rateCard: RateCard) => {
    if (!currentOrgId) return;
    toggleActiveMutation.mutate({
      orgId: currentOrgId,
      rateCardId: rateCard.id,
      serviceType: rateCard.service_type,
      isActive: rateCard.is_active ?? true,
    });
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(cents / 100);
  };

  // KPI
  const activeServices = rateCards.length;
  const coveredAreas = 5; // TODO: calcolare da ServiceAreaSet
  const activeOperators = 3; // TODO: calcolare da OperatorProfile

  if (!currentOrgId) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-slate-600">Nessuna organizzazione selezionata</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Servizi</h1>
          <p className="text-slate-600 mt-1">
            Configura la tua offerta di noleggio e intervento operativo
          </p>
        </div>

        <Tabs defaultValue="servizi" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="servizi">Servizi</TabsTrigger>
            <TabsTrigger value="config">Configurazioni</TabsTrigger>
          </TabsList>

          <TabsContent value="servizi" className="space-y-6">
            {/* KPI */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    Servizi attivi
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">
                    {activeServices}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    Aree coperte
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">
                    {coveredAreas}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    Operatori attivi
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">
                    {activeOperators}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lista servizi */}
            {isLoading ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center gap-2 text-slate-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
                  <span className="text-sm">Caricamento servizi...</span>
                </div>
              </div>
            ) : rateCards.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-slate-600 mb-4">
                    Nessun servizio configurato
                  </p>
                  <Button onClick={() => handleCreateService("SPRAY")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Crea primo servizio
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {rateCards.map((rateCard) => {
                  const config = serviceTypeConfig[rateCard.service_type];
                  const Icon = config.icon;
                  return (
                    <ServiceCard
                      key={rateCard.id}
                      rateCard={rateCard}
                      config={config}
                      Icon={Icon}
                      onEdit={() => handleEditService(rateCard)}
                      onDuplicate={() => handleDuplicateService(rateCard)}
                      onToggle={() => handleToggleService(rateCard)}
                      formatPrice={formatPrice}
                    />
                  );
                })}
              </div>
            )}

            {/* CTA per creare nuovo servizio */}
            <Card className="border-dashed">
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Aggiungi nuovo servizio
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">
                      Configura un nuovo tipo di intervento
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {(Object.keys(serviceTypeConfig) as ServiceType[]).map(
                      (type) => {
                        const config = serviceTypeConfig[type];
                        const Icon = config.icon;
                        return (
                          <Button
                            key={type}
                            variant="outline"
                            onClick={() => handleCreateService(type)}
                            className="flex items-center gap-2"
                          >
                            <Icon className="w-4 h-4" />
                            {config.label}
                          </Button>
                        );
                      },
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Configurazioni */}
          <TabsContent value="config" className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                Configurazioni Generali
              </h2>
              <p className="text-slate-600 mt-1">
                Impostazioni generali per la tua offerta di servizi
              </p>
            </div>

            {/* Base operativa */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Base Operativa
                </CardTitle>
                <CardDescription>
                  Dove si trova la tua base di partenza per i servizi
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-w-md">
                  <Label htmlFor="base-address">Indirizzo base</Label>
                  <div className="relative mt-1">
                    <Popover
                      open={showSuggestions}
                      onOpenChange={setShowSuggestions}
                    >
                      <PopoverTrigger asChild>
                        <div className="relative">
                          <Input
                            ref={addressInputRef}
                            id="base-address"
                            placeholder="Via Roma 123, Milano"
                            value={baseAddressQuery}
                            onChange={(e) => {
                              const query = e.target.value;
                              setBaseAddressQuery(query);
                              setHasUserModifiedAddress(true); // L'utente ha iniziato a scrivere

                              // Se l'utente sta modificando manualmente, non cercare suggerimenti
                              // fino a quando non ha finito di scrivere
                              setAddressSuggestions([]);
                              setShowSuggestions(false);

                              if (query.length < 3) {
                                if (searchTimeout) {
                                  clearTimeout(searchTimeout);
                                  setSearchTimeout(null);
                                }
                                return;
                              }

                              // Cancella timeout precedente
                              if (searchTimeout) {
                                clearTimeout(searchTimeout);
                              }

                              // Imposta nuovo timeout per ricerca con debounce
                              const timeout = setTimeout(async () => {
                                try {
                                  const response = await fetch(
                                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=it`,
                                  );
                                  const results = await response.json();
                                  setAddressSuggestions(results);
                                  setShowSuggestions(results.length > 0);
                                } catch (error) {
                                  console.error(
                                    "Errore autocompletamento:",
                                    error,
                                  );
                                  setAddressSuggestions([]);
                                  setShowSuggestions(false);
                                }
                              }, 300); // 300ms di debounce

                              setSearchTimeout(timeout);
                            }}
                            className="pr-10"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck="false"
                          />
                          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandList>
                            {addressSuggestions.length === 0 ? (
                              <CommandEmpty>
                                Nessun indirizzo trovato
                              </CommandEmpty>
                            ) : (
                              <CommandGroup>
                                {addressSuggestions.map(
                                  (address: any, index: number) => (
                                    <CommandItem
                                      key={index}
                                      onSelect={async () => {
                                        const selectedAddress =
                                          address.display_name;
                                        setBaseAddressQuery(selectedAddress);
                                        setShowSuggestions(false);

                                        // Salva l'indirizzo nel database con coordinate
                                        setIsUpdatingServiceConfig(true);
                                        try {
                                          const result =
                                            await updateServiceConfig(
                                              currentOrgId!,
                                              {
                                                base_location_address:
                                                  selectedAddress,
                                                base_location_lat: parseFloat(
                                                  address.lat,
                                                ),
                                                base_location_lng: parseFloat(
                                                  address.lon,
                                                ),
                                              },
                                            );

                                          // Se è un salvataggio simulato (tabella non esiste), salva localmente
                                          if (result.id?.startsWith("temp-")) {
                                            localStorage.setItem(
                                              `serviceConfig_${currentOrgId}`,
                                              JSON.stringify({
                                                base_location_address:
                                                  selectedAddress,
                                                base_location_lat: parseFloat(
                                                  address.lat,
                                                ),
                                                base_location_lng: parseFloat(
                                                  address.lon,
                                                ),
                                              }),
                                            );
                                            console.log(
                                              "💾 Salvataggio locale (tabella DB non disponibile)",
                                            );
                                          }

                                          // Aggiorna la cache
                                          queryClient.invalidateQueries({
                                            queryKey: [
                                              "serviceConfig",
                                              currentOrgId,
                                            ],
                                          });

                                          // Reset flag modifica utente dopo salvataggio
                                          setHasUserModifiedAddress(false);

                                          console.log(
                                            "✅ Indirizzo base aggiornato:",
                                            selectedAddress,
                                          );
                                          toast.success(
                                            "Indirizzo base aggiornato con coordinate GPS!",
                                          );
                                        } catch (error) {
                                          console.error(
                                            "❌ Errore salvataggio indirizzo:",
                                            error,
                                          );
                                          toast.error(
                                            "Errore nel salvataggio dell'indirizzo",
                                          );
                                        } finally {
                                          setIsUpdatingServiceConfig(false);
                                        }
                                      }}
                                    >
                                      <MapPin className="mr-2 h-4 w-4" />
                                      <div className="flex flex-col">
                                        <span className="font-medium">
                                          {address.display_name.split(",")[0]}
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                          {address.display_name
                                            .split(",")
                                            .slice(1, 3)
                                            .join(", ")}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ),
                                )}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      onClick={async () => {
                        if (!baseAddressQuery.trim()) {
                          toast.error("Inserisci un indirizzo valido");
                          return;
                        }

                        setIsUpdatingServiceConfig(true);
                        try {
                          const result = await updateServiceConfig(
                            currentOrgId!,
                            {
                              base_location_address: baseAddressQuery.trim(),
                            },
                          );

                          // Se è un salvataggio simulato (tabella non esiste), salva localmente
                          if (result.id?.startsWith("temp-")) {
                            localStorage.setItem(
                              `serviceConfig_${currentOrgId}`,
                              JSON.stringify({
                                base_location_address: baseAddressQuery.trim(),
                              }),
                            );
                            console.log(
                              "💾 Salvataggio locale indirizzo (tabella DB non disponibile)",
                            );
                          }

                          queryClient.invalidateQueries({
                            queryKey: ["serviceConfig", currentOrgId],
                          });

                          // Reset flag modifica utente dopo salvataggio
                          setHasUserModifiedAddress(false);

                          toast.success("Indirizzo base salvato!");
                        } catch (error) {
                          console.error("Errore salvataggio indirizzo:", error);
                          toast.error("Errore nel salvataggio dell'indirizzo");
                        } finally {
                          setIsUpdatingServiceConfig(false);
                        }
                      }}
                      size="sm"
                      disabled={
                        !baseAddressQuery.trim() || isUpdatingServiceConfig
                      }
                    >
                      {isUpdatingServiceConfig
                        ? "Salvando..."
                        : "Salva Indirizzo"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Inserisci l'indirizzo completo per i calcoli di trasferta
                    automatici. Seleziona da suggerimenti o salva manualmente.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Messaggi predefiniti */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Messaggi Predefiniti
                </CardTitle>
                <CardDescription>
                  Template per le comunicazioni automatiche
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="offer-template">Messaggio offerta</Label>
                  <Textarea
                    id="offer-template"
                    placeholder="Siamo lieti di presentarvi la nostra offerta..."
                    defaultValue={serviceConfig?.offer_message_template || ""}
                    rows={3}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="rejection-template">Messaggio rifiuto</Label>
                  <Textarea
                    id="rejection-template"
                    placeholder="Grazie per aver preso in considerazione i nostri servizi..."
                    defaultValue={
                      serviceConfig?.rejection_message_template || ""
                    }
                    rows={3}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Costi operativi */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Euro className="w-5 h-5" />
                  Costi Operativi
                </CardTitle>
                <CardDescription>
                  Costi di trasferta per gli spostamenti
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-w-xs">
                  <Label htmlFor="transfer-rate">Costo trasferta (€/km)</Label>
                  <Input
                    id="transfer-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="1.50"
                    defaultValue={
                      (serviceConfig?.transfer_rate_cents || 0) / 100
                    }
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Costo applicato per ogni km di trasferta dalla base
                    operativa
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Filtro per lavoro */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  Filtro per Lavoro
                </CardTitle>
                <CardDescription>
                  Limita i job che ricevi in base alle tue preferenze
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="enable-filters"
                      checked={enableJobFilters}
                      onCheckedChange={(checked) =>
                        setEnableJobFilters(checked === true)
                      }
                    />
                    <Label
                      htmlFor="enable-filters"
                      className="text-sm font-medium"
                    >
                      Abilita filtri per i job ricevuti
                    </Label>
                  </div>

                  {enableJobFilters && (
                    <div className="ml-6 space-y-3">
                      <div>
                        <Label htmlFor="regions">Regioni operative</Label>
                        <div className="mt-1 space-y-2">
                          <Popover
                            open={regionsOpen}
                            onOpenChange={setRegionsOpen}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between"
                              >
                                {selectedRegions.length === 0
                                  ? "Seleziona regioni"
                                  : selectedRegions.length === REGIONS.length
                                    ? "Tutte le regioni selezionate"
                                    : `${selectedRegions.length} regioni selezionate`}
                                <Filter className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-full p-0"
                              align="start"
                            >
                              <Command>
                                <CommandInput placeholder="Cerca regione..." />
                                <CommandList>
                                  <CommandEmpty>
                                    Nessuna regione trovata.
                                  </CommandEmpty>
                                  <CommandGroup>
                                    <CommandItem
                                      onSelect={() => {
                                        if (
                                          selectedRegions.length ===
                                          REGIONS.length
                                        ) {
                                          setSelectedRegions([]);
                                        } else {
                                          setSelectedRegions(
                                            REGIONS.map((r) => r.value),
                                          );
                                        }
                                      }}
                                    >
                                      <Check
                                        className={`mr-2 h-4 w-4 ${
                                          selectedRegions.length ===
                                          REGIONS.length
                                            ? "opacity-100"
                                            : "opacity-0"
                                        }`}
                                      />
                                      Seleziona tutte
                                    </CommandItem>
                                    {REGIONS.map((region) => (
                                      <CommandItem
                                        key={region.value}
                                        onSelect={() => {
                                          if (
                                            selectedRegions.includes(
                                              region.value,
                                            )
                                          ) {
                                            setSelectedRegions(
                                              selectedRegions.filter(
                                                (r) => r !== region.value,
                                              ),
                                            );
                                          } else {
                                            setSelectedRegions([
                                              ...selectedRegions,
                                              region.value,
                                            ]);
                                          }
                                        }}
                                      >
                                        <Check
                                          className={`mr-2 h-4 w-4 ${
                                            selectedRegions.includes(
                                              region.value,
                                            )
                                              ? "opacity-100"
                                              : "opacity-0"
                                          }`}
                                        />
                                        {region.label}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          {selectedRegions.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {selectedRegions.map((regionValue) => {
                                const region = REGIONS.find(
                                  (r) => r.value === regionValue,
                                );
                                return (
                                  <Badge
                                    key={regionValue}
                                    variant="secondary"
                                    className="flex items-center gap-1 px-2 py-1"
                                  >
                                    {region?.label}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedRegions(
                                          selectedRegions.filter(
                                            (r) => r !== regionValue,
                                          ),
                                        );
                                      }}
                                      className="ml-1 hover:bg-slate-200 rounded-full p-0.5"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="hourly-rate-min">
                            Tariffa minima (€/ora)
                          </Label>
                          <Input
                            id="hourly-rate-min"
                            type="number"
                            step="1"
                            min="0"
                            placeholder="50"
                            defaultValue={
                              (serviceConfig?.hourly_rate_min_cents || 0) / 100
                            }
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="hourly-rate-max">
                            Tariffa massima (€/ora)
                          </Label>
                          <Input
                            id="hourly-rate-max"
                            type="number"
                            step="1"
                            min="0"
                            placeholder="200"
                            defaultValue={
                              (serviceConfig?.hourly_rate_max_cents || 0) / 100
                            }
                            className="mt-1"
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Tipi di servizio offerti</Label>
                        <div className="mt-2 space-y-2">
                          {[
                            { key: "SPRAY", label: "Trattamenti fitosanitari" },
                            {
                              key: "SPREAD",
                              label: "Spandimento fertilizzanti",
                            },
                            { key: "MAPPING", label: "Rilievo aereo" },
                          ].map((service) => (
                            <div
                              key={service.key}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={`service-${service.key}`}
                                defaultChecked={(
                                  serviceConfig?.offered_service_types || ""
                                )
                                  .split(",")
                                  .includes(service.key)}
                              />
                              <Label
                                htmlFor={`service-${service.key}`}
                                className="text-sm"
                              >
                                {service.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label>Condizioni terreno gestibili</Label>
                        <div className="mt-2 space-y-2">
                          {[
                            { key: "pianeggiante", label: "Pianeggiante" },
                            { key: "collinare", label: "Collinare" },
                            { key: "montuoso", label: "Montuoso" },
                          ].map((terrain) => (
                            <div
                              key={terrain.key}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={`terrain-${terrain.key}`}
                                defaultChecked={(
                                  serviceConfig?.manageable_terrain || ""
                                )
                                  .split(",")
                                  .includes(terrain.key)}
                              />
                              <Label
                                htmlFor={`terrain-${terrain.key}`}
                                className="text-sm"
                              >
                                {terrain.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Salva configurazioni */}
            <div className="flex justify-end pt-4">
              <Button
                onClick={async () => {
                  try {
                    const config = {
                      base_location_address:
                        (
                          document.getElementById(
                            "base-address",
                          ) as HTMLInputElement
                        )?.value || "",
                      offer_message_template:
                        (
                          document.getElementById(
                            "offer-template",
                          ) as HTMLTextAreaElement
                        )?.value || "",
                      rejection_message_template:
                        (
                          document.getElementById(
                            "rejection-template",
                          ) as HTMLTextAreaElement
                        )?.value || "",
                      transfer_rate_cents: Math.round(
                        (parseFloat(
                          (
                            document.getElementById(
                              "transfer-rate",
                            ) as HTMLInputElement
                          )?.value || "0",
                        ) || 0) * 100,
                      ),
                      enable_job_filters: enableJobFilters,
                      operating_regions: selectedRegions.join(","),
                      offered_service_types: Array.from(
                        document.querySelectorAll(
                          'input[id^="service-"]:checked',
                        ),
                      )
                        .map((cb) =>
                          (cb as HTMLInputElement).id.replace("service-", ""),
                        )
                        .join(","),
                      manageable_terrain: Array.from(
                        document.querySelectorAll(
                          'input[id^="terrain-"]:checked',
                        ),
                      )
                        .map((cb) =>
                          (cb as HTMLInputElement).id.replace("terrain-", ""),
                        )
                        .join(","),
                      hourly_rate_min_cents: Math.round(
                        (parseFloat(
                          (
                            document.getElementById(
                              "hourly-rate-min",
                            ) as HTMLInputElement
                          )?.value || "0",
                        ) || 0) * 100,
                      ),
                      hourly_rate_max_cents: Math.round(
                        (parseFloat(
                          (
                            document.getElementById(
                              "hourly-rate-max",
                            ) as HTMLInputElement
                          )?.value || "0",
                        ) || 0) * 100,
                      ),
                    };

                    await updateServiceConfigMutation.mutateAsync({
                      orgId: currentOrgId,
                      config,
                    });
                  } catch (error) {
                    toast.error("Errore nel salvataggio", {
                      description: "Si è verificato un errore nel salvataggio.",
                    });
                  }
                }}
                disabled={updateServiceConfigMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {updateServiceConfigMutation.isPending
                  ? "Salvataggio..."
                  : "Salva Configurazioni"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Sheet per configurazione servizio */}
        {sheetOpen && (
          <ServiceConfigSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            rateCard={selectedService}
            orgId={currentOrgId!}
            isEditing={isEditing}
            onSave={(data) =>
              upsertMutation.mutate({ orgId: currentOrgId!, rateCard: data })
            }
          />
        )}
      </div>
    </AdminLayout>
  );
}

// Componente Card Servizio
function ServiceCard({
  rateCard,
  config,
  Icon,
  onEdit,
  onDuplicate,
  onToggle,
  formatPrice,
}: {
  rateCard: RateCard;
  config: { label: string; icon: any; description: string };
  Icon: any;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggle: () => void;
  formatPrice: (cents: number) => string;
}) {
  const isActive = rateCard.is_active ?? true;
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Icon className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-lg">{config.label}</CardTitle>
              <CardDescription className="mt-1">
                {config.description}
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="secondary"
            className={
              isActive
                ? "bg-green-50 text-green-700"
                : "bg-gray-50 text-gray-700"
            }
          >
            {isActive ? "ATTIVO" : "DISATTIVATO"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Modelli supportati - TODO: da implementare */}
        <div>
          <Label className="text-xs text-slate-500 uppercase">
            Modelli supportati
          </Label>
          <p className="text-sm text-slate-700 mt-1">
            DJI Agras T30 · T50 · T70P
          </p>
        </div>

        {/* Prezzo */}
        <div>
          <Label className="text-xs text-slate-500 uppercase">Prezzo</Label>
          <p className="text-sm text-slate-700 mt-1">
            {formatPrice(rateCard.base_rate_per_ha_cents)} / ha · minimo{" "}
            {formatPrice(rateCard.min_charge_cents)}
          </p>
        </div>

        {/* Territorio - TODO: da implementare */}
        <div>
          <Label className="text-xs text-slate-500 uppercase">Territorio</Label>
          <p className="text-sm text-slate-700 mt-1">Trentino Alto-Adige</p>
        </div>

        {/* Azioni */}
        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit className="w-4 h-4 mr-2" />
            Configura
          </Button>
          <Button variant="outline" size="sm" onClick={onDuplicate}>
            <Copy className="w-4 h-4 mr-2" />
            Duplica
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggle}
            className={
              isActive
                ? "text-red-600 hover:text-red-700"
                : "text-emerald-600 hover:text-emerald-700"
            }
          >
            {isActive ? (
              <>
                <PowerOff className="w-4 h-4 mr-2" />
                Disattiva
              </>
            ) : (
              <>
                <Power className="w-4 h-4 mr-2" />
                Attiva
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Componente Sheet per configurazione servizio (6 step)
function ServiceConfigSheet({
  open,
  onOpenChange,
  rateCard,
  orgId,
  isEditing,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rateCard: RateCard | null;
  orgId: string;
  isEditing: boolean;
  onSave: (data: any) => void;
}) {
  const [step, setStep] = useState(1);
  // Parse JSON fields if they exist
  const parseJsonField = (
    field: string | Record<string, any> | undefined,
  ): Record<string, any> => {
    if (!field) return {};
    if (typeof field === "string") {
      try {
        return JSON.parse(field);
      } catch {
        return {};
      }
    }
    return field;
  };

  // Parse custom_surcharges from cents to euros for display
  const parseSurchargesFromCents = (
    field: string | Record<string, any> | undefined,
  ): Record<string, number> => {
    if (!field) return {};
    let parsed: Record<string, any> = {};
    if (typeof field === "string") {
      try {
        parsed = JSON.parse(field);
      } catch {
        return {};
      }
    } else {
      parsed = field;
    }
    // Convert from cents to euros for display
    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number") {
        result[key] = value / 100; // Convert cents to euros
      }
    }
    return result;
  };

  // Parse supported_model_codes from JSON string or array
  const parseSupportedModels = (
    field: string | string[] | undefined,
  ): string[] => {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    if (typeof field === "string") {
      try {
        const parsed = JSON.parse(field);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const [formData, setFormData] = useState({
    service_type: (rateCard?.service_type || "IRRORAZIONE") as ServiceType,
    base_rate_per_ha_cents: rateCard?.base_rate_per_ha_cents || 1800,
    min_charge_cents: rateCard?.min_charge_cents || 25000,
    travel_fixed_cents: rateCard?.travel_fixed_cents || 0,
    travel_rate_per_km_cents: rateCard?.travel_rate_per_km_cents || 120,
    hilly_terrain_multiplier: rateCard?.hilly_terrain_multiplier || null,
    hilly_terrain_surcharge_cents: rateCard?.hilly_terrain_surcharge_cents || 0,
    custom_multipliers: parseJsonField(
      rateCard?.custom_multipliers_json,
    ) as Record<string, number>,
    custom_surcharges: parseSurchargesFromCents(
      rateCard?.custom_surcharges_json,
    ) as Record<string, number>, // In euros for display
    hourly_operator_rate_cents: rateCard?.hourly_operator_rate_cents || null,
    supported_model_codes: parseSupportedModels(
      (rateCard as any)?.supported_model_codes,
    ),
  });

  const config = serviceTypeConfig[formData.service_type];
  const Icon = config.icon;

  const handleSubmit = () => {
    // Filter out empty keys from multipliers and surcharges
    const cleanMultipliers: Record<string, number> = {};
    for (const [key, value] of Object.entries(formData.custom_multipliers)) {
      if (key.trim() && value !== undefined && value !== null) {
        cleanMultipliers[key.trim()] = value;
      }
    }

    // Convert surcharges from euros to cents and filter empty keys
    const cleanSurcharges: Record<string, number> = {};
    for (const [key, value] of Object.entries(formData.custom_surcharges)) {
      if (key.trim() && value !== undefined && value !== null) {
        cleanSurcharges[key.trim()] = Math.round(value * 100); // Convert euros to cents
      }
    }

    // Convert JSON fields back to strings for API
    const dataToSave: any = {
      service_type: formData.service_type,
      base_rate_per_ha_cents: formData.base_rate_per_ha_cents,
      min_charge_cents: formData.min_charge_cents,
      travel_fixed_cents: formData.travel_fixed_cents || 0,
      travel_rate_per_km_cents: formData.travel_rate_per_km_cents || null,
      hilly_terrain_multiplier: formData.hilly_terrain_multiplier || null,
      hilly_terrain_surcharge_cents:
        formData.hilly_terrain_surcharge_cents || 0,
      custom_multipliers_json:
        Object.keys(cleanMultipliers).length > 0
          ? JSON.stringify(cleanMultipliers)
          : null,
      custom_surcharges_json:
        Object.keys(cleanSurcharges).length > 0
          ? JSON.stringify(cleanSurcharges)
          : null,
      hourly_operator_rate_cents: formData.hourly_operator_rate_cents || null,
      supported_model_codes:
        formData.supported_model_codes.length > 0
          ? JSON.stringify(formData.supported_model_codes)
          : null,
    };

    // Include ID if editing
    if (rateCard?.id) {
      dataToSave.id = rateCard.id;
    }

    onSave(dataToSave);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto"
      >
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Icon className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <SheetTitle>
                {isEditing ? "Configura servizio" : "Nuovo servizio"}
              </SheetTitle>
              <SheetDescription>{config.label}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* STEP 1: Tipo servizio */}
          <div className="border rounded-lg p-4 bg-slate-50">
            <Label className="text-sm font-semibold text-slate-900 mb-3 block">
              Tipo servizio
            </Label>
            <div className="space-y-2">
              {(Object.keys(serviceTypeConfig) as ServiceType[]).map((type) => {
                const typeConfig = serviceTypeConfig[type];
                const TypeIcon = typeConfig.icon;
                return (
                  <label
                    key={type}
                    className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                      formData.service_type === type
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="service_type"
                      value={type}
                      checked={formData.service_type === type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          service_type: e.target.value as ServiceType,
                        })
                      }
                      className="sr-only"
                    />
                    <TypeIcon className="w-5 h-5 text-slate-600" />
                    <div>
                      <div className="font-medium text-slate-900">
                        {typeConfig.label}
                      </div>
                      <div className="text-xs text-slate-500">
                        {typeConfig.description}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* STEP 2: Modelli supportati */}
          <DronesSelector
            selectedModels={formData.supported_model_codes}
            onModelsChange={(models) =>
              setFormData({ ...formData, supported_model_codes: models })
            }
          />

          {/* STEP 3: Prezzi Base */}
          <div className="border rounded-lg p-4 bg-white">
            <Label className="text-sm font-semibold text-slate-900 mb-3 block">
              Prezzi Base
            </Label>
            <div className="space-y-4">
              <div>
                <Label htmlFor="base_rate">Prezzo base per ettaro</Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-slate-600">€</span>
                  <Input
                    id="base_rate"
                    type="number"
                    step="0.01"
                    value={formData.base_rate_per_ha_cents / 100}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        base_rate_per_ha_cents:
                          Math.round(parseFloat(e.target.value) * 100) || 0,
                      })
                    }
                    className="flex-1"
                  />
                  <span className="text-sm text-slate-600">/ ha</span>
                </div>
              </div>
              <div>
                <Label htmlFor="min_charge">Minimo intervento</Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-slate-600">€</span>
                  <Input
                    id="min_charge"
                    type="number"
                    step="0.01"
                    value={formData.min_charge_cents / 100}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        min_charge_cents:
                          Math.round(parseFloat(e.target.value) * 100) || 0,
                      })
                    }
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Importo minimo da addebitare anche per interventi piccoli
                </p>
              </div>
            </div>
          </div>

          {/* STEP 3.5: Costi di Trasporto */}
          <div className="border rounded-lg p-4 bg-white">
            <Label className="text-sm font-semibold text-slate-900 mb-3 block">
              Costi di Trasporto
            </Label>
            <div className="space-y-4">
              <div>
                <Label htmlFor="travel_fixed">Quota fissa trasporto</Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-slate-600">€</span>
                  <Input
                    id="travel_fixed"
                    type="number"
                    step="0.01"
                    value={formData.travel_fixed_cents / 100}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        travel_fixed_cents:
                          Math.round(parseFloat(e.target.value) * 100) || 0,
                      })
                    }
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Importo fisso aggiunto per ogni intervento (indipendente dalla
                  distanza)
                </p>
              </div>
              <div>
                <Label htmlFor="travel_rate">
                  Quota variabile per chilometro (opzionale)
                </Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-slate-600">€</span>
                  <Input
                    id="travel_rate"
                    type="number"
                    step="0.01"
                    value={(formData.travel_rate_per_km_cents || 0) / 100}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        travel_rate_per_km_cents:
                          Math.round(parseFloat(e.target.value) * 100) || 0,
                      })
                    }
                    className="flex-1"
                  />
                  <span className="text-sm text-slate-600">/ km</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Costo aggiuntivo per ogni chilometro di distanza dal campo
                  base
                </p>
              </div>
            </div>
          </div>

          {/* STEP 3.6: Moltiplicatori Terreno Collinare */}
          <div className="border rounded-lg p-4 bg-white">
            <Label className="text-sm font-semibold text-slate-900 mb-3 block">
              Terreno Collinare
            </Label>
            <div className="space-y-4">
              <div>
                <Label htmlFor="hilly_multiplier">
                  Moltiplicatore (opzionale)
                </Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id="hilly_multiplier"
                    type="number"
                    step="0.1"
                    min="1"
                    value={formData.hilly_terrain_multiplier || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hilly_terrain_multiplier: e.target.value
                          ? parseFloat(e.target.value)
                          : null,
                      })
                    }
                    className="flex-1"
                    placeholder="1.2"
                  />
                  <span className="text-sm text-slate-600">
                    × (es. 1.2 = +20%)
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Moltiplica il prezzo base per terreno collinare
                </p>
              </div>
              <div>
                <Label htmlFor="hilly_surcharge">
                  Maggiorazione fissa (opzionale)
                </Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-slate-600">€</span>
                  <Input
                    id="hilly_surcharge"
                    type="number"
                    step="0.01"
                    value={formData.hilly_terrain_surcharge_cents / 100}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hilly_terrain_surcharge_cents:
                          Math.round(parseFloat(e.target.value) * 100) || 0,
                      })
                    }
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Importo fisso aggiunto per terreno collinare (oltre al
                  moltiplicatore)
                </p>
              </div>
            </div>
          </div>

          {/* STEP 3.7: Moltiplicatori e Surcharge Personalizzate */}
          <div className="border rounded-lg p-4 bg-white">
            <Label className="text-sm font-semibold text-slate-900 mb-3 block">
              Moltiplicatori e Surcharge Personalizzate (Opzionale)
            </Label>
            <div className="space-y-6">
              {/* Moltiplicatori personalizzati */}
              <div>
                <Label className="text-sm font-medium text-slate-700 mb-2 block">
                  Moltiplicatori personalizzati
                </Label>
                <p className="text-xs text-slate-500 mb-3">
                  Aggiungi moltiplicatori per condizioni speciali (es: 1.15 =
                  +15%)
                </p>
                <div className="space-y-2">
                  {Object.entries(formData.custom_multipliers).map(
                    ([key, value], index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <Input
                          placeholder="Nome (es: obstacles)"
                          value={key}
                          onChange={(e) => {
                            const newMultipliers = {
                              ...formData.custom_multipliers,
                            };
                            delete newMultipliers[key];
                            if (e.target.value) {
                              newMultipliers[e.target.value] = value;
                            }
                            setFormData({
                              ...formData,
                              custom_multipliers: newMultipliers,
                            });
                          }}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Moltiplicatore (es: 1.15)"
                          value={value || ""}
                          onChange={(e) => {
                            const numValue = parseFloat(e.target.value);
                            if (!isNaN(numValue)) {
                              setFormData({
                                ...formData,
                                custom_multipliers: {
                                  ...formData.custom_multipliers,
                                  [key]: numValue,
                                },
                              });
                            }
                          }}
                          className="w-32"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newMultipliers = {
                              ...formData.custom_multipliers,
                            };
                            delete newMultipliers[key];
                            setFormData({
                              ...formData,
                              custom_multipliers: newMultipliers,
                            });
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ),
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        custom_multipliers: {
                          ...formData.custom_multipliers,
                          "": 1.0,
                        },
                      });
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Aggiungi moltiplicatore
                  </Button>
                </div>
              </div>

              {/* Surcharge personalizzate */}
              <div>
                <Label className="text-sm font-medium text-slate-700 mb-2 block">
                  Surcharge personalizzate
                </Label>
                <p className="text-xs text-slate-500 mb-3">
                  Aggiungi importi fissi aggiuntivi in euro
                </p>
                <div className="space-y-2">
                  {Object.entries(formData.custom_surcharges).map(
                    ([key, value], index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <Input
                          placeholder="Nome (es: urgent)"
                          value={key}
                          onChange={(e) => {
                            const newSurcharges = {
                              ...formData.custom_surcharges,
                            };
                            delete newSurcharges[key];
                            if (e.target.value) {
                              newSurcharges[e.target.value] = value;
                            }
                            setFormData({
                              ...formData,
                              custom_surcharges: newSurcharges,
                            });
                          }}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Importo (€)"
                          value={value || ""}
                          onChange={(e) => {
                            const numValue = parseFloat(e.target.value);
                            if (!isNaN(numValue)) {
                              setFormData({
                                ...formData,
                                custom_surcharges: {
                                  ...formData.custom_surcharges,
                                  [key]: numValue,
                                },
                              });
                            } else if (e.target.value === "") {
                              setFormData({
                                ...formData,
                                custom_surcharges: {
                                  ...formData.custom_surcharges,
                                  [key]: 0,
                                },
                              });
                            }
                          }}
                          className="w-32"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newSurcharges = {
                              ...formData.custom_surcharges,
                            };
                            delete newSurcharges[key];
                            setFormData({
                              ...formData,
                              custom_surcharges: newSurcharges,
                            });
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ),
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        custom_surcharges: {
                          ...formData.custom_surcharges,
                          "": 0,
                        },
                      });
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Aggiungi surcharge
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <SheetFooter className="mt-6 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            Salva servizio
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Componente per selezionare i droni
function DronesSelector({
  selectedModels,
  onModelsChange,
}: {
  selectedModels: string[];
  onModelsChange: (models: string[]) => void;
}) {
  const { data: drones = [], isLoading } = useQuery({
    queryKey: ["drones"],
    queryFn: fetchDrones,
  });

  const handleToggleDrone = (droneId: string) => {
    if (selectedModels.includes(droneId)) {
      onModelsChange(selectedModels.filter((id) => id !== droneId));
    } else {
      onModelsChange([...selectedModels, droneId]);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-white">
      <Label className="text-sm font-semibold text-slate-900 mb-3 block">
        Modelli compatibili
      </Label>
      {isLoading ? (
        <div className="text-sm text-slate-500">Caricamento droni...</div>
      ) : drones.length === 0 ? (
        <div className="text-sm text-slate-500">Nessun drone disponibile</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-2">
            {drones.map((drone) => {
              const isSelected = selectedModels.includes(drone.id);
              return (
                <button
                  key={drone.id}
                  type="button"
                  onClick={() => handleToggleDrone(drone.id)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    isSelected
                      ? "bg-emerald-100 border-emerald-300 text-emerald-800 font-medium"
                      : "bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {drone.brand} {drone.model}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            💡 Non è necessario possedere il modello per offrire il servizio
          </p>
        </>
      )}
    </div>
  );
}
