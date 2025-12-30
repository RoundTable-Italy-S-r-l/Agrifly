import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/AdminLayout';
import { fetchJobOffers, JobOffer, getBookings, completeMission, getConversationMessages, sendMessage, fetchOperatorJobs, createJobOffer, updateJobOffer, getDirections, RoutingResponse, fetchRateCards, estimateQuote, QuoteEstimateResponse, fetchServiceConfig } from '@/lib/api';
import { JobOfferChat } from '@/components/JobOfferChat';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, MapPin, Calendar, DollarSign, FileText, CheckCircle, XCircle, Clock, MessageSquare, Send, Map, Navigation, ExternalLink, User } from 'lucide-react';
import { toast } from 'sonner';
import JobFieldMap from './components/JobFieldMap';

// CSS per Leaflet
import 'leaflet/dist/leaflet.css';

// Componente per mostrare le informazioni di routing
const RoutingInfo = ({ routingData, compact = false }: { routingData: any; compact?: boolean }) => {
  if (!routingData) return null;

  return (
    <div>
      <div className={`flex items-center gap-2 ${compact ? 'mb-2' : 'mb-3'}`}>
        <Navigation className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-slate-600`} />
        <span className={`font-medium ${compact ? 'text-sm text-slate-600' : 'text-slate-700'}`}>
          Percorso dalla tua posizione
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-4 ${compact ? 'text-sm' : ''}`}>
          <div className="flex items-center gap-1">
            <MapPin className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-slate-500`} />
            <span className={`text-slate-700 ${compact ? '' : 'font-medium'}`}>
              {routingData.distance.text}
            </span>
          </div>
          {routingData.duration.value && (
            <div className="flex items-center gap-1">
              <Clock className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-slate-500`} />
              <span className="text-slate-700">{routingData.duration.text}</span>
            </div>
          )}
        </div>
        <div className={`flex items-center ${compact ? 'gap-1' : 'gap-2'}`}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(routingData.navigation_links.google_maps, '_blank')}
            className="text-xs h-7"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Maps
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(routingData.navigation_links.waze, '_blank')}
            className="text-xs h-7"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Waze
          </Button>
        </div>
      </div>
      {routingData.fallback && (
        <p className="text-xs text-amber-600 mt-1">
          *Distanza in linea d'aria. {compact ? 'GraphHopper' : 'Installa GraphHopper'} per percorsi stradali precisi.
        </p>
      )}
    </div>
  );
};

const serviceTypeConfig = {
  SPRAY: { label: 'Trattamento', icon: '💧' },
  SPREAD: { label: 'Spandimento', icon: '🌱' },
  MAPPING: { label: 'Mappatura', icon: '🗺️' },
};

