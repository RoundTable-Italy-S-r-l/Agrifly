import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BuyerLayout } from "@/components/BuyerLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  MapPin,
  Calendar,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  User,
  Euro,
  Phone,
  Mail,
  Map,
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import JobFieldMap from "./components/JobFieldMap";

interface Job {
  id: string;
  buyer_org_id?: string;
  field_name: string;
  service_type: string;
  crop_type?: string;
  treatment_type?: string;
  terrain_conditions?: string;
  field_polygon: any;
  area_ha: number;
  location_json?: string;
  requested_window_start?: string;
  requested_window_end?: string;
  constraints_json?: any;
  status: string;
  created_at: string;
  updated_at: string;
  offers: Offer[];
}

interface Offer {
  id: string;
  total_cents: number;
  currency: string;
  proposed_start?: string;
  proposed_end?: string;
  provider_note?: string;
  status: string;
  created_at: string;
  operator_org: {
    id: string;
    legal_name: string;
    email?: string;
    phone?: string;
  };
}

const DettagliJobBuyer = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [jobLocation, setJobLocation] = useState<string>(
    "Caricamento ubicazione...",
  );
  const [offerToAccept, setOfferToAccept] = useState<string | null>(null);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Carica currentOrgId e currentUserId dal localStorage
  useEffect(() => {
    const orgData = localStorage.getItem("organization");
    const userData = localStorage.getItem("user");

    if (orgData) {
      try {
        const org = JSON.parse(orgData);
        setCurrentOrgId(org.id);
        console.log("💬 DettagliJobBuyer - currentOrgId impostato:", org.id);
      } catch (error) {
        console.error("Errore parsing organization:", error);
      }
    }

    if (userData) {
      try {
        const user = JSON.parse(userData);
        setCurrentUserId(user.id);
      } catch (error) {
        console.error("Errore parsing user:", error);
      }
    }
  }, []);

  const {
    data: job,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const response = await fetch(`/api/jobs/${jobId}`, {
        headers: getAuthHeaders(),
      });

      if (response.status === 403) {
        throw new Error("Non hai i permessi per visualizzare questo job");
      }

      if (!response.ok) {
        throw new Error("Errore nel caricamento del job");
      }

      return response.json();
    },
    enabled: !!jobId,
  });

  // Calculate location when job is loaded
  useEffect(() => {
    if (job) {
      calculateLocation(job.location_json, job.field_polygon)
        .then(setJobLocation)
        .catch(() => setJobLocation("Ubicazione non disponibile"));

      // Debug: verifica se la chat dovrebbe essere visibile
      const awardedOffer = job.offers?.find((o: any) => o.status === "AWARDED");
      if (awardedOffer && currentOrgId) {
        console.log("💬 Chat should be visible in DettagliJobBuyer:", {
          offerId: awardedOffer.id,
          offerStatus: awardedOffer.status,
          currentOrgId,
          buyerOrgId: job.buyer_org_id || job.buyer_org?.id,
          operatorOrgId:
            awardedOffer.operator_org?.id || awardedOffer.operator_org_id,
        });
      }
    }
  }, [job, currentOrgId]);

  const acceptOfferMutation = useMutation({
    mutationFn: async (offerId: string) => {
      const response = await fetch(
        `/api/jobs/${jobId}/accept-offer/${offerId}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore nell'accettazione dell'offerta");
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success("Offerta accettata con successo!");
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setOfferToAccept(null); // Close dialog
    },
    onError: (error: any) => {
      toast.error(error.message || "Errore nell'accettazione dell'offerta");
      setOfferToAccept(null); // Close dialog
    },
  });

  // Function to reverse geocode coordinates to city name
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
        {
          headers: {
            "User-Agent": "DJI-Agras-App/1.0",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Geocoding API error");
      }

      const data = await response.json();

      // Extract city/village/town information
      const address = data.address || {};
      const city =
        address.city || address.town || address.village || address.municipality;
      const region = address.state || address.region || address.county;

      if (city && region) {
        return `${city}, ${region}`;
      } else if (city) {
        return city;
      } else if (region) {
        return region;
      }

      // Fallback to display name if no specific city found
      return (
        data.display_name?.split(",")[0] ||
        `Coordinate: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
      );
    } catch (error) {
      console.warn("Reverse geocoding failed:", error);
      return `Coordinate: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  };

  // Calculate location from job data
  const calculateLocation = async (
    locationJson?: string,
    fieldPolygon?: any,
  ): Promise<string> => {
    try {
      // First try to get location from location_json
      const location = locationJson ? JSON.parse(locationJson) : null;
      if (location?.address) {
        return location.address;
      }

      // If no address, try to calculate from polygon center and reverse geocode
      if (fieldPolygon) {
        try {
          const polygon =
            typeof fieldPolygon === "string"
              ? JSON.parse(fieldPolygon)
              : fieldPolygon;
          if (Array.isArray(polygon) && polygon.length > 0) {
            // Calculate center of polygon
            let totalLat = 0;
            let totalLng = 0;
            polygon.forEach((point: [number, number]) => {
              totalLat += point[0]; // lat
              totalLng += point[1]; // lng
            });
            const centerLat = totalLat / polygon.length;
            const centerLng = totalLng / polygon.length;

            // Reverse geocode to get city name
            const cityName = await reverseGeocode(centerLat, centerLng);
            return cityName;
          }
        } catch (e) {
          console.warn("Error calculating polygon center:", e);
        }
      }

      return "Ubicazione non specificata";
    } catch {
      return "Ubicazione non specificata";
    }
  };

  const getServiceLabel = (serviceType: string) => {
    switch (serviceType) {
      case "AGRICULTURAL_SERVICES":
        return "Servizi Agricoli";
      case "SPRAY":
        return "Trattamento fitosanitario";
      case "FERTILIZE":
        return "Spandimento fertilizzanti";
      case "MAPPING":
        return "Mappatura territoriale";
      default:
        return serviceType;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "OPEN":
        return "bg-blue-100 text-blue-800";
      case "AWARDED":
        return "bg-emerald-100 text-emerald-800";
      case "DONE":
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "EXPIRED":
        return "bg-amber-100 text-amber-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "OPEN":
        return <Clock className="w-4 h-4" />;
      case "AWARDED":
        return <CheckCircle className="w-4 h-4" />;
      case "DONE":
      case "COMPLETED":
        return <CheckCircle className="w-4 h-4" />;
      case "EXPIRED":
        return <AlertCircle className="w-4 h-4" />;
      case "CANCELLED":
        return <XCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getOfferStatusColor = (status: string) => {
    switch (status) {
      case "OFFERED":
        return "bg-blue-100 text-blue-800";
      case "AWARDED":
        return "bg-emerald-100 text-emerald-800";
      case "DECLINED":
        return "bg-red-100 text-red-800";
      case "WITHDRAWN":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(cents / 100);
  };

  const handleAcceptOffer = async (offerId: string) => {
    setOfferToAccept(offerId); // Open dialog
  };

  const handleConfirmAccept = () => {
    if (offerToAccept) {
      acceptOfferMutation.mutate(offerToAccept);
    }
  };

  // Assicuriamoci che il job sia disponibile prima di renderizzare
  if (isLoading || (!job && !error)) {
    return (
      <BuyerLayout>
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-slate-200 rounded w-1/3 mb-6"></div>
            <div className="h-64 bg-slate-200 rounded mb-6"></div>
            <div className="h-32 bg-slate-200 rounded"></div>
          </div>
        </div>
      </BuyerLayout>
    );
  }

  if (error || !job) {
    return (
      <BuyerLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error?.message || "Job non trovato o accesso negato"}
          </div>
          <div className="mt-4">
            <Link
              to="/buyer/servizi"
              className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Torna allo storico
            </Link>
          </div>
        </div>
      </BuyerLayout>
    );
  }

  return (
    <BuyerLayout>
      <div className="max-w-7xl mx-auto px-8 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            to="/buyer/servizi"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-5 h-5" />
            Torna allo storico
          </Link>
        </div>

        {/* Layout a Griglia - Alto Sinistra: Info Principali */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-4">
          {/* Alto Sinistra - Info Principali */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <div className="mb-4">
              <h1 className="text-3xl font-bold text-slate-900">
                {job.field_name}
              </h1>
              <div className="flex items-center gap-3 mt-3">
                <Badge
                  className={`${getStatusColor(job.status)} text-sm px-3 py-1`}
                >
                  {getStatusIcon(job.status)}
                  <span className="ml-1 font-medium">
                    {job.status === "OPEN"
                      ? "Aperto"
                      : job.status === "AWARDED"
                        ? "Aggiudicato"
                        : job.status === "DONE" || job.status === "COMPLETED"
                          ? "Completato"
                          : job.status === "EXPIRED"
                            ? "Scaduto"
                            : job.status === "CANCELLED"
                              ? "Annullato"
                              : "Sconosciuto"}
                  </span>
                </Badge>
                {job.offers && job.offers.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="bg-slate-100 text-slate-700 text-sm px-3 py-1"
                  >
                    {job.offers.length} offerta
                    {job.offers.length !== 1 ? "e" : ""}
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-600 font-medium">ID</span>
                <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                  {job?.id?.slice(-8) || "N/A"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Creato</span>
                <span className="text-slate-900">
                  {new Date(job.created_at).toLocaleDateString("it-IT")}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Area</span>
                <span className="text-slate-900 font-semibold">
                  {job.area_ha.toFixed(1)} ha
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Servizio</span>
                <span className="text-slate-900">
                  {getServiceLabel(job.service_type)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Ubicazione</span>
                <span className="text-slate-900">{jobLocation}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-600 font-medium">Periodo</span>
                <span className="text-slate-900">
                  {job.requested_window_start && job.requested_window_end
                    ? `${new Date(job.requested_window_start).toLocaleDateString("it-IT", { day: "numeric", month: "short" })} - ${new Date(job.requested_window_end).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}`
                    : "Da definire"}
                </span>
              </div>
            </div>
          </div>

          {/* Alto Destra - Offerte */}
          <div className="bg-slate-50 rounded-xl shadow-sm border border-slate-200 p-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-600" />
              Offerte Ricevute
            </h2>

            {job.offers && job.offers.length > 0 ? (
              <div className="space-y-3">
                {job.offers.map((offer) => (
                  <div
                    key={offer.id}
                    className="bg-white border border-slate-200 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-4 h-4 text-slate-500" />
                          <span className="font-semibold text-slate-900 text-sm">
                            {offer.operator_org.legal_name}
                          </span>
                          <Link
                            to={`/operators/${offer.operator_org.id}`}
                            className="ml-2 text-xs text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                          >
                            <User className="w-3 h-3" />
                            Vedi profilo
                          </Link>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-600 mb-2">
                          <span>
                            {new Date(offer.created_at).toLocaleDateString(
                              "it-IT",
                            )}
                          </span>
                          {offer.proposed_start && offer.proposed_end && (
                            <span>
                              {new Date(
                                offer.proposed_start,
                              ).toLocaleDateString("it-IT", {
                                day: "numeric",
                                month: "short",
                              })}{" "}
                              -
                              {new Date(offer.proposed_end).toLocaleDateString(
                                "it-IT",
                                { day: "numeric", month: "short" },
                              )}
                            </span>
                          )}
                        </div>

                        {offer.provider_note && (
                          <p className="text-slate-700 text-sm mb-2">
                            "{offer.provider_note}"
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-bold text-slate-900 mb-3">
                          €{(offer.total_cents / 100).toFixed(2)}
                        </div>

                        <div className="flex flex-col gap-3 items-end">
                          <Badge
                            className={`${getOfferStatusColor(offer.status)} text-xs px-3 py-1`}
                          >
                            {offer.status === "OFFERED"
                              ? "In Attesa"
                              : offer.status === "AWARDED"
                                ? "Accettata"
                                : offer.status === "DECLINED"
                                  ? "Rifiutata"
                                  : offer.status}
                          </Badge>

                          {job.status === "OPEN" &&
                            offer.status === "OFFERED" && (
                              <Button
                                size="sm"
                                onClick={() => handleAcceptOffer(offer.id)}
                                disabled={acceptOfferMutation.isPending}
                                className="bg-emerald-600 hover:bg-emerald-700 text-xs px-4 py-2 min-w-[80px]"
                              >
                                {acceptOfferMutation.isPending
                                  ? "..."
                                  : "Accetta"}
                              </Button>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-slate-600 text-sm">
                  {job.status === "OPEN"
                    ? "In attesa di offerte dagli operatori qualificati."
                    : "Nessuna offerta ricevuta."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Layout a Griglia - Parte Inferiore */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Basso Sinistra - Mappa e Specifiche */}
          <div className="space-y-6">
            {/* Specifiche del Lavoro */}
            {(job.crop_type ||
              job.treatment_type ||
              job.terrain_conditions) && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-slate-600" />
                  Specifiche del Lavoro
                </h2>
                <div className="space-y-3">
                  {job.crop_type && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-slate-600 font-medium">
                        Coltura
                      </span>
                      <span className="text-slate-900">{job.crop_type}</span>
                    </div>
                  )}
                  {job.treatment_type && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-slate-600 font-medium">
                        Trattamento
                      </span>
                      <span className="text-slate-900">
                        {job.treatment_type}
                      </span>
                    </div>
                  )}
                  {job.terrain_conditions && (
                    <div className="flex justify-between items-center py-2">
                      <span className="text-slate-600 font-medium">
                        Terreno
                      </span>
                      <span className="text-slate-900">
                        {job.terrain_conditions}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mappa del Campo */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Map className="w-5 h-5 text-slate-600" />
                Mappa del Campo
              </h2>
              <JobFieldMap
                fieldPolygon={job.field_polygon}
                areaHa={job.area_ha}
                fieldName={job.field_name}
              />
            </div>
          </div>

          {/* Basso Destra - Note Aggiuntive */}
          <div className="space-y-6">
            {(() => {
              try {
                const constraints = job.constraints_json
                  ? JSON.parse(job.constraints_json)
                  : null;
                const hasReadableNotes =
                  constraints && constraints.notes && constraints.notes.trim();

                if (hasReadableNotes) {
                  return (
                    <div className="bg-slate-50 rounded-xl shadow-sm border border-slate-200 p-8">
                      <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-slate-600" />
                        Note Aggiuntive
                      </h2>
                      <div className="bg-white rounded-lg p-4 border-l-4 border-slate-300">
                        <p className="text-slate-800 leading-relaxed">
                          {constraints.notes}
                        </p>
                      </div>
                    </div>
                  );
                }
              } catch (e) {
                // Ignore parsing errors
              }
              return null;
            })()}
          </div>
        </div>

        {/* Dialog di conferma accettazione offerta */}
        <AlertDialog
          open={!!offerToAccept}
          onOpenChange={(open) => !open && setOfferToAccept(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Conferma accettazione offerta</AlertDialogTitle>
              <AlertDialogDescription>
                Sei sicuro di voler accettare questa offerta? Non potrai più
                accettare altre offerte per questo job.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmAccept}
                disabled={acceptOfferMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {acceptOfferMutation.isPending
                  ? "Accettazione..."
                  : "Conferma accettazione"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </BuyerLayout>
  );
};

export default DettagliJobBuyer;
