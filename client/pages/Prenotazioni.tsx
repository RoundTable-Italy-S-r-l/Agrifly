import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from '@/components/AdminLayout';
import { fetchBookings, Booking } from '@/lib/api';
import {
  ClipboardList,
  Calendar,
  Filter,
  Search,
  Droplet,
  Package,
  Map as MapIcon,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  X
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

const serviceTypeConfig = {
  SPRAY: { label: 'SPRAY', icon: Droplet, color: 'bg-blue-50 text-blue-700' },
  SPREAD: { label: 'SPREAD', icon: Package, color: 'bg-purple-50 text-purple-700' },
  MAPPING: { label: 'MAPPING', icon: MapIcon, color: 'bg-green-50 text-green-700' },
};

const statusConfig = {
  REQUESTED: { label: 'Richiesta', icon: AlertCircle, color: 'text-yellow-600' },
  CONFIRMED: { label: 'Confermata', icon: CheckCircle, color: 'text-blue-600' },
  IN_PROGRESS: { label: 'In corso', icon: Clock, color: 'text-emerald-600' },
  DONE: { label: 'Completata', icon: CheckCircle, color: 'text-green-600' },
  CANCELLED: { label: 'Annullata', icon: XCircle, color: 'text-red-600' },
};

export default function Prenotazioni() {
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<'today' | 'week' | 'month' | 'all'>('week');
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

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings', currentOrgId, periodFilter, statusFilter],
    queryFn: () => currentOrgId ? fetchBookings(currentOrgId, {
      period: periodFilter !== 'all' ? periodFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }) : Promise.resolve([]),
    enabled: !!currentOrgId,
  });

  const filteredBookings = bookings.filter(booking =>
    searchQuery === '' ||
    booking.buyer_org_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    booking.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
    booking.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const pendingBookings = bookings.filter(b => b.status === 'REQUESTED').length;
  const confirmedBookings = bookings.filter(b => b.status === 'CONFIRMED').length;
  const inProgressBookings = bookings.filter(b => b.status === 'IN_PROGRESS').length;

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
          <h1 className="text-3xl font-bold text-slate-900">Prenotazioni</h1>
          <p className="text-slate-600 mt-1">Booking in arrivo e pianificazione</p>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Da confermare</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pendingBookings}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Confermate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{confirmedBookings}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">In corso</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{inProgressBookings}</div>
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
                    <SelectItem value="today">Oggi</SelectItem>
                    <SelectItem value="week">Ultimi 7 giorni</SelectItem>
                    <SelectItem value="month">Questo mese</SelectItem>
                    <SelectItem value="all">Tutti</SelectItem>
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
                    <SelectItem value="REQUESTED">Richiesta</SelectItem>
                    <SelectItem value="CONFIRMED">Confermata</SelectItem>
                    <SelectItem value="IN_PROGRESS">In corso</SelectItem>
                    <SelectItem value="DONE">Completata</SelectItem>
                    <SelectItem value="CANCELLED">Annullata</SelectItem>
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

        {/* Lista prenotazioni */}
        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-2 text-slate-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
              <span className="text-sm">Caricamento prenotazioni...</span>
            </div>
          </div>
        ) : filteredBookings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-slate-600">Nessuna prenotazione trovata</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBookings.map((booking) => {
              const config = serviceTypeConfig[booking.service_type];
              const status = statusConfig[booking.status];
              const Icon = config.icon;
              const StatusIcon = status.icon;

              return (
                <Card key={booking.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded ${config.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{config.label}</CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {formatDate(booking.start_at)}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <StatusIcon className={`w-4 h-4 ${status.color}`} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-sm">
                      <span className="text-slate-600">Cliente:</span>
                      <div className="text-slate-900 font-medium">{booking.buyer_org_name}</div>
                    </div>
                    <div className="text-sm">
                      <span className="text-slate-600">Location:</span>
                      <div className="text-slate-900">{booking.location}</div>
                    </div>
                    <div className="text-sm">
                      <span className="text-slate-600">Modello:</span>
                      <div className="text-slate-900">{booking.model}</div>
                    </div>
                    <div className="pt-2 border-t">
                      <Badge variant="secondary" className={status.color}>
                        {status.label}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

