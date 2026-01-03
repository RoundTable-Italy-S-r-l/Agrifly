import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BuyerLayout } from "@/components/BuyerLayout";
import { fetchJobs } from "@/lib/api";
import {
  TrendingUp,
  DollarSign,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Calendar,
  MapPin,
  RefreshCw,
  Plus,
  Settings,
  History,
} from "lucide-react";
import { Link } from "react-router-dom";

// Funzione per trasformare i dati dei job nel formato dashboard
const transformJobsToStats = (jobs: any[]) => {
  if (!jobs || !Array.isArray(jobs)) {
    return {
      totalQuotes: 0,
      activeQuotes: 0,
      completedThisMonth: 0,
      totalSpent: 0,
      recentQuotes: [],
    };
  }

  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Calcola statistiche
  const totalQuotes = jobs.length;
  const activeQuotes = jobs.filter(
    (job) => job.status === "OPEN" || job.status === "AWARDED",
  ).length;
  const completedThisMonth = jobs.filter(
    (job) =>
      job.status === "COMPLETED" &&
      job.created_at &&
      new Date(job.created_at) >= thisMonth,
  ).length;

  // Calcola spesa totale dalle offerte accettate
  const totalSpent = jobs.reduce((sum, job) => {
    if (!job.offers || !Array.isArray(job.offers)) {
      return sum;
    }
    const acceptedOffer = job.offers.find(
      (offer: any) => offer.status === "AWARDED",
    );
    return (
      sum +
      (acceptedOffer && acceptedOffer.price_cents
        ? acceptedOffer.price_cents / 100
        : 0)
    );
  }, 0);

  // Preleva i 3 job più recenti
  const recentQuotes = jobs.slice(0, 3).map((job) => {
    let estimatedCost = 0;
    if (job.offers && Array.isArray(job.offers)) {
      const acceptedOffer = job.offers.find(
        (offer: any) => offer.status === "AWARDED",
      );
      estimatedCost =
        acceptedOffer && acceptedOffer.price_cents
          ? acceptedOffer.price_cents / 100
          : 0;
    }

    return {
      id: job.id,
      title: job.field_name || `Job ${job.id}`,
      area: `${job.area_ha || 0} ha`,
      status: job.status ? job.status.toLowerCase() : "pending",
      createdAt: job.created_at
        ? new Date(job.created_at).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      estimatedCost,
    };
  });

  return {
    totalQuotes,
    activeQuotes,
    completedThisMonth,
    totalSpent,
    recentQuotes,
  };
};

// Mock data per buyer - fallback quando non ci sono dati
const mockBuyerStats = {
  totalQuotes: 24,
  activeQuotes: 3,
  completedThisMonth: 8,
  totalSpent: 45600,
  recentQuotes: [
    {
      id: "q1",
      title: "Trattamento vigneto Chianti",
      area: "45.2 ha",
      status: "pending",
      createdAt: "2024-12-20",
      estimatedCost: 2800,
    },
    {
      id: "q2",
      title: "Concimazione oliveto Siena",
      area: "32.8 ha",
      status: "approved",
      createdAt: "2024-12-18",
      estimatedCost: 1950,
    },
    {
      id: "q3",
      title: "Mappatura NDVI Firenze",
      area: "120.5 ha",
      status: "completed",
      createdAt: "2024-12-15",
      estimatedCost: 4200,
    },
  ],
};

export default function DashboardBuyer() {
  const [selectedPeriod, setSelectedPeriod] = useState<
    "month" | "quarter" | "year"
  >("month");

  // Carichiamo i dati reali dei job dell'utente
  const { data: jobsData, isLoading } = useQuery({
    queryKey: ["buyerJobs"],
    queryFn: fetchJobs,
    staleTime: 5 * 60 * 1000, // 5 minuti
  });

  // Trasformiamo i dati dei job nella struttura della dashboard
  const stats =
    jobsData && jobsData.jobs && Array.isArray(jobsData.jobs)
      ? transformJobsToStats(jobsData.jobs)
      : mockBuyerStats;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "approved":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4" />;
      case "approved":
        return <CheckCircle className="w-4 h-4" />;
      case "completed":
        return <CheckCircle className="w-4 h-4" />;
      case "rejected":
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  if (isLoading) {
    return (
      <BuyerLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      </BuyerLayout>
    );
  }

  return (
    <BuyerLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-600 mt-1">
              Panoramica delle tue attività agricole
            </p>
          </div>
          <Link
            to="/buyer/nuovo-preventivo"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nuovo Preventivo
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">
                  Preventivi Totali
                </p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {stats?.totalQuotes || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">
                  Preventivi Attivi
                </p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {stats?.activeQuotes || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">
                  Completati Questo Mese
                </p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {stats?.completedThisMonth || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">
                  Totale Speso
                </p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {formatCurrency(stats?.totalSpent || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Quotes */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-xl font-bold text-slate-900">
              Preventivi Recenti
            </h2>
            <p className="text-slate-600 mt-1">
              I tuoi ultimi preventivi richiesti
            </p>
          </div>

          <div className="divide-y divide-slate-200">
            {stats?.recentQuotes?.map((quote) => (
              <div
                key={quote.id}
                className="p-6 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-slate-900">
                        {quote.title}
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(quote.status)}`}
                      >
                        {getStatusIcon(quote.status)}
                        {quote.status === "pending"
                          ? "In Attesa"
                          : quote.status === "approved"
                            ? "Approvato"
                            : quote.status === "completed"
                              ? "Completato"
                              : "Rifiutato"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {quote.area}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(quote.createdAt).toLocaleDateString("it-IT")}
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        {formatCurrency(quote.estimatedCost)}
                      </div>
                    </div>
                  </div>
                  <div className="ml-4">
                    <Link
                      to={`/buyer/servizi/${quote.id}`}
                      className="text-emerald-600 hover:text-emerald-700 font-medium text-sm"
                    >
                      Vedi Dettagli →
                    </Link>
                  </div>
                </div>
              </div>
            )) || (
              <div className="p-12 text-center">
                <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">
                  Nessun preventivo ancora
                </h3>
                <p className="text-slate-600 mb-6">
                  Inizia richiedendo il tuo primo preventivo per i servizi
                  agricoli.
                </p>
                <Link
                  to="/buyer/nuovo-preventivo"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Crea il primo preventivo
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            Azioni Rapide
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/buyer/nuovo-preventivo"
              className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <div className="font-medium text-slate-900">
                  Nuovo Preventivo
                </div>
                <div className="text-sm text-slate-600">
                  Richiedi un preventivo per i tuoi campi
                </div>
              </div>
            </Link>

            <Link
              to="/buyer/servizi"
              className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <History className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="font-medium text-slate-900">
                  Storico Preventivi
                </div>
                <div className="text-sm text-slate-600">
                  Visualizza tutti i preventivi passati
                </div>
              </div>
            </Link>

            <Link
              to="/buyer/impostazioni"
              className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <Settings className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <div className="font-medium text-slate-900">Impostazioni</div>
                <div className="text-sm text-slate-600">
                  Gestisci il tuo profilo e preferenze
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </BuyerLayout>
  );
}
