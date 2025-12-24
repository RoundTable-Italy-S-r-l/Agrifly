import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import {
  fetchRateCards,
  createRateCard,
  updateRateCard,
  deleteRateCard,
  type RateCard
} from '@/lib/api';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';

export default function AdminRateCards() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<RateCard>>({
    seller_org_id: 'org_default',
    service_type: 'SPRAY',
    base_rate_per_ha_cents: 4500,
    min_charge_cents: 10000,
    travel_rate_per_km_cents: 50,
    seasonal_multipliers_json: {
      '1': 1.0, '2': 1.0, '3': 1.1, '4': 1.2, '5': 1.2, '6': 1.3,
      '7': 1.3, '8': 1.2, '9': 1.1, '10': 1.0, '11': 1.0, '12': 1.0
    },
    risk_multipliers_json: {
      'low': 1.0,
      'medium': 1.2,
      'high': 1.5
    }
  });

  const { data: rateCards = [], isLoading } = useQuery({
    queryKey: ['rateCards'],
    queryFn: fetchRateCards
  });

  const createMutation = useMutation({
    mutationFn: createRateCard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rateCards'] });
      setIsCreating(false);
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RateCard> }) =>
      updateRateCard(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rateCards'] });
      setEditingId(null);
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRateCard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rateCards'] });
    }
  });

  const resetForm = () => {
    setFormData({
      seller_org_id: 'org_default',
      service_type: 'SPRAY',
      base_rate_per_ha_cents: 4500,
      min_charge_cents: 10000,
      travel_rate_per_km_cents: 50,
      seasonal_multipliers_json: {
        '1': 1.0, '2': 1.0, '3': 1.1, '4': 1.2, '5': 1.2, '6': 1.3,
        '7': 1.3, '8': 1.2, '9': 1.1, '10': 1.0, '11': 1.0, '12': 1.0
      },
      risk_multipliers_json: {
        'low': 1.0,
        'medium': 1.2,
        'high': 1.5
      }
    });
  };

  const handleEdit = (rateCard: RateCard) => {
    setEditingId(rateCard.id);
    setFormData(rateCard);
    setIsCreating(false);
  };

  const handleSave = () => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData as Omit<RateCard, 'id'>);
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    resetForm();
  };

  const updateSeasonalMult = (month: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      seasonal_multipliers_json: {
        ...prev.seasonal_multipliers_json,
        [month]: value
      }
    }));
  };

  const updateRiskMult = (risk: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      risk_multipliers_json: {
        ...prev.risk_multipliers_json,
        [risk]: value
      }
    }));
  };

  const months = [
    { key: '1', label: 'Gen' }, { key: '2', label: 'Feb' }, { key: '3', label: 'Mar' },
    { key: '4', label: 'Apr' }, { key: '5', label: 'Mag' }, { key: '6', label: 'Giu' },
    { key: '7', label: 'Lug' }, { key: '8', label: 'Ago' }, { key: '9', label: 'Set' },
    { key: '10', label: 'Ott' }, { key: '11', label: 'Nov' }, { key: '12', label: 'Dic' }
  ];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Rate Cards</h1>
            <p className="text-sm text-slate-500 mt-1">Gestione listini prezzi per servizi</p>
          </div>
          {!isCreating && !editingId && (
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold text-sm"
            >
              <Plus size={18} /> Nuova Rate Card
            </button>
          )}
        </div>

        {/* Form Creazione/Modifica */}
        {(isCreating || editingId) && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              {editingId ? 'Modifica Rate Card' : 'Nuova Rate Card'}
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Organizzazione
                </label>
                <input
                  type="text"
                  value={formData.seller_org_id || ''}
                  onChange={(e) => setFormData({ ...formData, seller_org_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="org_default"
                  disabled={!!editingId}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Tipo Servizio
                </label>
                <select
                  value={formData.service_type || ''}
                  onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  disabled={!!editingId}
                >
                  <option value="SPRAY">SPRAY (Irrorazione liquida)</option>
                  <option value="SPREAD">SPREAD (Distribuzione solida)</option>
                  <option value="MAPPING">MAPPING (Rilievo GIS)</option>
                </select>
              </div>
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-3">💰 Prezzi Base</h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Prezzo Base (€/ha)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={(formData.base_rate_per_ha_cents || 0) / 100}
                    onChange={(e) => setFormData({
                      ...formData,
                      base_rate_per_ha_cents: Math.round(parseFloat(e.target.value) * 100)
                    })}
                    step="0.01"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-500">€/ha</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Minimo (€)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={(formData.min_charge_cents || 0) / 100}
                    onChange={(e) => setFormData({
                      ...formData,
                      min_charge_cents: Math.round(parseFloat(e.target.value) * 100)
                    })}
                    step="0.01"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-500">€</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Travel (€/km)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={(formData.travel_rate_per_km_cents || 0) / 100}
                    onChange={(e) => setFormData({
                      ...formData,
                      travel_rate_per_km_cents: Math.round(parseFloat(e.target.value) * 100)
                    })}
                    step="0.01"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-500">€/km</span>
                </div>
              </div>
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-3">📅 Moltiplicatori Stagionali</h3>
            <div className="grid grid-cols-6 gap-2 mb-6">
              {months.map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                  <input
                    type="number"
                    value={formData.seasonal_multipliers_json?.[key] || 1.0}
                    onChange={(e) => updateSeasonalMult(key, parseFloat(e.target.value))}
                    step="0.1"
                    min="0.5"
                    max="2.0"
                    className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              ))}
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-3">⚠️ Moltiplicatori Rischio</h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Basso</label>
                <input
                  type="number"
                  value={formData.risk_multipliers_json?.['low'] || 1.0}
                  onChange={(e) => updateRiskMult('low', parseFloat(e.target.value))}
                  step="0.1"
                  min="0.5"
                  max="2.0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Medio</label>
                <input
                  type="number"
                  value={formData.risk_multipliers_json?.['medium'] || 1.0}
                  onChange={(e) => updateRiskMult('medium', parseFloat(e.target.value))}
                  step="0.1"
                  min="0.5"
                  max="2.0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Alto</label>
                <input
                  type="number"
                  value={formData.risk_multipliers_json?.['high'] || 1.0}
                  onChange={(e) => updateRiskMult('high', parseFloat(e.target.value))}
                  step="0.1"
                  min="0.5"
                  max="2.0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold disabled:opacity-50"
              >
                <Save size={18} />
                {createMutation.isPending || updateMutation.isPending ? 'Salvataggio...' : 'Salva'}
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-semibold"
              >
                <X size={18} /> Annulla
              </button>
            </div>
          </div>
        )}

        {/* Lista Rate Cards */}
        <div className="space-y-4">
          {isLoading && <p className="text-center text-slate-500 py-8">Caricamento...</p>}

          {!isLoading && rateCards.length === 0 && !isCreating && (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-slate-600 mb-4">Nessuna rate card configurata</p>
              <button
                onClick={() => setIsCreating(true)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold text-sm"
              >
                Crea la prima rate card
              </button>
            </div>
          )}

          {rateCards.map((rc) => (
            <div
              key={rc.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-slate-900">
                      {rc.seller_org_id} - {rc.service_type}
                    </h3>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded">
                      ATTIVA
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Base:</span>
                      <strong className="ml-2">{(rc.base_rate_per_ha_cents / 100).toFixed(2)}€/ha</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Minimo:</span>
                      <strong className="ml-2">{(rc.min_charge_cents / 100).toFixed(2)}€</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Travel:</span>
                      <strong className="ml-2">{(rc.travel_rate_per_km_cents / 100).toFixed(2)}€/km</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(rc)}
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                    title="Modifica"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Sei sicuro di voler eliminare questa rate card?')) {
                        deleteMutation.mutate(rc.id);
                      }
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Elimina"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
