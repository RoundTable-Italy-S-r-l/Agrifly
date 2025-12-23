import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from '@/components/AdminLayout';
import { fetchMissions, fetchMissionsStats, MissionHistory } from '@/lib/api';
import {
  Truck,
  MapPin,
  Calendar,
  Filter,
  Search,
  Droplet,
  Package,
  Map as MapIcon,
  Download,
  CheckCircle,
  Clock,
  XCircle,
  X,
  Edit
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';


const serviceTypeConfig = {
  SPRAY: { label: 'SPRAY', icon: Droplet, color: 'bg-blue-50 text-blue-700' },
  SPREAD: { label: 'SPREAD', icon: Package, color: 'bg-purple-50 text-purple-700' },
  MAPPING: { label: 'MAPPING', icon: MapIcon, color: 'bg-green-50 text-green-700' },
};

export default function Missioni() {
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [selectedMission, setSelectedMission] = useState<MissionHistory | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<'7d' | '30d' | 'season' | 'all'>('30d');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

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

  // Query per missioni
  const { data: missions = [], isLoading } = useQuery({
    queryKey: ['missions', currentOrgId, periodFilter, serviceFilter, statusFilter],
    queryFn: () => currentOrgId ? fetchMissions(currentOrgId, {
      period: periodFilter !== 'all' ? periodFilter : undefined,
      serviceType: serviceFilter !== 'all' ? serviceFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }) : Promise.resolve([]),
    enabled: !!currentOrgId,
  });

  // Query per statistiche
  const { data: stats } = useQuery({
    queryKey: ['missionsStats', currentOrgId],
    queryFn: () => currentOrgId ? fetchMissionsStats(currentOrgId) : Promise.resolve(null),
    enabled: !!currentOrgId,
  });

  // Filtra missioni per ricerca
  const filteredMissions = missions.filter(mission =>
    searchQuery === '' ||
    mission.buyer_org_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    mission.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
    mission.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatArea = (ha: number | null) => {
    if (!ha) return 'N/A';
    return `${ha.toFixed(1)} ha`;
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
          <h1 className="text-3xl font-bold text-slate-900">Missioni</h1>
          <p className="text-slate-600 mt-1">Storico e analisi interventi</p>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Missioni (periodo)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{filteredMissions.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Ettari totali</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {filteredMissions
                  .reduce((sum, m) => sum + (m.actual_area_ha || 0), 0)
                  .toFixed(1)} ha
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Ore volo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {filteredMissions
                  .reduce((sum, m) => sum + (m.actual_hours || 0), 0)
                  .toFixed(1)} h
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Ricavi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">—</div>
            </CardContent>
          </Card>
        </div>

        {/* Filtri */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-600" />
                <Label className="text-sm font-medium text-slate-700">Periodo:</Label>
                <Select value={periodFilter} onValueChange={(v: any) => setPeriodFilter(v)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Ultimi 7 giorni</SelectItem>
                    <SelectItem value="30d">Ultimi 30 giorni</SelectItem>
                    <SelectItem value="season">Stagione</SelectItem>
                    <SelectItem value="all">Tutti</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-slate-700">Servizio:</Label>
                <Select value={serviceFilter} onValueChange={setServiceFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti</SelectItem>
                    <SelectItem value="SPRAY">SPRAY</SelectItem>
                    <SelectItem value="SPREAD">SPREAD</SelectItem>
                    <SelectItem value="MAPPING">MAPPING</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-slate-700">Stato:</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti</SelectItem>
                    <SelectItem value="DONE">Completate</SelectItem>
                    <SelectItem value="IN_PROGRESS">In corso</SelectItem>
                    <SelectItem value="SCHEDULED">Programmate</SelectItem>
                    <SelectItem value="CANCELLED">Annullate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-600" />
                <Input
                  placeholder="Cerca cliente, luogo, ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Split View: Lista + Mappa */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lista missioni (sinistra) */}
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center gap-2 text-slate-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
                  <span className="text-sm">Caricamento missioni...</span>
                </div>
              </div>
            ) : filteredMissions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-slate-600">Nessuna missione trovata</p>
                </CardContent>
              </Card>
            ) : (
              filteredMissions.map((mission) => {
                const config = serviceTypeConfig[mission.service_type];
                const Icon = config.icon;
                return (
                  <MissionCard
                    key={mission.id}
                    mission={mission}
                    config={config}
                    Icon={Icon}
                    formatDate={formatDate}
                    formatArea={formatArea}
                    onClick={() => {
                      setSelectedMission(mission);
                      setDetailSheetOpen(true);
                    }}
                  />
                );
              })
            )}
          </div>

          {/* Mappa (destra) */}
          <div className="sticky top-8">
            <Card className="h-[600px]">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Mappa interventi</CardTitle>
              </CardHeader>
              <CardContent className="h-[calc(100%-80px)]">
                <div className="w-full h-full bg-slate-100 rounded-lg flex items-center justify-center border-2 border-dashed border-slate-300">
                  <div className="text-center">
                    <MapIcon className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-600">Mappa interventi</p>
                    <p className="text-xs text-slate-500 mt-1">Integrazione mappa in fase di sviluppo</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Sheet dettaglio missione */}
        {selectedMission && (
          <MissionDetailSheet
            mission={selectedMission}
            open={detailSheetOpen}
            onOpenChange={setDetailSheetOpen}
            formatDate={formatDate}
            formatArea={formatArea}
          />
        )}
      </div>
    </AdminLayout>
  );
}

// Componente Card Missione
function MissionCard({
  mission,
  config,
  Icon,
  formatDate,
  formatArea,
  onClick,
}: {
  mission: MissionHistory;
  config: { label: string; icon: any; color: string };
  Icon: any;
  formatDate: (date: string) => string;
  formatArea: (ha: number | null) => string;
  onClick: () => void;
}) {
  const statusConfig = {
    DONE: { label: 'Completata', icon: CheckCircle, color: 'text-green-600' },
    IN_PROGRESS: { label: 'In corso', icon: Clock, color: 'text-blue-600' },
    SCHEDULED: { label: 'Programmata', icon: Calendar, color: 'text-yellow-600' },
    CANCELLED: { label: 'Annullata', icon: XCircle, color: 'text-red-600' },
  };

  const status = statusConfig[mission.status] || statusConfig.SCHEDULED;
  const StatusIcon = status.icon;

  return (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded ${config.color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-slate-900">
                {formatDate(mission.executed_start_at)} · {config.label}
              </div>
              <div className="text-sm text-slate-600">{formatArea(mission.actual_area_ha)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusIcon className={`w-4 h-4 ${status.color}`} />
            <span className="text-xs text-slate-600">{status.label}</span>
          </div>
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <span className="font-medium">Operatore:</span>
            <span>{mission.operator}</span>
            <span className="text-slate-400">·</span>
            <span className="font-medium">Modello:</span>
            <span>{mission.model}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <MapPin className="w-3 h-3" />
            <span>{mission.location}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Componente Sheet dettaglio missione
function MissionDetailSheet({
  mission,
  open,
  onOpenChange,
  formatDate,
  formatArea,
}: {
  mission: MissionHistory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formatDate: (date: string) => string;
  formatArea: (ha: number | null) => string;
}) {
  const config = serviceTypeConfig[mission.service_type];
  const Icon = config.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <SheetTitle>Missione #{mission.id.slice(-8)}</SheetTitle>
              <SheetDescription>
                {config.label} · {formatDate(mission.executed_start_at)}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Info */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Info</h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
              <div>
                <span className="text-slate-600">Booking ID:</span>
                <div className="font-mono text-slate-900 mt-1">{mission.booking_id}</div>
              </div>
              <div>
                <span className="text-slate-600">Cliente:</span>
                <div className="text-slate-900 mt-1">{mission.buyer_org_name}</div>
              </div>
              <div>
                <span className="text-slate-600">Servizio:</span>
                <div className="text-slate-900 mt-1">{config.label}</div>
              </div>
              <div>
                <span className="text-slate-600">Data e durata:</span>
                <div className="text-slate-900 mt-1">
                  {formatDate(mission.executed_start_at)}
                  {mission.executed_end_at && ` → ${formatDate(mission.executed_end_at)}`}
                </div>
              </div>
              <div>
                <span className="text-slate-600">Operatore:</span>
                <div className="text-slate-900 mt-1">{mission.operator}</div>
              </div>
              <div>
                <span className="text-slate-600">Modello:</span>
                <div className="text-slate-900 mt-1">{mission.model}</div>
              </div>
              <div>
                <span className="text-slate-600">Location:</span>
                <div className="text-slate-900 mt-1">{mission.location}</div>
              </div>
            </div>
          </div>

          {/* Consuntivo */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Consuntivo</h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
              <div>
                <span className="text-slate-600">Ettari reali:</span>
                <div className="text-slate-900 mt-1 font-semibold">{formatArea(mission.actual_area_ha)}</div>
              </div>
              <div>
                <span className="text-slate-600">Ore reali:</span>
                <div className="text-slate-900 mt-1 font-semibold">
                  {mission.actual_hours ? `${mission.actual_hours.toFixed(1)} h` : 'N/A'}
                </div>
              </div>
              {mission.notes && (
                <div>
                  <span className="text-slate-600">Note:</span>
                  <div className="text-slate-900 mt-1">{mission.notes}</div>
                </div>
              )}
            </div>
          </div>

          {/* Azioni */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Azioni</h3>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Scarica report
              </Button>
              {mission.status === 'DONE' && (
                <Button variant="outline" className="flex-1">
                  <Edit className="w-4 h-4 mr-2" />
                  Correggi consuntivo
                </Button>
              )}
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

