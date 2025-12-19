import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/AdminLayout';
import { fetchVendorCatalog, toggleVendorProduct, updateVendorProduct, initializeVendorCatalog, initializeLenziCatalog, VendorCatalogItem } from '@/lib/api';
import {
  Package,
  ToggleLeft,
  ToggleRight,
  Edit,
  Save,
  X,
  DollarSign,
  Clock,
  TrendingUp,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function AdminCatalog() {
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    price: '',
    leadTimeDays: '',
    notes: ''
  });

  const queryClient = useQueryClient();

  // Ottieni l'ID dell'organizzazione corrente
  useEffect(() => {
    const orgData = localStorage.getItem('organization');
    if (orgData) {
      try {
        const org = JSON.parse(orgData);
        setCurrentOrgId(org.id);
      } catch (error) {
        console.error('Errore nel parsing dei dati organizzazione:', error);
      }
    } else {
      // Se non c'è organizzazione selezionata, prova a trovare automaticamente Lenzi
      console.log('Nessuna organizzazione selezionata, cercando Lenzi automaticamente...');
      // Non impostare currentOrgId qui - lascia che l'utente clicchi il pulsante
    }
  }, []);

  // Query per catalogo vendor
  const { data: catalogData, isLoading } = useQuery({
    queryKey: ['vendorCatalog', currentOrgId],
    queryFn: () => currentOrgId ? fetchVendorCatalog(currentOrgId) : Promise.resolve({ catalog: [] }),
    enabled: !!currentOrgId
  });

  // Mutation per toggle prodotto
  const toggleMutation = useMutation({
    mutationFn: ({ skuId, isForSale }: { skuId: string; isForSale: boolean }) =>
      currentOrgId ? toggleVendorProduct(currentOrgId, skuId, isForSale) : Promise.reject('No org ID'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendorCatalog', currentOrgId] });
    }
  });

  // Mutation per aggiornare prodotto
  const updateMutation = useMutation({
    mutationFn: ({ skuId, updates }: { skuId: string; updates: any }) =>
      currentOrgId ? updateVendorProduct(currentOrgId, skuId, updates) : Promise.reject('No org ID'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendorCatalog', currentOrgId] });
      setEditingProduct(null);
      setEditForm({ price: '', leadTimeDays: '', notes: '' });
    }
  });

  // Mutation per inizializzare catalogo
  const initializeMutation = useMutation({
    mutationFn: () => currentOrgId ? initializeVendorCatalog(currentOrgId) : Promise.reject('No org ID'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendorCatalog', currentOrgId] });
    }
  });

  const handleInitializeCatalog = async () => {
    try {
      await initializeMutation.mutateAsync();
    } catch (error) {
      console.error('Errore nell\'inizializzazione del catalogo:', error);
    }
  };

  const catalog = catalogData?.catalog || [];

  const handleToggleProduct = async (skuId: string, currentStatus: boolean) => {
    try {
      await toggleMutation.mutateAsync({ skuId, isForSale: !currentStatus });
    } catch (error) {
      console.error('Errore nel toggle prodotto:', error);
    }
  };

  const handleStartEdit = (product: VendorCatalogItem) => {
    setEditingProduct(product.id);
    setEditForm({
      price: product.price?.toString() || '',
      leadTimeDays: product.leadTimeDays?.toString() || '',
      notes: product.notes || ''
    });
  };

  const handleSaveEdit = async (skuId: string) => {
    try {
      const updates: any = {};

      if (editForm.price) updates.price = parseFloat(editForm.price);
      if (editForm.leadTimeDays) updates.leadTimeDays = parseInt(editForm.leadTimeDays);
      if (editForm.notes !== undefined) updates.notes = editForm.notes;

      await updateMutation.mutateAsync({ skuId, updates });
    } catch (error) {
      console.error('Errore nell\'aggiornamento prodotto:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingProduct(null);
    setEditForm({ price: '', leadTimeDays: '', notes: '' });
  };

  // Statistiche
  const activeProducts = catalog.filter(p => p.isActive).length;
  const totalProducts = catalog.length;
  const totalValue = catalog
    .filter(p => p.isActive && p.price)
    .reduce((sum, p) => sum + (p.price || 0), 0);

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Gestione Catalogo</h1>
            <p className="text-slate-600 mt-1">Controlla quali prodotti offrire e gestisci prezzi</p>
            {!currentOrgId && (
              <p className="text-amber-600 mt-2 text-sm">
                ⚠️ Nessuna organizzazione selezionata. Effettua il login per vedere il catalogo completo.
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-emerald-600">{activeProducts}/{totalProducts}</div>
              <div className="text-sm text-slate-600">Prodotti attivi</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-slate-900">€{totalValue.toLocaleString('it-IT')}</div>
              <div className="text-sm text-slate-600">Valore totale</div>
            </div>
          </div>
        </div>

        {/* Tabella Prodotti */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Prodotti Disponibili</h2>
            <p className="text-sm text-slate-600 mt-1">Attiva/disattiva prodotti nel tuo catalogo</p>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Caricamento prodotti...</p>
            </div>
          ) : catalog.length === 0 ? (
            <div className="p-8 space-y-6">
              {/* Catalogo non configurato */}
              <div className="text-center">
                <Package className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">Catalogo non ancora configurato</h3>
                <p className="text-slate-600 mb-4">Configura il tuo catalogo selezionando i prodotti DJI da offrire.</p>
                <div className="flex gap-3">
                  <Button
                    onClick={handleInitializeCatalog}
                    disabled={initializeMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    {initializeMutation.isPending ? 'Inizializzazione...' : 'Inizializza Catalogo'}
                  </Button>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h4 className="font-semibold text-amber-900 mb-2">⚠️ Ambiente Sandbox</h4>
                    <p className="text-amber-800 text-sm mb-3">
                      Le API non sono disponibili nella sandbox di Cursor. Per popolare il catalogo Lenzi
                      con tutti i prodotti DJI (2 unità stock ciascuno), usa il comando CLI:
                    </p>
                    <div className="bg-gray-800 text-green-400 p-3 rounded font-mono text-sm mb-3">
                      cd "/Users/macbook/Desktop/DJI Agras/DJI_Agricolture"<br/>
                      npm run seed:lenzi
                    </div>
                    <p className="text-amber-700 text-xs">
                      💡 Fuori dalla sandbox, usa l'interfaccia web o il comando CLI.
                      Il sistema aggiungerà automaticamente tutti i prodotti DJI al catalogo Lenzi.
                    </p>
                  </div>
                </div>
                {initializeMutation.isError && (
                  <p className="text-red-600 text-sm mt-2">Errore nell'inizializzazione del catalogo</p>
                )}
                {initializeMutation.isSuccess && (
                  <p className="text-emerald-600 text-sm mt-2">Catalogo inizializzato con successo!</p>
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Prodotto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Prezzo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Consegna
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Stock
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Stato
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {catalog.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            {product.productName}
                          </div>
                          <div className="text-sm text-slate-500">
                            {product.productModel}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {product.skuCode}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingProduct === product.id ? (
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-slate-400" />
                            <Input
                              type="number"
                              placeholder="€"
                              value={editForm.price}
                              onChange={(e) => setEditForm(prev => ({ ...prev, price: e.target.value }))}
                              className="w-24 h-8"
                            />
                          </div>
                        ) : (
                          <span className="text-sm font-medium text-slate-900">
                            {product.price ? `€${product.price.toLocaleString('it-IT')}` : 'N/D'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingProduct === product.id ? (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <Input
                              type="number"
                              placeholder="gg"
                              value={editForm.leadTimeDays}
                              onChange={(e) => setEditForm(prev => ({ ...prev, leadTimeDays: e.target.value }))}
                              className="w-16 h-8"
                            />
                          </div>
                        ) : (
                          <span className="text-sm text-slate-900">
                            {product.leadTimeDays ? `${product.leadTimeDays} gg` : 'N/D'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {product.stock} unità
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {product.location || 'N/D'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={product.isActive ? "default" : "secondary"}>
                          {product.isActive ? 'Attivo' : 'Disattivo'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleProduct(product.id, product.isActive)}
                            disabled={toggleMutation.isPending}
                            className={`p-1 rounded ${
                              product.isActive
                                ? 'text-red-600 hover:bg-red-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={product.isActive ? 'Disattiva prodotto' : 'Attiva prodotto'}
                          >
                            {product.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>

                          {editingProduct === product.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleSaveEdit(product.id)}
                                disabled={updateMutation.isPending}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                title="Salva modifiche"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="p-1 text-slate-600 hover:bg-slate-50 rounded"
                                title="Annulla modifiche"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleStartEdit(product)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="Modifica prodotto"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Note aggiuntive */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6 border border-blue-200">
          <div className="flex items-start gap-3">
            <Package className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900 mb-2">Come funziona il catalogo</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Attiva/Disattiva</strong>: I prodotti attivi appaiono nel catalogo pubblico raggruppati per azienda</li>
                <li>• <strong>Prezzi personalizzati</strong>: Ogni vendor imposta i propri prezzi e margini</li>
                <li>• <strong>Tempi consegna</strong>: Lead time specifico per la tua logistica</li>
                <li>• <strong>Stock</strong>: Gestione inventory per ogni prodotto nel tuo magazzino</li>
                <li>• <strong>Note</strong>: Informazioni aggiuntive visibili ai clienti nel catalogo</li>
                <li>• <strong>Inizializzazione</strong>: Primo accesso richiede inizializzazione del catalogo</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
