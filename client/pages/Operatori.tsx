import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/AdminLayout';
import { toast } from 'sonner';
import { fetchOperators, fetchOperator, createOperator, updateOperator, deleteOperator, Operator, CreateOperatorRequest, UpdateOperatorRequest } from '@/lib/api';
import {
  Users,
  MapPin,
  Clock,
  Calendar,
  Settings,
  Power,
  PowerOff,
  Droplet,
  Package,
  Map as MapIcon,
  Plus,
  Edit,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const serviceTypeIcons = {
  SPRAY: Droplet,
  SPREAD: Package,
  MAPPING: MapIcon,
};

export default function Operatori() {
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'operators' | 'availability'>('operators');

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

  const queryClient = useQueryClient();

  const { data: operators = [], isLoading } = useQuery({
    queryKey: ['operators', currentOrgId],
    queryFn: () => currentOrgId ? fetchOperators(currentOrgId) : Promise.resolve([]),
    enabled: !!currentOrgId,
  });

  const activeOperators = operators.filter(op => op.status === 'ACTIVE').length;

  // Mutation per creare operatore
  const createOperatorMutation = useMutation({
    mutationFn: (data: CreateOperatorRequest) =>
      currentOrgId ? createOperator(currentOrgId, data) : Promise.reject('No org ID'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operators', currentOrgId] });
      setCreateSheetOpen(false);
      toast.success('Operatore creato con successo!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Errore nella creazione dell\'operatore');
    }
  });

  // Mutation per aggiornare operatore
  const updateOperatorMutation = useMutation({
    mutationFn: ({ operatorId, data }: { operatorId: string, data: UpdateOperatorRequest }) =>
      currentOrgId ? updateOperator(currentOrgId, operatorId, data) : Promise.reject('No org ID'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operators', currentOrgId] });
      setEditSheetOpen(false);
      setEditingOperator(null);
      toast.success('Operatore aggiornato con successo!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Errore nell\'aggiornamento dell\'operatore');
    }
  });

  // Mutation per eliminare operatore
  const deleteOperatorMutation = useMutation({
    mutationFn: (operatorId: string) =>
      currentOrgId ? deleteOperator(currentOrgId, operatorId) : Promise.reject('No org ID'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operators', currentOrgId] });
      toast.success('Operatore eliminato con successo!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Errore nell\'eliminazione dell\'operatore');
    }
  });

  const handleOpenDetail = async (operator: Operator) => {
    if (!currentOrgId) return;
    try {
      const details = await fetchOperator(currentOrgId, operator.id);
      setSelectedOperator(operator);
      setDetailSheetOpen(true);
    } catch (error) {
      console.error('Errore nel caricamento dettagli operatore:', error);
      setSelectedOperator(operator);
      setDetailSheetOpen(true);
    }
  };

  if (!currentOrgId) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-600">Nessuna organizzazione selezionata</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Operatori</h1>
          <p className="text-slate-600 mt-1">Capacità, disponibilità e copertura territoriale</p>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Operatori attivi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{activeOperators}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Aree coperte</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {operators.filter(op => op.service_area_set_name).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Disponibili oggi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">—</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
          <TabsList>
            <TabsTrigger value="operators">Operatori</TabsTrigger>
            <TabsTrigger value="availability">Disponibilità (Calendario)</TabsTrigger>
          </TabsList>

          {/* Tab: Operatori */}
          <TabsContent value="operators" className="space-y-4">
            {/* Header con pulsante aggiungi */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Operatori dell'organizzazione</h2>
                <p className="text-sm text-slate-600">Gestisci capacità, disponibilità e copertura territoriale</p>
              </div>
              <Button onClick={() => setCreateSheetOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Aggiungi operatore
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center gap-2 text-slate-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
                  <span className="text-sm">Caricamento operatori...</span>
                </div>
              </div>
            ) : operators.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-slate-600 mb-4">Nessun operatore configurato</p>
                  <Button onClick={() => setCreateSheetOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Aggiungi operatore
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {operators.map((operator) => (
                  <OperatorCard
                    key={operator.id}
                    operator={operator}
                    onClick={() => handleOpenDetail(operator)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab: Disponibilità */}
          <TabsContent value="availability" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Calendario Team</CardTitle>
                <CardDescription>Vista settimanale disponibilità operatori</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[600px] bg-slate-50 rounded-lg flex items-center justify-center border-2 border-dashed border-slate-300">
                  <div className="text-center">
                    <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-600">Calendario team</p>
                    <p className="text-xs text-slate-500 mt-1">Integrazione calendario in fase di sviluppo</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Sheet dettaglio operatore */}
        {selectedOperator && (
          <OperatorDetailSheet
            operator={selectedOperator}
            open={detailSheetOpen}
            onOpenChange={setDetailSheetOpen}
            orgId={currentOrgId}
            onEdit={handleEditOperator}
            onDelete={handleDeleteOperator}
          />
        )}

        {/* Sheet creazione operatore */}
        <CreateOperatorSheet
          open={createSheetOpen}
          onOpenChange={setCreateSheetOpen}
          onSubmit={handleCreateOperator}
          isLoading={createOperatorMutation.isPending}
        />

        {/* Sheet modifica operatore */}
        {editingOperator && (
          <EditOperatorSheet
            operator={editingOperator}
            open={editSheetOpen}
            onOpenChange={setEditSheetOpen}
            onSubmit={handleUpdateOperator}
            isLoading={updateOperatorMutation.isPending}
          />
        )}
      </div>
    </AdminLayout>
  );

  // Funzioni helper
  function handleEditOperator(operator: Operator) {
    setEditingOperator(operator);
    setEditSheetOpen(true);
  }

  function handleDeleteOperator(operatorId: string) {
    if (confirm('Sei sicuro di voler eliminare questo operatore?')) {
      deleteOperatorMutation.mutate(operatorId);
    }
  }

  function handleCreateOperator(data: CreateOperatorRequest) {
    createOperatorMutation.mutate(data);
  }

  function handleUpdateOperator(operatorId: string, data: UpdateOperatorRequest) {
    updateOperatorMutation.mutate({ operatorId, data });
  }
}

// Componente Card Operatore
function OperatorCard({
  operator,
  onClick,
}: {
  operator: Operator;
  onClick: () => void;
}) {
  const isAvailable = operator.status === 'ACTIVE';

  return (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">
              {operator.first_name} {operator.last_name}
            </CardTitle>
            <CardDescription className="mt-1">{operator.email}</CardDescription>
          </div>
          <Badge variant={isAvailable ? "default" : "secondary"} className={isAvailable ? "bg-green-50 text-green-700" : ""}>
            {isAvailable ? 'ATTIVO' : 'INATTIVO'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Servizi */}
        <div>
          <Label className="text-xs text-slate-500 uppercase">Servizi</Label>
          <div className="flex flex-wrap gap-1 mt-1">
            {operator.service_tags.length > 0 ? (
              operator.service_tags.map((tag) => {
                const Icon = serviceTypeIcons[tag as keyof typeof serviceTypeIcons] || Droplet;
                return (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    <Icon className="w-3 h-3 mr-1" />
                    {tag}
                  </Badge>
                );
              })
            ) : (
              <span className="text-sm text-slate-400">Nessun servizio configurato</span>
            )}
          </div>
        </div>

        {/* Base */}
        {operator.home_location && (
          <div>
            <Label className="text-xs text-slate-500 uppercase">Base</Label>
            <div className="flex items-center gap-1 mt-1 text-sm text-slate-700">
              <MapPin className="w-3 h-3" />
              {operator.home_location}
            </div>
          </div>
        )}

        {/* Disponibilità oggi */}
        <div>
          <Label className="text-xs text-slate-500 uppercase">Oggi</Label>
          <div className="text-sm text-slate-700 mt-1">
            {isAvailable ? (
              <span className="text-green-600 font-medium">Libero</span>
            ) : (
              <span className="text-slate-400">Non disponibile</span>
            )}
            {operator.max_hours_per_day && (
              <span className="text-slate-500 ml-2">
                ({operator.max_hours_per_day}h disponibili)
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Componente Sheet dettaglio operatore
function OperatorDetailSheet({
  operator,
  open,
  onOpenChange,
  orgId,
  onEdit,
  onDelete,
}: {
  operator: Operator;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  onEdit: (operator: Operator) => void;
  onDelete: (operatorId: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {operator.first_name} {operator.last_name}
          </SheetTitle>
          <SheetDescription>{operator.email}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Profilo */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Profilo</h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-3">
              <div>
                <Label className="text-xs text-slate-500 uppercase">Servizi abilitati</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {operator.service_tags.map((tag) => {
                    const Icon = serviceTypeIcons[tag as keyof typeof serviceTypeIcons] || Droplet;
                    return (
                      <Badge key={tag} variant="secondary" className="px-3 py-1">
                        <Icon className="w-3 h-3 mr-1" />
                        {tag}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-500 uppercase">Base</Label>
                <div className="text-slate-900 mt-1">
                  {operator.home_location || 'Non specificata'}
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-500 uppercase">Modelli supportati</Label>
                <div className="text-slate-900 mt-1">Da configurare</div>
              </div>
            </div>
          </div>

          {/* Capacità */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Capacità</h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
              <div>
                <span className="text-slate-600">Max ore/giorno:</span>
                <div className="text-slate-900 mt-1 font-semibold">
                  {operator.max_hours_per_day ? `${operator.max_hours_per_day} h` : 'Non specificato'}
                </div>
              </div>
              <div>
                <span className="text-slate-600">Max ha/giorno:</span>
                <div className="text-slate-900 mt-1 font-semibold">
                  {operator.max_ha_per_day ? `${operator.max_ha_per_day} ha` : 'Non specificato'}
                </div>
              </div>
            </div>
          </div>

          {/* Territorio */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Territorio</h3>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-sm">
                <span className="text-slate-600">Area set default:</span>
                <div className="text-slate-900 mt-1 font-semibold">
                  {operator.service_area_set_name || 'Non configurato'}
                </div>
              </div>
            </div>
          </div>

          {/* Calendari */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Calendari</h3>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm text-slate-600">Collegamenti calendari esterni</p>
              <Button variant="outline" size="sm" className="mt-2">
                <Calendar className="w-4 h-4 mr-2" />
                Configura calendario
              </Button>
            </div>
          </div>

          {/* Azioni */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Azioni</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onEdit(operator)}
              >
                <Edit className="w-4 h-4 mr-2" />
                Modifica
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onDelete(operator.id)}
              >
                {operator.status === 'ACTIVE' ? (
                  <>
                    <PowerOff className="w-4 h-4 mr-2" />
                    Disattiva
                  </>
                ) : (
                  <>
                    <Power className="w-4 h-4 mr-2" />
                    Elimina
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Chiudi
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Componente Sheet creazione operatore
function CreateOperatorSheet({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateOperatorRequest) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<CreateOperatorRequest>({
    first_name: '',
    last_name: '',
    email: '',
    service_tags: [],
    max_hours_per_day: undefined,
    max_ha_per_day: undefined,
  });

  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      service_tags: selectedServices,
    });
  };

  const toggleService = (service: string) => {
    setSelectedServices(prev =>
      prev.includes(service)
        ? prev.filter(s => s !== service)
        : [...prev, service]
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Aggiungi Operatore Interno</SheetTitle>
          <SheetDescription>
            Crea un nuovo operatore interno. Potrai invitare l'operatore ad accedere più tardi se necessario.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Informazioni base */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Informazioni Personali</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">Nome</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder="Nome operatore"
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Cognome</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder="Cognome operatore"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email (opzionale)</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@esempio.com"
                />
                <p className="text-sm text-slate-500 mt-1">
                  Opzionale - puoi invitare l'operatore più tardi se vuoi che acceda al sistema
                </p>
              </div>
            </div>
          </div>

          {/* Servizi */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Servizi Abilitati</h3>
            <div className="space-y-2">
              {[
                { key: 'SPRAY', label: 'Trattamenti con drone', icon: Droplet },
                { key: 'SPREAD', label: 'Spargimento prodotti', icon: Package },
                { key: 'MAPPING', label: 'Mappatura territoriale', icon: MapIcon },
              ].map(({ key, label, icon: Icon }) => (
                <div key={key} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`service-${key}`}
                    checked={selectedServices.includes(key)}
                    onChange={() => toggleService(key)}
                    className="rounded border-slate-300"
                  />
                  <Label htmlFor={`service-${key}`} className="flex items-center gap-2 cursor-pointer">
                    <Icon className="w-4 h-4" />
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Capacità */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Capacità Giornaliere</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="max_hours">Ore massime al giorno</Label>
                <Input
                  id="max_hours"
                  type="number"
                  min="1"
                  max="24"
                  value={formData.max_hours_per_day || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    max_hours_per_day: e.target.value ? parseFloat(e.target.value) : undefined
                  }))}
                  placeholder="8"
                />
              </div>
              <div>
                <Label htmlFor="max_ha">Ettari massimi al giorno</Label>
                <Input
                  id="max_ha"
                  type="number"
                  min="1"
                  value={formData.max_ha_per_day || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    max_ha_per_day: e.target.value ? parseFloat(e.target.value) : undefined
                  }))}
                  placeholder="50"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Annulla
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? 'Creazione...' : 'Crea Operatore'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// Componente Sheet modifica operatore
function EditOperatorSheet({
  operator,
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: {
  operator: Operator;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (operatorId: string, data: UpdateOperatorRequest) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<UpdateOperatorRequest>({
    service_tags: operator.service_tags,
    max_hours_per_day: operator.max_hours_per_day,
    max_ha_per_day: operator.max_ha_per_day,
    status: operator.status,
  });

  const [selectedServices, setSelectedServices] = useState<string[]>(operator.service_tags);

  React.useEffect(() => {
    if (operator) {
      setFormData({
        service_tags: operator.service_tags,
        max_hours_per_day: operator.max_hours_per_day,
        max_ha_per_day: operator.max_ha_per_day,
        status: operator.status,
      });
      setSelectedServices(operator.service_tags);
    }
  }, [operator]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(operator.id, {
      ...formData,
      service_tags: selectedServices,
    });
  };

  const toggleService = (service: string) => {
    setSelectedServices(prev =>
      prev.includes(service)
        ? prev.filter(s => s !== service)
        : [...prev, service]
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Modifica Operatore</SheetTitle>
          <SheetDescription>
            {operator.first_name} {operator.last_name}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Servizi */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Servizi Abilitati</h3>
            <div className="space-y-2">
              {[
                { key: 'SPRAY', label: 'Trattamenti con drone', icon: Droplet },
                { key: 'SPREAD', label: 'Spargimento prodotti', icon: Package },
                { key: 'MAPPING', label: 'Mappatura territoriale', icon: MapIcon },
              ].map(({ key, label, icon: Icon }) => (
                <div key={key} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`edit-service-${key}`}
                    checked={selectedServices.includes(key)}
                    onChange={() => toggleService(key)}
                    className="rounded border-slate-300"
                  />
                  <Label htmlFor={`edit-service-${key}`} className="flex items-center gap-2 cursor-pointer">
                    <Icon className="w-4 h-4" />
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Capacità */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Capacità Giornaliere</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-max_hours">Ore massime al giorno</Label>
                <Input
                  id="edit-max_hours"
                  type="number"
                  min="1"
                  max="24"
                  value={formData.max_hours_per_day || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    max_hours_per_day: e.target.value ? parseFloat(e.target.value) : undefined
                  }))}
                  placeholder="8"
                />
              </div>
              <div>
                <Label htmlFor="edit-max_ha">Ettari massimi al giorno</Label>
                <Input
                  id="edit-max_ha"
                  type="number"
                  min="1"
                  value={formData.max_ha_per_day || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    max_ha_per_day: e.target.value ? parseFloat(e.target.value) : undefined
                  }))}
                  placeholder="50"
                />
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Stato</h3>
            <Select
              value={formData.status}
              onValueChange={(value: 'ACTIVE' | 'INACTIVE') =>
                setFormData(prev => ({ ...prev, status: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Attivo</SelectItem>
                <SelectItem value="INACTIVE">Inattivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Annulla
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? 'Salvataggio...' : 'Salva Modifiche'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

