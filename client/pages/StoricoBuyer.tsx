import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BuyerLayout } from "@/components/BuyerLayout";
import {
  Search,
  Filter,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Calendar,
  MapPin,
  DollarSign,
  Eye,
  Download,
  RefreshCw,
  CreditCard,
  MessageSquare,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  getMyJobs,
  acceptJobOffer,
  getBookings,
  payBooking,
  Job,
} from "@/lib/api";
import { toast } from "sonner";

export default function StoricoBuyer() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "offers" | "area" | "name">(
    "date",
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [payingBooking, setPayingBooking] = useState<string | null>(null);

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

  // Fetch jobs data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my-jobs"],
    queryFn: getMyJobs,
    retry: 1,
  });

  // Fetch bookings data
  const { data: bookingsData, refetch: refetchBookings } = useQuery({
    queryKey: ["bookings", currentOrgId],
    queryFn: () =>
      currentOrgId
        ? getBookings(currentOrgId)
        : Promise.resolve({ bookings: [] }),
    enabled: !!currentOrgId,
  });

  const handleAcceptOffer = async (jobId: string, offerId: string) => {
    try {
      const result = await acceptJobOffer(jobId, offerId);
      toast.success(result.message);
      refetch(); // Refresh the data
      refetchBookings(); // Refresh bookings
    } catch (error: any) {
      toast.error(error.message || "Errore nell'accettazione dell'offerta");
    }
  };

  const handlePayBooking = async (bookingId: string) => {
    try {
      setPayingBooking(bookingId);
      const result = await payBooking(bookingId);
      toast.success(result.message);
      refetchBookings(); // Refresh bookings
    } catch (error: any) {
      toast.error(error.message || "Errore nel pagamento");
    } finally {
      setPayingBooking(null);
    }
  };

  const jobs = data?.jobs || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "OPEN":
        return "bg-blue-100 text-blue-800";
      case "AWARDED":
        return "bg-green-100 text-green-800";
      case "DONE":
      case "COMPLETED":
        return "bg-emerald-100 text-emerald-800";
      case "EXPIRED":
        return "bg-gray-100 text-gray-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-blue-100 text-blue-800";
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
        return <AlertTriangle className="w-4 h-4" />;
      case "CANCELLED":
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getServiceLabel = (serviceType: string) => {
    switch (serviceType) {
      case "SPRAY":
        return "Trattamento fitosanitario";
      case "SPREAD":
        return "Spandimento fertilizzanti";
      case "MAPPING":
        return "Mappatura territoriale";
      default:
        return serviceType;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(amount / 100); // Convert cents to euros
  };

  const parseLocation = (locationJson?: string) => {
    try {
      const location = locationJson ? JSON.parse(locationJson) : null;
      return location?.address || "Ubicazione non specificata";
    } catch {
      return "Ubicazione non specificata";
    }
  };

  const handleSort = (field: "date" | "offers" | "area" | "name") => {
    if (sortBy === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({
    field,
  }: {
    field: "date" | "offers" | "area" | "name";
  }) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="w-4 h-4 text-slate-400" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-4 h-4 text-emerald-600" />
    ) : (
      <ArrowDown className="w-4 h-4 text-emerald-600" />
    );
  };

  const filteredJobs = jobs
    .filter((job: Job) => {
      const matchesSearch =
        job.field_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        parseLocation(job.location_json)
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        getServiceLabel(job.service_type)
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || job.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a: Job, b: Job) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = (a.field_name || "").localeCompare(b.field_name || "");
          break;
        case "date":
          comparison =
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          break;
        case "offers":
          comparison = (b.offers?.length || 0) - (a.offers?.length || 0);
          break;
        case "area":
          comparison = (b.area_ha || 0) - (a.area_ha || 0);
          break;
      }
      return sortDirection === "asc" ? -comparison : comparison;
    });

  if (error) {
    return (
      <BuyerLayout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            Errore nel caricamento dei job: {error.message}
          </div>
        </div>
      </BuyerLayout>
    );
  }

  return (
    <BuyerLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Servizi</h1>
            <p className="text-slate-600 mt-1">
              Tutti i servizi richiesti e il loro stato
            </p>
          </div>
          <Link
            to="/buyer/nuovo-preventivo"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <FileText className="w-5 h-5" />
            Nuovo Preventivo
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Cerca per nome campo, località o servizio..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="w-full lg:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="all">Tutti gli stati</option>
                <option value="OPEN">Aperti</option>
                <option value="AWARDED">Aggiudicati</option>
                <option value="EXPIRED">Scaduti</option>
                <option value="CANCELLED">Annullati</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort("name")}
                      className="flex items-center gap-2 hover:text-emerald-600 transition-colors"
                    >
                      Nome Campo
                      <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Servizio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort("area")}
                      className="flex items-center gap-2 hover:text-emerald-600 transition-colors"
                    >
                      Area (ha)
                      <SortIcon field="area" />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort("date")}
                      className="flex items-center gap-2 hover:text-emerald-600 transition-colors"
                    >
                      Data
                      <SortIcon field="date" />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Stato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort("offers")}
                      className="flex items-center gap-2 hover:text-emerald-600 transition-colors"
                    >
                      Offerte
                      <SortIcon field="offers" />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <RefreshCw className="w-8 h-8 text-slate-400 mx-auto mb-2 animate-spin" />
                      <p className="text-slate-600">Caricamento servizi...</p>
                    </td>
                  </tr>
                ) : filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-slate-900 mb-2">
                        {jobs.length === 0
                          ? "Nessun servizio pubblicato"
                          : "Nessun servizio trovato"}
                      </h3>
                      <p className="text-slate-600 mb-6">
                        {searchTerm || statusFilter !== "all"
                          ? "Prova a modificare i filtri di ricerca."
                          : jobs.length === 0
                            ? "Non hai ancora pubblicato nessun servizio."
                            : "Nessun servizio corrisponde ai criteri di ricerca."}
                      </p>
                      {jobs.length === 0 && (
                        <Link
                          to="/buyer/nuovo-preventivo"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          <FileText className="w-5 h-5" />
                          Pubblica il primo servizio
                        </Link>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((job: Job) => {
                    const booking = bookingsData?.bookings?.find(
                      (b: any) => b.job_id === job.id,
                    );

                    return (
                      <tr
                        key={job.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link
                            to={`/buyer/job/${job.id}`}
                            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                          >
                            {job.field_name || "Campo senza nome"}
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-900">
                            {getServiceLabel(job.service_type)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-900">
                            {parseFloat(job.area_ha)?.toFixed(1) || "N/A"} ha
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-600">
                            {new Date(job.created_at).toLocaleDateString(
                              "it-IT",
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}
                          >
                            {getStatusIcon(job.status)}
                            {job.status === "OPEN"
                              ? "Aperto"
                              : job.status === "AWARDED"
                                ? "Aggiudicato"
                                : job.status === "DONE" ||
                                    job.status === "COMPLETED"
                                  ? "Completato"
                                  : job.status === "EXPIRED"
                                    ? "Scaduto"
                                    : job.status === "CANCELLED"
                                      ? "Annullato"
                                      : "Sconosciuto"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {job.offers && job.offers.length > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                              {job.offers.length} offerta
                              {job.offers.length !== 1 ? "e" : ""}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/buyer/job/${job.id}`}
                              className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                              Dettagli
                            </Link>

                            {/* Show payment button if booking exists and not paid */}
                            {booking &&
                              booking.payment_status === "PENDING" && (
                                <button
                                  onClick={() => handlePayBooking(booking.id)}
                                  disabled={payingBooking === booking.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors disabled:opacity-50"
                                >
                                  <CreditCard className="w-4 h-4" />
                                  {payingBooking === booking.id
                                    ? "..."
                                    : "Paga"}
                                </button>
                              )}

                            {/* Show chat link if paid */}
                            {booking && booking.payment_status === "PAID" && (
                              <Link
                                to={`/chat/job/${job.id}`}
                                className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                              >
                                <MessageSquare className="w-4 h-4" />
                                Chat
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </BuyerLayout>
  );
}
