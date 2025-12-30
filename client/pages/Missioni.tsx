import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/AdminLayout';
import { fetchJobOffers, fetchOperatorJobs, JobOffer, acceptJobOffer, getBookings } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
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
  X,
  Loader2
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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

export default function Missioni() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  // NUOVA LOGICA: usa permessi calcolati dinamicamente dal ruolo utente
  const [userPermissions, setUserPermissions] = useState<{
    can_access_services: boolean;
    can_access_bookings: boolean;
    can_complete_missions: boolean;
  } | null>(null);
  const [periodFilter, setPeriodFilter] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [acceptingOffer, setAcceptingOffer] = useState<string | null>(null);
  const [rejectingOffer, setRejectingOffer] = useState<string | null>(null);
  const [withdrawingOffer, setWithdrawingOffer] = useState<string | null>(null);
  const [offerToWithdraw, setOfferToWithdraw] = useState<{ jobId: string; offerId: string } | null>(null);

  // Determina se l'utente è un operatore/vendor (chi fa offerte, non chi le riceve)
  // Se mostra offerte "made", è un operatore/vendor view
  // NUOVA LOGICA: determina vista basata sui permessi utente
  const isOperatorView = userPermissions?.can_access_bookings || userPermissions?.can_complete_missions;

  useEffect(() => {
    const loadPermissions = () => {
      const orgData = localStorage.getItem('organization');
      const userData = localStorage.getItem('user');

      if (orgData && userData) {
        try {
          const org = JSON.parse(orgData);
          const user = JSON.parse(userData);

          setCurrentOrgId(org.id);

          // NUOVA LOGICA: calcola permessi dinamicamente dal ruolo utente
          const role = user.role || org.role || 'admin';
          const permissions = {
            can_access_services: false,
            can_access_bookings: false,
            can_complete_missions: false
          };

          if (role === 'admin' || role === 'dispatcher') {
            permissions.can_access_services = true;
            permissions.can_access_bookings = true;
            permissions.can_complete_missions = true;
          } else if (role === 'operator') {
            permissions.can_access_services = true;
            permissions.can_access_bookings = true;
            permissions.can_complete_missions = true;
          }

          setUserPermissions(permissions);
        } catch (error) {
          console.error('Errore nel parsing dei dati:', error);
        }
      } else {
        // Se non ci sono dati, riprova dopo un breve delay
        setTimeout(loadPermissions, 500);
      }
    };

    loadPermissions();

    // Ascolta i cambiamenti al localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'organization' || e.key === 'user') {
        loadPermissions();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const { data: jobOffers = { received: [], made: [] }, isLoading: loadingOffers } = useQuery({
    queryKey: ['jobOffers', currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return { received: [], made: [] };
      try {
        const result = await fetchJobOffers(currentOrgId);
        console.log('fetchJobOffers result:', result);
        return result;
      } catch (err) {
        console.warn('fetchJobOffers failed:', err);
        return { received: [], made: [] };
      }
    },
    enabled: !!currentOrgId,
  });

  const { data: availableJobs = { jobs: [] }, isLoading: loadingJobs } = useQuery({
    queryKey: ['operatorJobs'],
    queryFn: fetchOperatorJobs,
    enabled: !!(userPermissions?.can_access_bookings || userPermissions?.can_complete_missions), // Operator/dispatcher possono vedere job disponibili
  });

  // Fetch bookings for completed missions
  const { data: bookingsData = { bookings: [] }, isLoading: loadingBookings } = useQuery({
    queryKey: ['bookings', currentOrgId],
    queryFn: () => getBookings(currentOrgId!),
    enabled: !!currentOrgId,
  });

  // Determine which offers to show based on organization capabilities
  // NUOVA LOGICA: determina offerte da mostrare basata sui permessi
  const offersToShow = !userPermissions?.can_access_services && !userPermissions?.can_complete_missions
    ? (jobOffers.received || [])  // Buyer: show offers received on own jobs
    : (jobOffers.made || []);     // Operator: show offers made by organization

  // Filtra per stato: mostra solo offerte attive per default, rifiutate solo se filtrate
  // IMPORTANTE: escludi sempre le offerte AWARDED da questa lista (appariranno solo in "Offerte Accettate")
  const statusFilteredOffers = offersToShow?.filter(offer => {
    // Escludi sempre le offerte accettate dalla tab "Offerte Inviate"
    if (offer.status === 'AWARDED') {
      console.log('🚫 Esclusa offerta AWARDED dalla tab "Offerte Inviate":', offer.id);
      return false;
    }
    if (statusFilter === 'all') {
      return offer.status !== 'DECLINED' && offer.status !== 'WITHDRAWN'; // Escludi rifiutate per default
    }
    return offer.status === statusFilter || (statusFilter === 'REJECTED' && (offer.status === 'DECLINED' || offer.status === 'WITHDRAWN'));
  }) || [];
  
  // Debug: conta quante offerte AWARDED sono state escluse
  const excludedAwarded = offersToShow?.filter(o => o.status === 'AWARDED').length || 0;
  if (excludedAwarded > 0) {
    console.log(`🔍 Filtro applicato: ${excludedAwarded} offerta/e AWARDED escluse dalla tab "Offerte Inviate"`);
  }

  const filteredOffers = statusFilteredOffers?.filter(offer =>
    offer && offer.job && offer.job.buyer_org && offer.operator_org && (
      searchQuery === '' ||
      offer.job.buyer_org.legal_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      offer.operator_org.legal_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      offer.job.field_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      offer.id?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  ) || [];

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

  const handleAcceptOffer = async (jobId: string, offerId: string) => {
    try {
      setAcceptingOffer(offerId);
      await acceptJobOffer(jobId, offerId);
      // Ricarica le offerte dopo l'accettazione
      window.location.reload();
    } catch (error) {
      console.error('Errore nell\'accettazione dell\'offerta:', error);
      alert('Errore nell\'accettazione dell\'offerta');
    } finally {
      setAcceptingOffer(null);
    }
  };

  const handleRejectOffer = async (jobId: string, offerId: string) => {
    try {
      setRejectingOffer(offerId);

      // Chiamata API per rifiutare l'offerta
      const response = await fetch(`/api/jobs/${jobId}/reject-offer/${offerId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Errore nel rifiuto dell\'offerta');
      }

      // Aggiorna i dati localmente invece di ricaricare
      await queryClient.invalidateQueries({ queryKey: ['jobOffers'] });
      toast.success('Offerta rifiutata con successo');

    } catch (error) {
      console.error('Errore nel rifiuto dell\'offerta:', error);
      toast.error('Errore nel rifiuto dell\'offerta');
    } finally {
      setRejectingOffer(null);
    }
  };


  const handleViewOfferDetails = (offer: JobOffer) => {
    // Naviga alla pagina dettagli offerta
    navigate(`/admin/offer/${offer.id}`);
  };

  const pendingOffers = offersToShow?.filter(o => o.status === 'OFFERED').length || 0;
  
  // Offerte accettate: solo quelle AWARDED che NON hanno ancora un booking DONE
  const acceptedOffersList = offersToShow?.filter(offer => {
    if (offer.status !== 'AWARDED') return false;
    // Escludi se esiste un booking DONE per questa offerta
    const hasCompletedBooking = (bookingsData.bookings || []).some((booking: any) => 
      booking.accepted_offer_id === offer.id && 
      (booking.status === 'DONE' || booking.status === 'COMPLETED')
    );
    return !hasCompletedBooking;
  }) || [];
  const acceptedOffers = acceptedOffersList.length;
  
  const rejectedOffers = offersToShow?.filter(o => o.status === 'DECLINED' || o.status === 'WITHDRAWN').length || 0;

  // Calcola missioni completate per il contatore
  const completedMissions = (bookingsData.bookings || []).filter((booking: any) =>
    booking.status === 'DONE' || booking.status === 'COMPLETED'
  ).length || 0;

  if (!currentOrgId || userPermissions === null) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Caricamento capabilities...</p>
            <p className="text-xs text-slate-500 mt-2">
              Org ID: {currentOrgId || 'null'}, Permissions: {userPermissions ? 'calculated' : 'null'}
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const handleConfirmWithdraw = async () => {
    if (!offerToWithdraw) {
      console.error('❌ offerToWithdraw è null');
      return;
    }

    console.log('✅ Conferma ritiro offerta:', offerToWithdraw);
    
    try {
      setWithdrawingOffer(offerToWithdraw.offerId);
      const url = `/api/jobs/${offerToWithdraw.jobId}/withdraw-offer/${offerToWithdraw.offerId}`;
      console.log('📡 Chiamata API:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📥 Risposta API:', response.status, response.statusText);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Errore API:', error);
        throw new Error(error.message || error.error || 'Errore nel ritiro dell\'offerta');
      }

      const result = await response.json();
      console.log('✅ Offerta ritirata:', result);

      await queryClient.invalidateQueries({ queryKey: ['jobOffers'] });
      await queryClient.invalidateQueries({ queryKey: ['operatorJobs'] }); // Aggiorna anche i job disponibili
      toast.success('Offerta ritirata con successo');
      setOfferToWithdraw(null);
    } catch (error: any) {
      console.error('❌ Errore nel ritiro dell\'offerta:', error);
      toast.error(error.message || 'Errore nel ritiro dell\'offerta');
    } finally {
      setWithdrawingOffer(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Dialog di conferma ritiro offerta */}
        {offerToWithdraw && (
          <AlertDialog open={!!offerToWithdraw} onOpenChange={(open) => {
            console.log('🔄 AlertDialog onOpenChange:', open);
            if (!open) {
              setOfferToWithdraw(null);
            }
          }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Conferma ritiro offerta</AlertDialogTitle>
                <AlertDialogDescription>
                  Sei sicuro di voler ritirare questa offerta? Il job tornerà ad essere disponibile per nuove offerte.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => {
                  console.log('🚫 Annulla cliccato');
                  setOfferToWithdraw(null);
                }}>
                  Annulla
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    console.log('✅ Conferma cliccato');
                    handleConfirmWithdraw();
                  }}
                  disabled={!!withdrawingOffer}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {withdrawingOffer ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Ritirando...
                    </>
                  ) : (
                    'Conferma ritiro'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Missioni</h1>
          <p className="text-slate-600 mt-1">
            {!userPermissions?.can_access_services && !userPermissions?.can_complete_missions
              ? 'Offerte ricevute sui tuoi annunci'
              : 'Preventivi inviati in risposta ai job disponibili'
            }
          </p>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">
                {!userPermissions?.can_access_services && !userPermissions?.can_complete_missions ? 'Offerte ricevute' : 'Preventivi inviati'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{offersToShow?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">In attesa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pendingOffers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Accettate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{acceptedOffers}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="offerte" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="disponibili" className="flex items-center gap-2">
              Job Disponibili
              {availableJobs.jobs.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {availableJobs.jobs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="offerte" className="flex items-center gap-2">
              {!userPermissions?.can_access_services && !userPermissions?.can_complete_missions ? 'Offerte' : 'Offerte Inviate'}
              {(() => {
                // Conta solo le offerte non-AWARDED (quelle che appaiono nella tab)
                const nonAwardedCount = offersToShow?.filter(o => o.status !== 'AWARDED').length || 0;
                return nonAwardedCount > 0 ? (
                  <Badge variant="secondary" className="text-xs">
                    {nonAwardedCount}
                  </Badge>
                ) : null;
              })()}
            </TabsTrigger>
            <TabsTrigger value="accettate" className="flex items-center gap-2">
              Offerte Accettate
              {acceptedOffers > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {acceptedOffers}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="missioni" className="flex items-center gap-2">
              Missioni Completate
              {completedMissions > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {completedMissions}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="disponibili" className="space-y-6">
            {/* Job Disponibili */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" />
                  Job Disponibili
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingJobs ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : availableJobs.jobs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nessun job disponibile al momento</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {availableJobs.jobs.map((job: any) => (
                      <Card key={job.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold">{job.field_name}</h3>
                              <Badge variant="outline">{serviceTypeConfig[job.service_type]?.label || job.service_type}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>Cliente: {job.buyer_org.legal_name}</p>
                              <p>Area: {job.area_ha} ha</p>
                              <p>Creato: {new Date(job.created_at).toLocaleDateString('it-IT')}</p>
                              {job.terrain_conditions && (
                                <p>Condizioni: {job.terrain_conditions}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            {job.can_offer ? (
                              <Button
                                size="sm"
                                onClick={() => navigate(`/admin/offer/${job.id}`)}
                                className="whitespace-nowrap"
                              >
                                Fai Offerta
                              </Button>
                            ) : job.has_existing_offer ? (
                              <Badge variant="secondary">
                                Offerta {job.existing_offer_status?.toLowerCase()}
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                Non disponibile
                              </Badge>
                            )}
                          </div>
                        </div>
                        {job.filter_reasons && job.filter_reasons.length > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Motivi filtro: {job.filter_reasons.join(', ')}
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="offerte" className="space-y-6">
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
                    <SelectItem value="all">Attive</SelectItem>
                    <SelectItem value="OFFERED">Inviate</SelectItem>
                    <SelectItem value="AWARDED">Accettate</SelectItem>
                    <SelectItem value="REJECTED">Rifiutate</SelectItem>
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

        {/* Lista offerte */}
        {loadingOffers ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-2 text-slate-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
              <span className="text-sm">Caricamento offerte...</span>
            </div>
          </div>
        ) : filteredOffers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-slate-600">
                {!userPermissions?.can_access_services && !userPermissions?.can_complete_missions
                  ? 'Nessuna offerta ricevuta'
                  : 'Nessun preventivo inviato'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Campo</TableHead>
                  <TableHead className="hidden sm:table-cell">Servizio</TableHead>
                  <TableHead className="hidden md:table-cell">Periodo</TableHead>
                  {isOperatorView && <TableHead className="hidden lg:table-cell">Cliente</TableHead>}
                  <TableHead className="text-right w-[120px]">{isOperatorView ? 'Preventivo' : 'Offerta'}</TableHead>
                  <TableHead className="w-[140px]">Stato</TableHead>
                  <TableHead className="w-[200px]">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOffers.filter(offer => offer && offer.total_cents != null && offer.job && offer.job.buyer_org).map((offer) => {
                  const config = serviceTypeConfig[offer.job?.service_type as keyof typeof serviceTypeConfig];
                  const Icon = config?.icon || Package;

                  const getOfferStatusLabel = (status: string) => {
                    switch (status) {
                      case 'OFFERED': return {
                        label: isOperatorView ? 'In Attesa Risposta' : 'Da Valutare',
                        color: 'text-yellow-600'
                      };
                      case 'AWARDED': return { label: 'Accettata', color: 'text-green-600' };
                      case 'REJECTED': return { label: 'Rifiutata', color: 'text-red-600' };
                      case 'DECLINED': return { label: 'Rifiutata', color: 'text-red-600' };
                      case 'WITHDRAWN': return { label: 'Ritirata', color: 'text-gray-600' };
                      default: return { label: status, color: 'text-slate-600' };
                    }
                  };

                  const offerStatus = getOfferStatusLabel(offer.status);

                  return (
                    <TableRow key={offer.id} className="hover:bg-slate-50">
                      {/* Campo e area */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 p-1.5 rounded ${config?.color || 'bg-slate-50'}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{offer.job?.field_name || 'N/A'}</div>
                            <div className="text-sm text-slate-500">{offer.job?.area_ha || 0} ha</div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Servizio */}
                      <TableCell className="hidden sm:table-cell">
                        <div className="text-sm font-medium text-slate-900">{config?.label || offer.job?.service_type || 'N/A'}</div>
                        <div className="text-xs text-slate-500">{formatDate(offer.created_at)}</div>
                      </TableCell>

                      {/* Periodo */}
                      <TableCell className="hidden md:table-cell text-sm text-slate-600">
                        <div>{offer.proposed_start ? formatDate(offer.proposed_start) : 'N/A'}</div>
                        <div className="text-xs">a {offer.proposed_end ? formatDate(offer.proposed_end) : 'N/A'}</div>
                      </TableCell>

                      {/* Cliente (solo per operatori) */}
                      {isOperatorView && (
                        <TableCell className="hidden lg:table-cell">
                          <div className="text-sm font-medium text-slate-900">{offer.job?.buyer_org?.legal_name || 'N/A'}</div>
                        </TableCell>
                      )}

                      {/* Prezzo */}
                      <TableCell className="text-right">
                        <div className="text-lg font-bold text-slate-900">
                          {offer.total_cents != null ? `€${(offer.total_cents / 100).toFixed(2)}` : 'N/A'}
                        </div>
                      </TableCell>

                      {/* Stato */}
                      <TableCell>
                        <Badge variant="secondary" className={`${offerStatus.color} whitespace-nowrap`}>
                          {offerStatus.label}
                        </Badge>
                      </TableCell>

                      {/* Azioni */}
                      <TableCell>
                        <div className="flex gap-2">
                          {/* Per buyer: pulsanti Accetta/Rifiuta */}
                          {!isOperatorView && offer.status === 'OFFERED' && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleAcceptOffer(offer.job.id, offer.id)}
                                disabled={acceptingOffer}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                {acceptingOffer ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Accetta'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRejectOffer(offer.job.id, offer.id)}
                                disabled={rejectingOffer}
                                className="border-red-300 text-red-600 hover:bg-red-50"
                              >
                                {rejectingOffer ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Rifiuta'}
                              </Button>
                            </>
                          )}

                          {/* Per operatore/vendor: pulsanti Ritira/Modifica */}
                          {isOperatorView && offer.status === 'OFFERED' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  console.log('🔄 Cliccato Ritira per offerta:', offer.id);
                                  setOfferToWithdraw({ jobId: offer.job.id, offerId: offer.id });
                                }}
                                className="border-orange-300 text-orange-600 hover:bg-orange-50"
                              >
                                Ritira
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewOfferDetails(offer)}
                                className="border-blue-300 text-blue-600 hover:bg-blue-50"
                              >
                                Modifica
                              </Button>
                            </>
                          )}

                          {/* Stato badge aggiuntivi */}
                          {offer.status === 'AWARDED' && (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              Accettata
                            </Badge>
                          )}
                          {offer.status === 'DECLINED' && (
                            <Badge variant="default" className="bg-red-100 text-red-800">
                              Rifiutata
                            </Badge>
                          )}

                          {/* Pulsante Dettagli */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewOfferDetails(offer)}
                            className="text-slate-600 hover:text-slate-900"
                          >
                            Dettagli
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
          </TabsContent>

          <TabsContent value="accettate" className="space-y-6">
            {/* Offerte Accettate */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Offerte Accettate
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingOffers || loadingBookings ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : (() => {
                  // Filtra offerte accettate (status AWARDED) che NON hanno ancora un booking DONE
                  const acceptedOffersList = offersToShow?.filter(offer => {
                    if (offer.status !== 'AWARDED') return false;
                    // Escludi se esiste un booking DONE per questa offerta
                    const hasCompletedBooking = (bookingsData.bookings || []).some((booking: any) => 
                      booking.accepted_offer_id === offer.id && 
                      (booking.status === 'DONE' || booking.status === 'COMPLETED')
                    );
                    return !hasCompletedBooking;
                  }) || [];

                  if (!acceptedOffersList || acceptedOffersList.length === 0) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Nessuna offerta accettata al momento</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {acceptedOffersList.filter(offer => offer && offer.total_cents != null && offer.job && offer.job.buyer_org).map((offer) => {
                        const booking = (bookingsData.bookings || []).find((b: any) => b.accepted_offer_id === offer.id);
                        const config = serviceTypeConfig[offer.job?.service_type as keyof typeof serviceTypeConfig];
                        const Icon = config?.icon || Package;

                        if (!offer.job) return null;

                        return (
                          <Card key={offer.id} className="p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className={`p-2 rounded-lg ${config?.color || 'bg-slate-50'}`}>
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <h3 className="font-semibold">{offer.job.field_name || 'N/A'}</h3>
                                  <Badge variant="outline">{config?.label || offer.job.service_type}</Badge>
                                  <Badge className="bg-green-100 text-green-800">Accettata</Badge>
                                  {booking?.payment_status === 'PAID' && (
                                    <Badge className="bg-blue-100 text-blue-800">Pagata</Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground space-y-1">
                                  <p>Cliente: {offer.job.buyer_org?.legal_name || 'N/A'}</p>
                                  <p>Area: {offer.job.area_ha || 0} ha</p>
                                  <p className="font-semibold text-slate-900">
                                    Preventivo accettato: {offer.total_cents != null ? `€${(offer.total_cents / 100).toFixed(2)}` : 'N/A'}
                                  </p>
                                  <p>Data accettazione: {formatDate(offer.updated_at || offer.created_at)}</p>
                                  {booking?.payment_status && (
                                    <p>
                                      Pagamento:{' '}
                                      <span className={booking.payment_status === 'PAID' ? 'text-green-600 font-medium' : 'text-yellow-600'}>
                                        {booking.payment_status === 'PAID' ? 'Pagato ✓' :
                                         booking.payment_status === 'PENDING' ? 'In attesa' : booking.payment_status}
                                      </span>
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col gap-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => navigate(`/admin/offer/${offer.id}`)}
                                >
                                  Vedi Dettagli
                                </Button>
                                {booking?.payment_status === 'PAID' && booking?.job?.conversation?.id && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const conversationId = booking.job.conversation?.id;
                                      if (conversationId) {
                                        navigate(`/chat/${conversationId}`);
                                      }
                                    }}
                                  >
                                    Apri Chat
                                  </Button>
                                )}
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="missioni" className="space-y-6">
            {/* Missioni completate - solo booking con status DONE */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Missioni Completate
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingBookings ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : (() => {
                  // Filtra solo booking con status DONE o COMPLETED
                  const completedBookings = (bookingsData.bookings || []).filter((booking: any) => 
                    booking.status === 'DONE' || booking.status === 'COMPLETED'
                  );

                  if (completedBookings.length === 0) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Nessuna missione completata al momento</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {completedBookings.filter((booking: any) => booking && booking.job).map((booking: any) => {
                        const config = serviceTypeConfig[booking.service_type as keyof typeof serviceTypeConfig];
                        const Icon = config?.icon || Package;
                        
                        return (
                          <Card key={booking.id} className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className={`p-2 rounded-lg ${config?.color || 'bg-slate-50'}`}>
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <h3 className="font-semibold">{booking.job.field_name || 'Missione'}</h3>
                                  <Badge variant="outline">{config?.label || booking.service_type}</Badge>
                                  <Badge variant="default" className="bg-green-100 text-green-800">
                                    Completata
                                  </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground space-y-1">
                                  <p>
                                    {userPermissions?.can_complete_missions 
                                      ? `Cliente: ${booking.buyer_org?.legal_name || 'N/A'}`
                                      : `Operatore: ${booking.executor_org?.legal_name || 'N/A'}`}
                                  </p>
                                  <p>Area: {booking.job?.area_ha ? booking.job.area_ha.toFixed(1) : 'N/A'} ha</p>
                                  <p>Preventivo: {booking.accepted_offer?.total_cents ? `€${(booking.accepted_offer.total_cents / 100).toFixed(2)}` : 'N/A'}</p>
                                  <p>Completata: {booking.created_at ? new Date(booking.created_at).toLocaleDateString('it-IT') : 'N/A'}</p>
                                  {booking.payment_status && (
                                    <p>
                                      Pagamento:{' '}
                                      <span className={booking.payment_status === 'PAID' ? 'text-green-600 font-medium' : 'text-yellow-600'}>
                                        {booking.payment_status === 'PAID' ? 'Pagato ✓' :
                                         booking.payment_status === 'PENDING' ? 'In attesa' : booking.payment_status}
                                      </span>
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigate(`/admin/booking/${booking.id}`)}
                                >
                                  Dettagli
                                </Button>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}


