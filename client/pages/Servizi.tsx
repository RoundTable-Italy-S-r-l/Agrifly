import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/AdminLayout';
import { fetchRateCards, RateCard, upsertRateCard, deleteRateCard } from '@/lib/api';
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
  Euro
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ServiceType = 'SPRAY' | 'SPREAD' | 'MAPPING';

const serviceTypeConfig: Record<ServiceType, { label: string; icon: any; description: string }> = {
  SPRAY: { label: 'Trattamento fitosanitario', icon: Droplet, description: 'SPRAY' },
  SPREAD: { label: 'Spandimento', icon: Package, description: 'SPREAD' },
  MAPPING: { label: 'Mappatura', icon: Map, description: 'MAPPING' },
};

export default function Servizi() {
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<RateCard | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();

  // Ottieni l'ID dell'organizzazione corrente
  useEffect(() => {
    const orgData = localStorage.getItem('organization');
    if (orgData) {
      try {
        const org = JSON.parse(orgData);
        setCurrentOrgId(org.id);
      } catch (error) {
        console.error('Errore nel parsing dei dati organizzazione:', error);
      }
    }
  }, []);

  // Query per rate cards
  const { data: rateCards = [], isLoading } = useQuery({
    queryKey: ['rateCards', currentOrgId],
    queryFn: () => currentOrgId ? fetchRateCards(currentOrgId) : Promise.resolve([]),
    enabled: !!currentOrgId,
  });

  // Mutation per creare/aggiornare rate card
  const upsertMutation = useMutation({
    mutationFn: ({ orgId, rateCard }: { orgId: string; rateCard: any }) =>
      upsertRateCard(orgId, rateCard),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rateCards', currentOrgId] });
      setSheetOpen(false);
      setSelectedService(null);
      setIsEditing(false);
    },
  });

  // Mutation per eliminare rate card
  const deleteMutation = useMutation({
    mutationFn: ({ orgId, serviceType }: { orgId: string; serviceType: string }) =>
      deleteRateCard(orgId, serviceType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rateCards', currentOrgId] });
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
    console.log('Duplica servizio:', rateCard);
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
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
          <p className="text-slate-600 mt-1">Configura la tua offerta di noleggio e intervento operativo</p>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Servizi attivi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{activeServices}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Aree coperte</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{coveredAreas}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Operatori attivi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{activeOperators}</div>
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
              <p className="text-slate-600 mb-4">Nessun servizio configurato</p>
              <Button onClick={() => handleCreateService('SPRAY')}>
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
                <h3 className="font-semibold text-slate-900">Aggiungi nuovo servizio</h3>
                <p className="text-sm text-slate-600 mt-1">Configura un nuovo tipo di intervento</p>
              </div>
              <div className="flex gap-2">
                {(Object.keys(serviceTypeConfig) as ServiceType[]).map((type) => {
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
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sheet per configurazione servizio */}
        {sheetOpen && (
          <ServiceConfigSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            rateCard={selectedService}
            orgId={currentOrgId!}
            isEditing={isEditing}
            onSave={(data) => upsertMutation.mutate({ orgId: currentOrgId!, rateCard: data })}
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
  formatPrice,
}: {
  rateCard: RateCard;
  config: { label: string; icon: any; description: string };
  Icon: any;
  onEdit: () => void;
  onDuplicate: () => void;
  formatPrice: (cents: number) => string;
}) {
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
              <CardDescription className="mt-1">{config.description}</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="bg-green-50 text-green-700">
            ATTIVO
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Modelli supportati - TODO: da implementare */}
        <div>
          <Label className="text-xs text-slate-500 uppercase">Modelli supportati</Label>
          <p className="text-sm text-slate-700 mt-1">DJI Agras T30 · T50 · T70P</p>
        </div>

        {/* Prezzo */}
        <div>
          <Label className="text-xs text-slate-500 uppercase">Prezzo</Label>
          <p className="text-sm text-slate-700 mt-1">
            {formatPrice(rateCard.base_rate_per_ha_cents)} / ha · minimo {formatPrice(rateCard.min_charge_cents)}
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
          <Button variant="outline" size="sm">
            <PowerOff className="w-4 h-4 mr-2" />
            Disattiva
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
  const [formData, setFormData] = useState({
    service_type: (rateCard?.service_type || 'SPRAY') as ServiceType,
    base_rate_per_ha_cents: rateCard?.base_rate_per_ha_cents || 1800,
    min_charge_cents: rateCard?.min_charge_cents || 25000,
    travel_rate_per_km_cents: rateCard?.travel_rate_per_km_cents || 120,
    hourly_operator_rate_cents: rateCard?.hourly_operator_rate_cents || null,
  });

  const config = serviceTypeConfig[formData.service_type];
  const Icon = config.icon;

  const handleSubmit = () => {
    onSave(formData);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Icon className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <SheetTitle>
                {isEditing ? 'Configura servizio' : 'Nuovo servizio'}
              </SheetTitle>
              <SheetDescription>
                {config.label}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* STEP 1: Tipo servizio */}
          <div>
            <Label className="text-sm font-semibold text-slate-900 mb-3 block">Tipo servizio</Label>
            <div className="space-y-2">
              {(Object.keys(serviceTypeConfig) as ServiceType[]).map((type) => {
                const typeConfig = serviceTypeConfig[type];
                const TypeIcon = typeConfig.icon;
                return (
                  <label
                    key={type}
                    className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                      formData.service_type === type
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="service_type"
                      value={type}
                      checked={formData.service_type === type}
                      onChange={(e) => setFormData({ ...formData, service_type: e.target.value as ServiceType })}
                      className="sr-only"
                    />
                    <TypeIcon className="w-5 h-5 text-slate-600" />
                    <div>
                      <div className="font-medium text-slate-900">{typeConfig.label}</div>
                      <div className="text-xs text-slate-500">{typeConfig.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* STEP 2: Modelli supportati - TODO: implementare */}
          <div>
            <Label className="text-sm font-semibold text-slate-900 mb-3 block">Modelli compatibili</Label>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="px-3 py-1">DJI Agras T30</Badge>
              <Badge variant="secondary" className="px-3 py-1">DJI Agras T50</Badge>
              <Badge variant="secondary" className="px-3 py-1">DJI Agras T70P</Badge>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              💡 Non è necessario possedere il modello per offrire il servizio
            </p>
          </div>

          {/* STEP 3: Prezzi */}
          <div>
            <Label className="text-sm font-semibold text-slate-900 mb-3 block">Prezzi</Label>
            <div className="space-y-4">
              <div>
                <Label htmlFor="base_rate">Prezzo base per ettaro</Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-slate-600">€</span>
                  <Input
                    id="base_rate"
                    type="number"
                    value={formData.base_rate_per_ha_cents / 100}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        base_rate_per_ha_cents: Math.round(parseFloat(e.target.value) * 100) || 0,
                      })
                    }
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="min_charge">Minimo intervento</Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-slate-600">€</span>
                  <Input
                    id="min_charge"
                    type="number"
                    value={formData.min_charge_cents / 100}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        min_charge_cents: Math.round(parseFloat(e.target.value) * 100) || 0,
                      })
                    }
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="travel_rate">Trasferta (opzionale)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-slate-600">€</span>
                  <Input
                    id="travel_rate"
                    type="number"
                    step="0.01"
                    value={formData.travel_rate_per_km_cents / 100}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        travel_rate_per_km_cents: Math.round(parseFloat(e.target.value) * 100) || 0,
                      })
                    }
                    className="flex-1"
                  />
                  <span className="text-sm text-slate-600">/ km</span>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 4: Territorio - TODO: implementare */}
          <div>
            <Label className="text-sm font-semibold text-slate-900 mb-3 block">Aree coperte</Label>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="px-3 py-1">Trento</Badge>
              <Badge variant="secondary" className="px-3 py-1">Rovereto</Badge>
              <Badge variant="secondary" className="px-3 py-1">Val di Non</Badge>
            </div>
            <Button variant="outline" size="sm" className="mt-2">
              <MapPin className="w-4 h-4 mr-2" />
              Modifica aree
            </Button>
          </div>

          {/* STEP 5: Operatori - TODO: implementare */}
          <div>
            <Label className="text-sm font-semibold text-slate-900 mb-3 block">Operatori assegnabili</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked className="rounded" />
                <span className="text-sm">Mario Rossi</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked className="rounded" />
                <span className="text-sm">Luca Bianchi</span>
              </label>
            </div>
          </div>

          {/* STEP 6: Stato */}
          <div>
            <Label className="text-sm font-semibold text-slate-900 mb-3 block">Stato</Label>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1">
                <Power className="w-4 h-4 mr-2" />
                ATTIVO
              </Button>
              <Button variant="outline" className="flex-1">
                <PowerOff className="w-4 h-4 mr-2" />
                DISATTIVATO
              </Button>
            </div>
          </div>
        </div>

        <SheetFooter className="mt-6 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleSubmit} className="bg-emerald-600 hover:bg-emerald-700">
            Salva servizio
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

