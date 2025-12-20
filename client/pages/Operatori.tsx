import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from '@/components/AdminLayout';
import { fetchOperators, fetchOperator, Operator } from '@/lib/api';
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

const serviceTypeIcons = {
  SPRAY: Droplet,
  SPREAD: Package,
  MAPPING: MapIcon,
};

export default function Operatori() {
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
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

  const { data: operators = [], isLoading } = useQuery({
    queryKey: ['operators', currentOrgId],
    queryFn: () => currentOrgId ? fetchOperators(currentOrgId) : Promise.resolve([]),
    enabled: !!currentOrgId,
  });

  const activeOperators = operators.filter(op => op.status === 'ACTIVE').length;

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
                  <Button>
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
          />
        )}
      </div>
    </AdminLayout>
  );
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
}: {
  operator: Operator;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
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
              <Button variant="outline" className="flex-1">
                <Edit className="w-4 h-4 mr-2" />
                Modifica
              </Button>
              <Button variant="outline" className="flex-1">
                {operator.status === 'ACTIVE' ? (
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

