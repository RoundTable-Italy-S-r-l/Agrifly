import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from '@/components/AdminLayout';
import { fetchOrderStats, fetchOrders, fetchActiveMissions, fetchMissionsStats, Order, OrderStats, Mission, MissionsStats } from '@/lib/api';
import { authAPI } from '@/lib/auth';
import EmailVerificationBanner from '@/components/EmailVerificationBanner';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Plane,
  Users,
  Calendar,
  Package,
  CheckCircle,
  Clock,
  AlertTriangle,
  BarChart3,
  RefreshCw
} from 'lucide-react';

export default function DashboardAdmin() {
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('month');
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);

  // Query per profilo utente (per verificare email_verified)
  const { data: userProfile, refetch: refetchProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: () => authAPI.getProfile(),
    retry: 1
  });

  // Ottieni l'ID dell'organizzazione corrente dall'utente autenticato
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

  // Query per statistiche ordini
  const { data: orderStats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['orderStats', currentOrgId],
    queryFn: () => currentOrgId ? fetchOrderStats(currentOrgId) : Promise.resolve({
      totalRevenue: 0,
      activeOrders: 0,
      completedOrdersThisMonth: 0,
      recentOrders: []
    }),
    enabled: !!currentOrgId
  });

  // Query per missioni attive
  const { data: activeMissions = [], isLoading: missionsLoading } = useQuery({
    queryKey: ['activeMissions', currentOrgId],
    queryFn: () => currentOrgId ? fetchActiveMissions(currentOrgId) : Promise.resolve([]),
    enabled: !!currentOrgId
  });

  // Dati calcolati
  const kpiData = orderStats ? {
    hardwareRevenue: orderStats.totalRevenue / 100, // Converti da centesimi
    serviceCommissions: Math.round(orderStats.totalRevenue * 0.1 / 100), // 10% commissioni stimate
    activeOrders: orderStats.activeOrders,
    completedOrdersThisMonth: orderStats.completedOrdersThisMonth,
    activeOperators: activeMissions.length, // Missioni attive = operatori attivi
    pendingBookings: activeMissions.filter(m => m.status === 'scheduled').length
  } : {
    hardwareRevenue: 0,
    serviceCommissions: 0,
    activeOrders: 0,
    completedOrdersThisMonth: 0,
    activeOperators: 0,
    pendingBookings: 0
  };

  // Trasforma ordini per la visualizzazione
  const transformedRecentOrders = (orderStats?.recentOrders || []).slice(0, 3).map(order => ({
    id: order.id,
    customer: order.buyer_org_name,
    product: order.products,
    amount: order.total_cents / 100,
    status: order.order_status.toLowerCase()
  }));

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        {/* Email Verification Banner */}
        {userProfile && !userProfile.user.email_verified && (
          <EmailVerificationBanner
            userEmail={userProfile.user.email}
            onVerified={() => refetchProfile()}
          />
        )}

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard Amministratore</h1>
            <p className="text-slate-600 mt-1">Panoramica completa del business e gestione operativa</p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="today">Oggi</option>
              <option value="week">Questa settimana</option>
              <option value="month">Questo mese</option>
            </select>
            <button
              onClick={() => refetchStats()}
              disabled={statsLoading}
              className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${statsLoading ? 'animate-spin' : ''}`} />
              Aggiorna
            </button>
            <div className="text-sm text-slate-500">
              {statsLoading ? 'Aggiornamento...' : `Aggiornato: ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`}
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">Vendite Hardware</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  € {kpiData.hardwareRevenue.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
                <span className="text-xs text-emerald-600 flex items-center mt-2">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Ricavi totali
                </span>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">Commissioni Servizi</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  € {kpiData.serviceCommissions.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
                <span className="text-xs text-slate-500 mt-2">
                  Commissioni stimate
                </span>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">Ordini Attivi</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{kpiData.activeOrders}</p>
                <span className="text-xs text-emerald-600 mt-2">
                  Ordini attivi
                </span>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">Missioni Completate</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{kpiData.completedOrdersThisMonth}</p>
                <span className="text-xs text-slate-500 mt-2">
                  Questo mese
                </span>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts and Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Orders */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-900">Ordini Recenti</h3>
                <p className="text-sm text-slate-500 mt-1">Ultimi ordini di vendita hardware</p>
              </div>
              <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Vedi tutti →
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {transformedRecentOrders.length > 0 ? transformedRecentOrders.map((order) => (
                <div key={order.id} className="p-4 flex justify-between items-center">
                  <div>
                    <div className="font-medium text-slate-900">{order.id}</div>
                    <div className="text-sm text-slate-600">{order.customer}</div>
                    <div className="text-xs text-slate-500">{order.product}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">€ {order.amount.toLocaleString()}</div>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                      order.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                      order.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'paid' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {order.status === 'delivered' ? 'Consegnato' :
                       order.status === 'shipped' ? 'Spedito' :
                       order.status === 'paid' ? 'Pagato' :
                       order.status === 'processing' ? 'In elaborazione' : order.status}
                    </span>
                  </div>
                </div>
              )) : (
                <div className="p-4 text-center text-slate-500">
                  {statsLoading ? 'Caricamento ordini...' : 'Nessun ordine recente'}
                </div>
              )}
            </div>
          </div>

          {/* Active Missions */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-900">Missioni Attive</h3>
                <p className="text-sm text-slate-500 mt-1">Servizi di trattamento in corso</p>
              </div>
              <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Gestisci →
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {activeMissions.map((mission) => (
                <div key={mission.id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium text-slate-900">{mission.location}</div>
                      <div className="text-sm text-slate-600">{mission.operator} • {mission.area} ha</div>
                    </div>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      mission.status === 'in_progress' ? 'bg-emerald-100 text-emerald-700' :
                      mission.status === 'scheduled' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {mission.status === 'in_progress' ? 'In corso' : 'Programmata'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        mission.status === 'in_progress' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${mission.progress}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {mission.progress}% completato
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">Azioni Rapide</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <Package className="w-5 h-5 text-slate-600" />
              <div className="text-left">
                <div className="font-medium text-slate-900">Aggiungi Prodotto</div>
                <div className="text-sm text-slate-500">Crea nuovo SKU o offerta</div>
              </div>
            </button>
            <button className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <Users className="w-5 h-5 text-slate-600" />
              <div className="text-left">
                <div className="font-medium text-slate-900">Gestisci Operatori</div>
                <div className="text-sm text-slate-500">Aggiungi o modifica piloti</div>
              </div>
            </button>
            <button className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <Calendar className="w-5 h-5 text-slate-600" />
              <div className="text-left">
                <div className="font-medium text-slate-900">Programma Servizio</div>
                <div className="text-sm text-slate-500">Nuova missione o intervento</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