export default function OfferDetail() {
  const { offerId } = useParams<{ offerId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [LeafletComponents, setLeafletComponents] = useState<any>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [completingMission, setCompletingMission] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isCreatingOffer, setIsCreatingOffer] = useState(false);
  const [offerFormData, setOfferFormData] = useState({
    total_cents: '',
    proposed_start: '',
    proposed_end: '',
    provider_note: ''
  });
  const [quoteEstimate, setQuoteEstimate] = useState<QuoteEstimateResponse | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [manualPriceOverride, setManualPriceOverride] = useState(false);
  const [jobLocation, setJobLocation] = useState<string>('Caricamento ubicazione...');
  const [operatorLocation, setOperatorLocation] = useState<{ lng: number; lat: number } | null>(null);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);

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

  const { data: jobOffers = { received: [], made: [] }, isLoading, error } = useQuery({
    queryKey: ['jobOffers', currentOrgId],
    queryFn: () => currentOrgId ? fetchJobOffers(currentOrgId).catch((err) => {
      console.warn('fetchJobOffers failed:', err);
      return { received: [], made: [] };
    }) : Promise.resolve({ received: [], made: [] }),
    enabled: !!currentOrgId,
  });

  // Fetch operator jobs to check if offerId is actually a jobId
  const { data: operatorJobsData = { jobs: [] }, isLoading: loadingOperatorJobs } = useQuery({
    queryKey: ['operatorJobs'],
    queryFn: fetchOperatorJobs,
    enabled: !!offerId,
  });

  // Fetch bookings to find the one associated with this offer
  const { data: bookingsData = { bookings: [] }, isLoading: loadingBookings } = useQuery({
    queryKey: ['bookings', currentOrgId],
    queryFn: () => currentOrgId ? getBookings(currentOrgId) : Promise.resolve({ bookings: [] }),
    enabled: !!currentOrgId && !!offerId,
  });

  // Dichiarazioni delle variabili calcolate che possono essere usate dagli hook successivi
  const allOffers = [...(jobOffers.received || []), ...(jobOffers.made || [])];
  const offer = allOffers.find(o => o.id === offerId);
  // Check if this offer is in the "made" list (user is the operator)
  const isMadeOffer = jobOffers.made?.some(o => o.id === offerId) || false;
  
  // Debug: log dell'offerta trovata
  useEffect(() => {
    if (offer) {
      console.log('🔍 [OFFER DEBUG] Offerta trovata:', {
        id: offer.id,
        status: offer.status,
        operator_org_id: offer.operator_org_id,
        operator_org: offer.operator_org,
        currentOrgId,
        isAWARDED: offer.status === 'AWARDED',
        isOperator: currentOrgId && (
          offer.operator_org_id === currentOrgId || 
          (offer.operator_org as any)?.id === currentOrgId
        )
      });
    } else {
      console.log('❌ [OFFER DEBUG] Offerta non trovata per ID:', offerId);
      console.log('📋 [OFFER DEBUG] Offerte disponibili:', {
        received: jobOffers.received?.length || 0,
        made: jobOffers.made?.length || 0,
        allIds: allOffers.map(o => o.id)
      });
    }
  }, [offer, currentOrgId, offerId]);

  // Cerca sempre il job: se è un'offerta esistente usa offer.job_id, altrimenti cerca per ID diretto
  let job = null;
  if (offer) {
    // Se è un'offerta esistente, trova il job associato
    job = operatorJobsData.jobs.find((j: any) => j.id === offer.job_id);
  } else {
    // Se non è un'offerta, cerca nei job disponibili per ID diretto
    job = operatorJobsData.jobs.find((j: any) => j.id === offerId);
  }

  // Se abbiamo un job ma non un'offerta, cerca se esiste già un'offerta OFFERED per questo job
  const existingOffer = job && !offer 
    ? jobOffers.made?.find((o: JobOffer) => o.job_id === job.id && o.status === 'OFFERED')
    : null;

  // Codice hardcoded rimosso - usa solo dati dal database


  // Trova il booking associato all'offerta accettata
  const booking = offer && offer.status === 'AWARDED' && bookingsData?.bookings
    ? bookingsData.bookings.find((b: any) => b.accepted_offer_id === offer.id)
    : null;

  // Debug log per booking
  useEffect(() => {
    if (offer && offer.status === 'AWARDED') {
      console.log('🔍 [BOOKING DEBUG] ==========================================');
      console.log('📋 Offer ID:', offer.id);
      console.log('📋 Offer Status:', offer.status);
      console.log('📋 Has Bookings Data:', !!bookingsData);
      console.log('📋 Bookings Count:', bookingsData?.bookings?.length || 0);
      console.log('📋 All Accepted Offer IDs:', bookingsData?.bookings?.map((b: any) => b.accepted_offer_id) || []);
      console.log('📋 Booking Found:', !!booking);
      if (booking) {
        console.log('📋 Booking ID:', booking.id);
        console.log('📋 Booking Status:', booking.status);
        console.log('📋 Booking Accepted Offer ID:', booking.accepted_offer_id);
      } else {
        console.log('⚠️ Booking NOT found for offer:', offer.id);
        console.log('📋 Looking for offer ID:', offer.id);
        console.log('📋 Available accepted_offer_ids:', bookingsData?.bookings?.map((b: any) => ({
          id: b.id,
          accepted_offer_id: b.accepted_offer_id,
          job_id: b.job_id
        })) || []);
      }
      console.log('🔍 [BOOKING DEBUG] ==========================================');
    }
  }, [offer, bookingsData, booking]);

  // Fetch conversation messages if booking exists and is paid
  const conversationId = booking?.job?.conversation?.id;
  const { data: messagesData = { messages: [] }, isLoading: loadingMessages } = useQuery({
    queryKey: ['conversationMessages', conversationId],
    queryFn: () => conversationId ? getConversationMessages(conversationId) : Promise.resolve({ messages: [] }),
    enabled: !!conversationId && booking?.payment_status === 'PAID' && booking?.job?.conversation?.status === 'OPEN',
    refetchInterval: 3000, // Poll every 3 seconds for new messages
  });

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesData.messages]);

  // Memoizza le coordinate del campo per evitare re-render della mappa
  // Estrai il polygon da field_polygon, location_json, o polygon
  const fieldCoordinates = useMemo(() => {
    if (!job) return null;
    
    // Prova diverse possibili posizioni del polygon
    const polygon = job.field_polygon || job.polygon || (job.location_json && typeof job.location_json === 'object' && job.location_json.polygon ? job.location_json.polygon : null);
    
    if (polygon) {
      return polygon;
    }
    
    // Se location_json è un array direttamente, usalo
    if (Array.isArray(job.location_json)) {
      return job.location_json;
    }
    
    // Se location_json è una stringa JSON, prova a parsarla
    if (typeof job.location_json === 'string') {
      try {
        const parsed = JSON.parse(job.location_json);
        if (parsed.polygon) return parsed.polygon;
        if (Array.isArray(parsed)) return parsed;
        if (parsed.coordinates) return parsed.coordinates;
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    return null;
  }, [job?.field_polygon, job?.polygon, job?.location_json]);

  // Calcola field_center_lng e field_center_lat se non presenti nel job
  const jobWithCenter = useMemo(() => {
    if (!job) return null;

    // Se già presenti, ritorna il job così com'è
    if (job.field_center_lng && job.field_center_lat) {
      return job;
    }

    // Calcola dal polygon
    const polygon = fieldCoordinates;
    if (polygon && Array.isArray(polygon) && polygon.length > 0) {
      try {
        // Gestisci diversi formati: [lng, lat] o [lat, lng]
        const firstPoint = polygon[0];
        if (Array.isArray(firstPoint) && firstPoint.length >= 2) {
          // Se il primo valore è > 10 e < 20, probabilmente è lng (Italia)
          let centerLng, centerLat;
          if (firstPoint[0] > 10 && firstPoint[0] < 20 && firstPoint[1] > 35 && firstPoint[1] < 48) {
            // Formato [lng, lat]
            let totalLng = 0, totalLat = 0;
            polygon.forEach((point: [number, number]) => {
              totalLng += point[0];
              totalLat += point[1];
            });
            centerLng = totalLng / polygon.length;
            centerLat = totalLat / polygon.length;
          } else {
            // Formato [lat, lng]
            let totalLat = 0, totalLng = 0;
            polygon.forEach((point: [number, number]) => {
              totalLat += point[0];
              totalLng += point[1];
            });
            centerLat = totalLat / polygon.length;
            centerLng = totalLng / polygon.length;
          }

          return {
            ...job,
            field_center_lng: centerLng,
            field_center_lat: centerLat
          };
        }
      } catch (e) {
        console.warn('Error calculating polygon center:', e);
      }
    }

    // Se location_json ha coordinates (GeoJSON Point)
    if (job.location_json && typeof job.location_json === 'object' && job.location_json.coordinates) {
      const coords = job.location_json.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        // GeoJSON usa [lng, lat]
        return {
          ...job,
          field_center_lng: coords[0],
          field_center_lat: coords[1]
        };
      }
    }

    return job;
  }, [job, fieldCoordinates]);

  // Query for routing directions
  const { data: routingData, isLoading: loadingRouting } = useQuery({
    queryKey: ['directions', operatorLocation, jobWithCenter?.field_center_lng, jobWithCenter?.field_center_lat],
    queryFn: () => {
      if (!operatorLocation || !jobWithCenter?.field_center_lng || !jobWithCenter?.field_center_lat) {
        return Promise.resolve(null);
      }
      return getDirections(operatorLocation, { lng: jobWithCenter.field_center_lng, lat: jobWithCenter.field_center_lat });
    },
    enabled: !!operatorLocation && !!jobWithCenter?.field_center_lng && !!jobWithCenter?.field_center_lat,
  });

  // Populate form with existing offer data when it loads
  useEffect(() => {
    if (existingOffer && !manualPriceOverride) {
      setOfferFormData({
        total_cents: (existingOffer.total_cents / 100).toFixed(2),
        proposed_start: existingOffer.proposed_start ? existingOffer.proposed_start.split('T')[0] : '',
        proposed_end: existingOffer.proposed_end ? existingOffer.proposed_end.split('T')[0] : '',
        provider_note: existingOffer.provider_note || ''
      });
    }
  }, [existingOffer?.id]); // Only run when existingOffer changes

  // Calculate quote estimate when job, operator location, and routing data are available
  useEffect(() => {
    const calculateQuote = async () => {
      // Don't calculate if we have an existing offer (user can still modify it)
      if (existingOffer || !jobWithCenter || !currentOrgId || loadingQuote || manualPriceOverride) {
        return;
      }

      // Wait for routing data if not available yet
      if (!routingData) {
        return;
      }

      try {
        setLoadingQuote(true);
        
        // Get rate card for this service type
        const rateCards = await fetchRateCards(currentOrgId);
        const rateCard = rateCards.find((rc: any) => rc.service_type === jobWithCenter.service_type);
        
        if (!rateCard) {
          console.warn('No rate card found for service type:', jobWithCenter.service_type);
          setLoadingQuote(false);
          return;
        }

        // Calculate distance in km from routing data
        const distanceKm = routingData.distance?.value 
          ? routingData.distance.value / 1000 // Convert meters to km
          : 20; // Fallback default

        // Call quote estimate API
        const estimate = await estimateQuote({
          seller_org_id: currentOrgId,
          service_type: jobWithCenter.service_type,
          area_ha: parseFloat(jobWithCenter.area_ha?.toString() || '0'),
          distance_km: distanceKm,
          is_hilly_terrain: false, // TODO: get from job if available
          has_obstacles: false, // TODO: get from job if available
          month: new Date().getMonth() + 1
        });

        setQuoteEstimate(estimate);
        
        // Auto-populate total_cents if not manually overridden
        if (!manualPriceOverride && estimate.total_estimated_cents) {
          setOfferFormData(prev => ({
            ...prev,
            total_cents: (estimate.total_estimated_cents / 100).toFixed(2)
          }));
        }
      } catch (error: any) {
        console.error('Error calculating quote estimate:', error);
        // Don't show error toast if rate card doesn't exist - it's expected for new operators
        if (error.message && !error.message.includes('not found')) {
          toast.error('Errore nel calcolo del preventivo automatico');
        }
      } finally {
        setLoadingQuote(false);
      }
    };

    calculateQuote();
  }, [jobWithCenter, currentOrgId, routingData, manualPriceOverride, existingOffer]);

  // Reset manual override when user starts editing price
  const handlePriceChange = (value: string) => {
    if (!manualPriceOverride && value !== offerFormData.total_cents) {
      setManualPriceOverride(true);
    }
    setOfferFormData({ ...offerFormData, total_cents: value });
  };

  // Get operator location (for routing calculations)
  useEffect(() => {
    // Evita di ripetere se già abbiamo una location o se job o currentOrgId non sono disponibili
    if (operatorLocation !== null || !job || !currentOrgId) {
      return;
    }

    const loadOperatorLocation = async () => {
      // Prima prova geolocalizzazione corrente
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setOperatorLocation({
              lng: position.coords.longitude,
              lat: position.coords.latitude
            });
          },
          async (error) => {
            console.warn('Geolocalizzazione non disponibile:', error.message);

            // Fallback: usa indirizzo base configurato nel service config
            try {
              const serviceConfig = await fetchServiceConfig(currentOrgId);

              if (serviceConfig.base_location_lat && serviceConfig.base_location_lng) {
                setOperatorLocation({
                  lng: serviceConfig.base_location_lng,
                  lat: serviceConfig.base_location_lat
                });
                console.log('✅ Usando indirizzo base configurato:', serviceConfig.base_location_address);
                return;
              }
            } catch (configError) {
              console.warn('❌ Errore caricamento service config:', configError);
            }

            // Ultimo fallback: Milano centro
            setOperatorLocation({
              lng: 9.1895, // Milano centro
              lat: 45.4641
            });
            console.log('⚠️ Usando fallback Milano centro');
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 300000 } // 5 min cache
        );
      } else {
        // Geolocation non supportata - usa service config o fallback
        try {
          const serviceConfig = await fetchServiceConfig(currentOrgId);

          if (serviceConfig.base_location_lat && serviceConfig.base_location_lng) {
            setOperatorLocation({
              lng: serviceConfig.base_location_lng,
              lat: serviceConfig.base_location_lat
            });
            console.log('✅ Usando indirizzo base configurato:', serviceConfig.base_location_address);
            return;
          }
        } catch (configError) {
          console.warn('❌ Errore caricamento service config:', configError);
        }

        // Fallback finale
        setOperatorLocation({
          lng: 9.1895, // Milano centro
          lat: 45.4641
        });
        console.log('⚠️ Usando fallback Milano centro');
      }
    };

    loadOperatorLocation();
  }, [job, currentOrgId]); // Aggiunto currentOrgId alle dipendenze

  // Calculate location when job is loaded
  useEffect(() => {
    if (job) {
      calculateLocation(job.location_json, job.field_polygon)
        .then(setJobLocation)
        .catch(() => setJobLocation('Ubicazione non disponibile'));
    }
  }, [job]);

  // Variabili calcolate

  // Commentato temporaneamente per evitare confusione
  // Se vuoi testare una offerta esistente, decommenta questo blocco
  /*
  if (!offer && offerId === 'test-offer-existing') {
    offer = {
      id: 'test-offer-123',
      job_id: '1e47a706-d0ae-447d-9dea-a3f624dae805',
      operator_org_id: 'hnyms7z1b',
      status: 'OFFERED',
      total_cents: 25000,
      currency: 'EUR',
      proposed_start: '2025-01-20T10:00:00Z',
      proposed_end: '2025-01-25T18:00:00Z',
      provider_note: 'Offerta di test per verificare il funzionamento dell\'interfaccia',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      job: {
        id: '1e47a706-d0ae-447d-9dea-a3f624dae805',
        field_name: 'Campo Test',
        service_type: 'SPRAY',
        area_ha: 2.5,
        location_json: null,
        target_date_start: '2025-01-20',
        target_date_end: '2025-01-25',
        notes: 'Campo di test per verificare il flusso delle offerte',
        status: 'OPEN',
        buyer_org: {
          id: 'test-buyer-org',
          legal_name: 'Azienda Agricola Test',
          org_type: 'FARM'
        }
      },
      operator_org: {
        id: 'hnyms7z1b',
        legal_name: 'Marco Rossi',
        org_type: 'OPERATOR'
      }
    };
  }
  */
  
  // Variabili calcolate (spostate dopo tutti gli hook per rispettare le regole di React)





  const handleSendMessage = async () => {
    if (!messageText.trim() || !conversationId) return;

    try {
      setSendingMessage(true);
      await sendMessage(conversationId, { body: messageText });
      setMessageText('');
      await queryClient.invalidateQueries({ queryKey: ['conversationMessages', conversationId] });
    } catch (error) {
      console.error('Errore nell\'invio del messaggio:', error);
      toast.error('Errore nell\'invio del messaggio');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleCompleteMission = async () => {
    if (!offer) return;

    setShowCompleteDialog(true);
  };

  const confirmCompleteMission = async () => {
    if (!offer) return;

    try {
      console.log('🚀 [COMPLETE MISSION] Starting mission completion:', { offerId: offer.id });
      setCompletingMission(true);
      setShowCompleteDialog(false);
      const result = await completeMission(offer.id);
      console.log('✅ [COMPLETE MISSION] Mission completed successfully:', result);
      toast.success('Missione completata con successo!');
      console.log('🔄 [COMPLETE MISSION] Invalidating queries...');
      await queryClient.invalidateQueries({ queryKey: ['bookings', currentOrgId] });
      await queryClient.invalidateQueries({ queryKey: ['jobOffers', currentOrgId] });
      await queryClient.invalidateQueries({ queryKey: ['job', offer.job_id] });
      console.log('🔄 [COMPLETE MISSION] Reloading page...');
      // Non navigare via, ma ricarica i dati per mostrare lo stato aggiornato
      window.location.reload();
    } catch (error: any) {
      console.error('❌ [COMPLETE MISSION] Errore nel completamento della missione:', error);
      toast.error(error.message || 'Errore nel completamento della missione');
    } finally {
      setCompletingMission(false);
    }
  };


  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateShort = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'OFFERED':
        return { label: 'Offerta Inviata', color: 'bg-yellow-100 text-yellow-800', icon: Clock };
      case 'AWARDED':
        return { label: 'Accettata', color: 'bg-green-100 text-green-800', icon: CheckCircle };
      case 'DECLINED':
        return { label: 'Rifiutata', color: 'bg-red-100 text-red-800', icon: XCircle };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-800', icon: Clock };
    }
  };

  // Carica Leaflet dinamicamente
  useEffect(() => {
    const loadLeaflet = async () => {
      try {
        const L = (await import('leaflet')).default;
        const { MapContainer, TileLayer, Polygon, Popup } = await import('react-leaflet');

        // Fix per gli icon markers di Leaflet
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        setLeafletComponents({ L, MapContainer, TileLayer, Polygon, Popup });
      } catch (error) {
        console.error('Errore nel caricamento di Leaflet:', error);
      }
    };

    loadLeaflet();
  }, []);

  // Inizializza la mappa quando l'offerta è caricata
  useEffect(() => {
    if (offer && LeafletComponents && mapRef.current) {
      const { L } = LeafletComponents;

      const map = L.map(mapRef.current).setView([45.4642, 9.1900], 10); // Centro Italia

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      // Disegna il poligono del campo se presente
      if (offer.job.field_polygon) {
        try {
          // Se è già un oggetto, usalo direttamente; altrimenti parsalo
          const polygonCoords = typeof offer.job.field_polygon === 'string' 
            ? JSON.parse(offer.job.field_polygon)
            : offer.job.field_polygon;
          
          if (Array.isArray(polygonCoords) && polygonCoords.length > 0) {
            const polygon = L.polygon(polygonCoords, {
              color: 'green',
              weight: 2,
              opacity: 0.8,
              fillOpacity: 0.2
            }).addTo(map);

            // Centra la mappa sul poligono
            map.fitBounds(polygon.getBounds());

            // Aggiungi popup
            polygon.bindPopup(`<b>${offer.job.field_name}</b><br/>Area: ${offer.job.area_ha} ha`);
          }
        } catch (error) {
          console.error('Errore nel parsing del poligono:', error);
        }
      }

      return () => {
        map.remove();
      };
    }
  }, [offer, LeafletComponents]);


  // Function to reverse geocode coordinates to city name
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'DJI-Agras-App/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Geocoding API error');
      }

      const data = await response.json();
      const address = data.address || {};
      const city = address.city || address.town || address.village || address.municipality;
      const region = address.state || address.region || address.county;

      if (city && region) {
        return `${city}, ${region}`;
      } else if (city) {
        return city;
      } else if (region) {
        return region;
      }

      return data.display_name?.split(',')[0] || `Coordinate: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (error) {
      console.warn('Reverse geocoding failed:', error);
      return `Coordinate: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  };

  // Calculate location from job data
  const calculateLocation = async (locationJson?: string, fieldPolygon?: any): Promise<string> => {
    try {
      const location = locationJson ? JSON.parse(locationJson) : null;
      if (location?.address) {
        return location.address;
      }

      if (location?.centroid) {
        const [lat, lng] = location.centroid;
        return `Centro campo salvato: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      }

      if (fieldPolygon) {
        try {
          const polygon = typeof fieldPolygon === 'string' ? JSON.parse(fieldPolygon) : fieldPolygon;
          if (Array.isArray(polygon) && polygon.length > 0) {
            let totalLat = 0;
            let totalLng = 0;
            polygon.forEach((point: [number, number]) => {
              totalLat += point[0];
              totalLng += point[1];
            });
            const centerLat = totalLat / polygon.length;
            const centerLng = totalLng / polygon.length;
            return `Centro campo salvato: ${centerLat.toFixed(6)}, ${centerLng.toFixed(6)}`;
          }
        } catch (e) {
          console.warn('Error calculating polygon center:', e);
        }
      }

      return 'Ubicazione non specificata';
    } catch {
      return 'Ubicazione non specificata';
    }
  };

  const getServiceLabel = (serviceType: string) => {
    switch (serviceType) {
      case 'AGRICULTURAL_SERVICES':
        return 'Servizi Agricoli';
      case 'SPRAY':
        return 'Trattamento fitosanitario';
      case 'FERTILIZE':
        return 'Spandimento fertilizzanti';
      case 'SPREAD':
        return 'Spandimento fertilizzanti';
      case 'MAPPING':
        return 'Mappatura territoriale';
      default:
        return serviceType;
    }
  };

  if (isLoading || loadingBookings || loadingOperatorJobs) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-500">Caricamento...</div>
        </div>
      </AdminLayout>
    );
  }




  // Se c'è un job disponibile, mostra sempre il layout con mappa GIS e form
  if (job) {

    const handleCreateOffer = async () => {
      if (!job || !offerFormData.total_cents) {
        toast.error('Inserisci almeno il prezzo totale');
        return;
      }

      try {
        setIsCreatingOffer(true);
        const totalCents = Math.round(parseFloat(offerFormData.total_cents) * 100);
        if (totalCents <= 0) {
          toast.error('Il prezzo deve essere maggiore di zero');
          return;
        }

        const offerData = {
          total_cents: totalCents,
          proposed_start: offerFormData.proposed_start || undefined,
          proposed_end: offerFormData.proposed_end || undefined,
          provider_note: offerFormData.provider_note || undefined
        };

        // Se esiste già un'offerta, aggiornala invece di crearne una nuova
        if (existingOffer) {
          await updateJobOffer(job.id, existingOffer.id, offerData);
          toast.success('Offerta aggiornata con successo!');
        } else {
          await createJobOffer(job.id, offerData);
          toast.success('Offerta creata con successo!');
        }

        await queryClient.invalidateQueries({ queryKey: ['jobOffers', currentOrgId] });
        await queryClient.invalidateQueries({ queryKey: ['operatorJobs'] });
        navigate('/admin/prenotazioni');
      } catch (error: any) {
        console.error('Errore nell\'operazione dell\'offerta:', error);
        toast.error(error.message || 'Errore nell\'operazione dell\'offerta');
      } finally {
        setIsCreatingOffer(false);
      }
    };

    const areaHa = job.area_ha ? Number(job.area_ha).toFixed(1) : '0.0';
    
    return (
      <AdminLayout>
        <div className="max-w-7xl mx-auto px-8 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/admin/prenotazioni')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Indietro
            </Button>
          </div>

          {/* Layout a Griglia - Alto Sinistra: Info Principali */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-4">
            {/* Alto Sinistra - Info Principali */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
              <div className="mb-4">
                <h1 className="text-3xl font-bold text-slate-900">{job.field_name}</h1>
                <div className="flex items-center gap-3 mt-3">
                  <Badge className="bg-blue-100 text-blue-800 text-sm px-3 py-1">
                    <Clock className="w-4 h-4 inline mr-1" />
                    <span className="font-medium">Aperto</span>
                  </Badge>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600 font-medium">ID</span>
                  <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{job.id.slice(-8)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600 font-medium">Creato</span>
                  <span className="text-slate-900">{new Date(job.created_at).toLocaleDateString('it-IT')}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600 font-medium">Area</span>
                  <span className="text-slate-900 font-semibold">{areaHa} ha</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600 font-medium">Servizio</span>
                  <span className="text-slate-900">{getServiceLabel(job.service_type)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600 font-medium">Ubicazione</span>
                  <span className="text-slate-900">{jobLocation}</span>
                </div>

                {/* Routing Information */}
                {operatorLocation && routingData && (
                  <div className="py-3 border-b border-slate-100">
                    <RoutingInfo routingData={routingData} compact={true} />
                  </div>
                )}

                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-600 font-medium">Periodo</span>
                  <span className="text-slate-900">
                    {job.requested_window_start && job.requested_window_end ? (
                      `${new Date(job.requested_window_start).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} - ${new Date(job.requested_window_end).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`
                    ) : (
                      'Da definire'
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Alto Destra - Routing Info */}
            <div className="bg-slate-50 rounded-xl shadow-sm border border-slate-200 p-6">
              {operatorLocation && routingData ? (
                <div>
                  <RoutingInfo routingData={routingData} compact={false} />
                </div>
              ) : operatorLocation === null ? (
                <div className="text-center py-4">
                  <Navigation className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 mb-2">Calcolo percorso...</p>
                  <p className="text-xs text-slate-400">Caricamento indirizzo base...</p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Navigation className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Calcolo percorso in corso...</p>
                </div>
              )}
            </div>

            {/* Mappa del Campo */}
            {fieldCoordinates && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Map className="w-5 h-5 text-slate-600" />
                  Mappa del Campo - {job.field_name}
                </h3>
                <JobFieldMap
                  fieldPolygon={fieldCoordinates}
                  fieldName={job.field_name}
                  areaHa={job.area_ha}
                />
              </div>
            )}

            {/* Alto Destra - Form Offerta */}
            <div className="bg-slate-50 rounded-xl shadow-sm border border-slate-200 p-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-slate-600" />
                {existingOffer ? 'Modifica Offerta' : 'Crea Offerta'}
              </h2>

              {existingOffer && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-blue-800 text-sm">
                    Hai già un'offerta per questo job. Puoi modificarla qui sotto.
                  </p>
                </div>
              )}

              {/* Quote Estimate Breakdown - Scontrino */}
              {!existingOffer && quoteEstimate && !loadingQuote && (
                <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Preventivo Consigliato</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Servizio base ({quoteEstimate.breakdown.areaHa.toFixed(2)} ha × €{(quoteEstimate.breakdown.baseRatePerHaCents / 100).toFixed(2)}/ha)</span>
                      <span className="font-mono">€{(quoteEstimate.breakdown.baseCents / 100).toFixed(2)}</span>
                    </div>
                    
                    {quoteEstimate.breakdown.seasonalMult !== 1 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Moltiplicatore stagionale (×{quoteEstimate.breakdown.seasonalMult.toFixed(2)})</span>
                        <span className="font-mono">€{(quoteEstimate.breakdown.seasonalAdjustedCents / 100).toFixed(2)}</span>
                      </div>
                    )}
                    
                    {quoteEstimate.breakdown.terrainMult !== 1 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Moltiplicatore terreno (×{quoteEstimate.breakdown.terrainMult.toFixed(2)})</span>
                        <span className="font-mono">€{(quoteEstimate.breakdown.multipliedCents / 100).toFixed(2)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between text-slate-600">
                      <span>Trasporto (fisso: €{(quoteEstimate.breakdown.travelFixedCents / 100).toFixed(2)} + variabile: €{(quoteEstimate.breakdown.travelVariableCents / 100).toFixed(2)})</span>
                      <span className="font-mono">€{(quoteEstimate.breakdown.travelCents / 100).toFixed(2)}</span>
                    </div>
                    
                    {quoteEstimate.breakdown.surchargesCents > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Maggiorazioni</span>
                        <span className="font-mono">€{(quoteEstimate.breakdown.surchargesCents / 100).toFixed(2)}</span>
                      </div>
                    )}
                    
                    <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between font-semibold text-slate-900">
                      <span>Totale</span>
                      <span className="font-mono">€{(quoteEstimate.breakdown.totalCents / 100).toFixed(2)}</span>
                    </div>
                    
                    {quoteEstimate.breakdown.totalCents === quoteEstimate.breakdown.minChargeCents && (
                      <p className="text-xs text-amber-600 mt-1">
                        * Applicato minimo intervento
                      </p>
                    )}
                  </div>
                </div>
              )}

              {!existingOffer && loadingQuote && (
                <div className="bg-slate-100 border border-slate-200 rounded-lg p-4 mb-4 text-center">
                  <p className="text-sm text-slate-600">Calcolo preventivo in corso...</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="total_cents" className="text-sm font-medium text-slate-700">
                      Prezzo Totale (€) *
                    </Label>
                    {quoteEstimate && !manualPriceOverride && (
                      <button
                        type="button"
                        onClick={() => {
                          setManualPriceOverride(true);
                          setOfferFormData(prev => ({ ...prev, total_cents: '' }));
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 underline"
                      >
                        Modifica manuale
                      </button>
                    )}
                  </div>
                  <Input
                    id="total_cents"
                    type="number"
                    step="0.01"
                    min="0"
                    value={offerFormData.total_cents}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    placeholder={loadingQuote ? "Calcolo..." : "0.00"}
                    className="w-full"
                  />
                  {quoteEstimate && !manualPriceOverride && (
                    <p className="text-xs text-slate-500 mt-1">
                      Prezzo calcolato automaticamente basato sulla tua configurazione
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="proposed_start" className="text-sm font-medium text-slate-700 mb-2 block">
                      Data Inizio Proposta
                    </Label>
                    <Input
                      id="proposed_start"
                      type="date"
                      value={offerFormData.proposed_start}
                      onChange={(e) => setOfferFormData({ ...offerFormData, proposed_start: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="proposed_end" className="text-sm font-medium text-slate-700 mb-2 block">
                      Data Fine Proposta
                    </Label>
                    <Input
                      id="proposed_end"
                      type="date"
                      value={offerFormData.proposed_end}
                      onChange={(e) => setOfferFormData({ ...offerFormData, proposed_end: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="provider_note" className="text-sm font-medium text-slate-700 mb-2 block">
                    Note Aggiuntive
                  </Label>
                  <textarea
                    id="provider_note"
                    value={offerFormData.provider_note}
                    onChange={(e) => setOfferFormData({ ...offerFormData, provider_note: e.target.value })}
                    placeholder="Aggiungi note o informazioni aggiuntive..."
                    className="w-full min-h-[100px] px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <Button
                  onClick={handleCreateOffer}
                  disabled={isCreatingOffer || !offerFormData.total_cents || offerFormData.total_cents === '' || parseFloat(offerFormData.total_cents) <= 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {isCreatingOffer 
                    ? (existingOffer ? 'Aggiornamento offerta...' : 'Creazione offerta...') 
                    : (existingOffer ? 'Aggiorna Offerta' : 'Crea Offerta')
                  }
                </Button>
              </div>
            </div>
          </div>

          {/* Layout a Griglia - Parte Inferiore */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Basso Sinistra - Mappa e Specifiche */}
            <div className="space-y-6">
              {/* Specifiche del Lavoro */}
              {(job.crop_type || job.treatment_type || job.terrain_conditions) && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                  <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-slate-600" />
                    Specifiche del Lavoro
                  </h2>
                  <div className="space-y-3">
                    {job.crop_type && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <span className="text-slate-600 font-medium">Coltura</span>
                        <span className="text-slate-900">{job.crop_type}</span>
                      </div>
                    )}
                    {job.treatment_type && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <span className="text-slate-600 font-medium">Trattamento</span>
                        <span className="text-slate-900">{job.treatment_type}</span>
                      </div>
                    )}
                    {job.terrain_conditions && (
                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-600 font-medium">Terreno</span>
                        <span className="text-slate-900">{job.terrain_conditions}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Basso Destra - Note Aggiuntive (se presenti) */}
            {job.constraints_json && (() => {
              try {
                const constraints = JSON.parse(job.constraints_json);
                if (constraints.notes || constraints.additional_info) {
                  return (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                      <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-slate-600" />
                        Note Aggiuntive
                      </h2>
                      <div className="text-slate-900 whitespace-pre-wrap">
                        {constraints.notes || constraints.additional_info}
                      </div>
                    </div>
                  );
                }
              } catch (e) {
                return null;
              }
              return null;
            })()}
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!offer && !job) {
    return (
      <AdminLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="text-center py-12">
            <div className="text-slate-500 mb-4">Offerta o Job non trovato</div>
            <Button onClick={() => navigate('/admin/prenotazioni')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Torna alle Missioni
            </Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const statusConfig = getStatusConfig(offer.status);
  const StatusIcon = statusConfig.icon;
  const serviceConfig = serviceTypeConfig[offer.job.service_type as keyof typeof serviceTypeConfig] || { label: offer.job.service_type, icon: '🔧' };
  
  // Debug: verifica se la chat dovrebbe essere visibile
  const shouldShowChat = offer && offer.status === 'AWARDED' && currentOrgId;
  if (shouldShowChat) {
    console.log('💬 Chat should be visible:', {
      offerId: offer.id,
      status: offer.status,
      currentOrgId,
      hasJob: !!offer.job,
      buyerOrgId: offer.job?.buyer_org?.id || (offer.job as any)?.buyer_org_id,
      operatorOrgId: offer.operator_org_id || (offer.operator_org as any)?.id
    });
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin/prenotazioni')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Indietro
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dettagli Offerta</h1>
            <p className="text-slate-600">ID: {offer.id}</p>
          </div>
          <div className="ml-auto">
            <Badge className={`${statusConfig.color} flex items-center gap-1`}>
              <StatusIcon className="w-3 h-3" />
              {statusConfig.label}
            </Badge>
          </div>
        </div>

        {/* Informazioni principali - Layout migliorato */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Campo e Area */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="w-4 h-4" />
                Campo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-slate-900 mb-2">{offer.job.field_name}</div>
              <div className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{Number(offer.job.area_ha).toFixed(1)}</span> ettari
              </div>
            </CardContent>
          </Card>

          {/* Servizio */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-lg">{serviceConfig.icon}</span>
                Servizio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold text-slate-900 mb-2">{serviceConfig.label}</div>
              {offer.job.crop_type && (
                <div className="text-sm text-slate-600 mb-1">
                  <span className="font-medium">Coltura:</span> {offer.job.crop_type}
                </div>
              )}
              {offer.job.treatment_type && (
                <div className="text-sm text-slate-600">
                  <span className="font-medium">Trattamento:</span> {offer.job.treatment_type}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Condizioni Terreno */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="w-4 h-4" />
                Terreno
              </CardTitle>
            </CardHeader>
            <CardContent>
              {offer.job.terrain_conditions ? (
                <div className="text-slate-900">{offer.job.terrain_conditions}</div>
              ) : (
                <div className="text-slate-400 italic">Non specificato</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Mappa del Campo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Mappa del Campo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              ref={mapRef}
              className="w-full h-64 rounded-lg border border-slate-200"
              style={{ background: '#f8f9fa' }}
            />
            {offer.job.field_polygon && (
              <div className="mt-2 text-sm text-slate-600">
                Campo di <span className="font-semibold">{Number(offer.job.area_ha).toFixed(1)}</span> ettari
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dettagli economici e Periodo - Layout a griglia */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Preventivo Economico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900 mb-2">
                €{(offer.total_cents / 100).toFixed(2)}
              </div>
              <div className="text-sm text-slate-600">Prezzo totale proposto</div>
              {offer.job.area_ha && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <div className="text-xs text-slate-500">Prezzo per ettaro</div>
                  <div className="text-lg font-semibold text-slate-700">
                    €{((offer.total_cents / 100) / Number(offer.job.area_ha)).toFixed(2)}/ha
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Periodo Proposto
              </CardTitle>
            </CardHeader>
            <CardContent>
              {offer.proposed_start && offer.proposed_end ? (
                <>
                  <div className="text-lg font-semibold text-slate-900 mb-1">
                    {formatDateShort(offer.proposed_start)}
                  </div>
                  <div className="text-xs text-slate-500 mb-2">
                    {new Date(offer.proposed_start).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-sm text-slate-600 mb-1">fino a</div>
                  <div className="text-lg font-semibold text-slate-900 mb-1">
                    {formatDateShort(offer.proposed_end)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(offer.proposed_end).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </>
              ) : (
                <div className="text-slate-400 italic">Periodo da definire</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Organizzazioni coinvolte */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-semibold text-lg text-slate-900 mb-1">{offer.job.buyer_org.legal_name}</div>
              <div className="text-sm text-slate-600">Organizzazione richiedente</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Operatore
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-semibold text-lg text-slate-900 mb-1">{offer.operator_org.legal_name}</div>
              <div className="text-sm text-slate-600">Organizzazione offerente</div>
            </CardContent>
          </Card>
        </div>

        {/* Note del job (buyer) */}
        {offer.job.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Note del Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-slate-900 whitespace-pre-wrap">{offer.job.notes}</div>
            </CardContent>
          </Card>
        )}

        {/* Note operatore */}
        {offer.provider_note && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Note dell'Operatore
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-slate-900 whitespace-pre-wrap">{offer.provider_note}</div>
            </CardContent>
          </Card>
        )}

        {/* Informazioni tecniche e dettagli lavoro */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Dettagli Lavoro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {offer.job.crop_type && (
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600 font-medium">Coltura</span>
                  <span className="text-slate-900 font-semibold">{offer.job.crop_type}</span>
                </div>
              )}
              {offer.job.treatment_type && (
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600 font-medium">Trattamento</span>
                  <span className="text-slate-900 font-semibold">{offer.job.treatment_type}</span>
                </div>
              )}
              {offer.job.terrain_conditions && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-600 font-medium">Condizioni Terreno</span>
                  <span className="text-slate-900 font-semibold">{offer.job.terrain_conditions}</span>
                </div>
              )}
              {!offer.job.crop_type && !offer.job.treatment_type && !offer.job.terrain_conditions && (
                <div className="text-slate-400 italic text-sm">Nessun dettaglio specificato</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Informazioni Tecniche
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Data creazione:</span>
                <span className="text-slate-900 font-semibold">{formatDate(offer.created_at)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-600 font-medium">Ultimo aggiornamento:</span>
                <span className="text-slate-900 font-semibold">{formatDate(offer.updated_at)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Completa Missione - Mostra quando offerta è AWARDED e l'utente è l'operatore */}
        {offer && offer.status === 'AWARDED' && isMadeOffer && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Stato Missione
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-green-900">Offerta Accettata</span>
                </div>
                <p className="text-sm text-green-700">
                  La tua offerta è stata accettata dal cliente. Completa la missione quando il lavoro è stato eseguito.
                </p>
              </div>
              
              {booking && booking.status === 'DONE' ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <span className="font-semibold text-emerald-900">Missione Completata</span>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={handleCompleteMission}
                  disabled={completingMission}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {completingMission ? 'Completamento...' : 'Completa Missione'}
                </Button>
              )}

              {booking && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                  <div>
                    <div className="text-sm font-medium text-slate-500 mb-1">Stato Booking</div>
                    <Badge variant={booking.status === 'DONE' ? 'default' : 'secondary'}>
                      {booking.status === 'CONFIRMED' ? 'Confermata' :
                       booking.status === 'IN_PROGRESS' ? 'In corso' :
                       booking.status === 'DONE' ? 'Completata' : booking.status}
                    </Badge>
                  </div>
                  {booking.payment_status && (
                    <div>
                      <div className="text-sm font-medium text-slate-500 mb-1">Pagamento</div>
                      <Badge className={booking.payment_status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                        {booking.payment_status === 'PAID' ? 'Pagato ✓' :
                         booking.payment_status === 'PENDING' ? 'In attesa' : booking.payment_status}
                      </Badge>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Chat se offerta accettata - nuova chat per offerte */}
        {(() => {
          const shouldShowChat = offer && offer.status === 'AWARDED' && currentOrgId;
          console.log('💬 [OFFER DETAIL] Chat visibility check:', {
            offer: !!offer,
            offerStatus: offer?.status,
            currentOrgId,
            shouldShowChat
          });

          return shouldShowChat && (
            <JobOfferChat
              offerId={offer.id}
              currentOrgId={currentOrgId}
              currentUserId={undefined}
              buyerOrgId={offer.job?.buyer_org?.id || (offer.job as any)?.buyer_org_id || ''}
              operatorOrgId={offer.operator_org_id || (offer.operator_org as any)?.id || currentOrgId}
            />
          );
        })()}

      </div>

      {/* AlertDialog per conferma completamento missione */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Completamento Missione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler completare questa missione? Il lavoro sarà marcato come completato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCompleteMission} className="bg-emerald-600 hover:bg-emerald-700">
              Completa Missione
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
