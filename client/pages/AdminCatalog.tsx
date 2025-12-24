import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/AdminLayout';
import { fetchVendorCatalog, toggleVendorProduct, updateVendorProduct, initializeVendorCatalog, VendorCatalogItem, fetchOffers, createOffer, updateOffer, deleteOffer, Offer } from '@/lib/api';
import {
  Package,
  Edit,
  X,
  DollarSign,
  Clock,
  Eye,
  EyeOff,
  ShoppingBag,
  Gift,
  Tag,
  Plus,
  MapPin,
  Box,
  Trash2,
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function AdminCatalog() {
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('prodotti');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<VendorCatalogItem | null>(null);
  const [editForm, setEditForm] = useState({
    price: '',
    leadTimeDays: '',
    notes: '',
    stock: ''
  });
  const [bundleSheetOpen, setBundleSheetOpen] = useState(false);
  const [offerSheetOpen, setOfferSheetOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<Offer | null>(null);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);

  const queryClient = useQueryClient();

  // Ottieni l'ID dell'organizzazione corrente
  useEffect(() => {
    const orgData = localStorage.getItem('organization');
    console.log('📦 Organization data from localStorage:', orgData);
    if (orgData) {
      try {
        const org = JSON.parse(orgData);
        console.log('📦 Parsed organization:', org);
        if (org && org.id) {
          console.log('✅ Setting currentOrgId to:', org.id);
          setCurrentOrgId(org.id);
        } else {
          console.error('❌ Organization object non ha id:', org);
        }
      } catch (error) {
        console.error('❌ Errore nel parsing dei dati organizzazione:', error);
      }
    } else {
      console.warn('⚠️  Nessun dato organizzazione in localStorage');
    }
  }, []);

  // Query per catalogo vendor
  const { data: catalogData, isLoading } = useQuery({
    queryKey: ['vendorCatalog', currentOrgId],
    queryFn: () => currentOrgId ? fetchVendorCatalog(currentOrgId) : Promise.resolve({ catalog: [] }),
    enabled: !!currentOrgId
  });

  // Query per offerte (bundle e promo)
  const { data: offers = [], isLoading: offersLoading } = useQuery({
    queryKey: ['offers', currentOrgId],
    queryFn: () => currentOrgId ? fetchOffers(currentOrgId) : Promise.resolve([]),
    enabled: !!currentOrgId
  });

  const bundles = offers.filter(o => o.offer_type === 'BUNDLE');
  const promos = offers.filter(o => o.offer_type === 'PROMO' || o.offer_type === 'SEASON_PACKAGE');

  // Mutation per toggle prodotto
  const toggleMutation = useMutation({
    mutationFn: ({ skuId, isForSale }: { skuId: string; isForSale: boolean }) =>
      currentOrgId ? toggleVendorProduct(currentOrgId, skuId, isForSale) : Promise.reject('No org ID'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendorCatalog', currentOrgId] });
    },
    onError: (error) => {
      console.error('Errore nel toggle prodotto:', error);
    }
  });

  // Mutation per aggiornare prodotto
  const updateMutation = useMutation({
    mutationFn: ({ skuId, updates }: { skuId: string; updates: any }) =>
      currentOrgId ? updateVendorProduct(currentOrgId, skuId, updates) : Promise.reject('No org ID'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendorCatalog', currentOrgId] });
      setSheetOpen(false);
      setEditingProduct(null);
      setEditForm({ price: '', leadTimeDays: '', notes: '', stock: '' });
    }
  });

  // Mutation per inizializzare catalogo
  const initializeMutation = useMutation({
    mutationFn: () => currentOrgId ? initializeVendorCatalog(currentOrgId) : Promise.reject('No org ID'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendorCatalog', currentOrgId] });
    }
  });

  // Mutation per offerte
  const createOfferMutation = useMutation({
    mutationFn: (offer: any) => currentOrgId ? createOffer(currentOrgId, offer) : Promise.reject('No org ID'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers', currentOrgId] });
      setBundleSheetOpen(false);
      setOfferSheetOpen(false);
      setEditingBundle(null);
      setEditingOffer(null);
    }
  });

  const updateOfferMutation = useMutation({
    mutationFn: ({ offerId, updates }: { offerId: string; updates: any }) =>
      currentOrgId ? updateOffer(currentOrgId, offerId, updates) : Promise.reject('No org ID'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers', currentOrgId] });
      setBundleSheetOpen(false);
      setOfferSheetOpen(false);
      setEditingBundle(null);
      setEditingOffer(null);
    }
  });

  const deleteOfferMutation = useMutation({
    mutationFn: (offerId: string) => currentOrgId ? deleteOffer(currentOrgId, offerId) : Promise.reject('No org ID'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers', currentOrgId] });
    }
  });

  const catalog = catalogData?.catalog || [];

  const handleToggleProduct = async (skuId: string, currentStatus: boolean) => {
    try {
      console.log('🔄 Toggle prodotto:', { skuId, currentStatus, newStatus: !currentStatus });
      await toggleMutation.mutateAsync({ skuId, isForSale: !currentStatus });
    } catch (error) {
      console.error('Errore nel toggle prodotto:', error);
    }
  };

  const handleOpenEdit = (product: VendorCatalogItem) => {
    setEditingProduct(product);
    setEditForm({
      price: product.price?.toString() || '',
      leadTimeDays: product.leadTimeDays?.toString() || '',
      notes: product.notes || '',
      stock: product.stock?.toString() || ''
    });
    setSheetOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingProduct) return;

    try {
      const updates: any = {};
      if (editForm.price) updates.price = parseFloat(editForm.price);
      if (editForm.leadTimeDays) updates.leadTimeDays = parseInt(editForm.leadTimeDays);
      if (editForm.notes !== undefined) updates.notes = editForm.notes;
      if (editForm.stock !== undefined && editForm.stock !== '') {
        updates.stock = parseInt(editForm.stock);
      }

      await updateMutation.mutateAsync({ skuId: editingProduct.id, updates });
    } catch (error) {
      console.error('Errore nell\'aggiornamento prodotto:', error);
    }
  };

  const handleCloseSheet = () => {
    setSheetOpen(false);
    setEditingProduct(null);
    setEditForm({ price: '', leadTimeDays: '', notes: '', stock: '' });
  };

  // Statistiche semplificate
  const activeProducts = catalog.filter(p => p.isActive).length;

  // Formatta prezzo
  const formatPrice = (price: number | null) => {
    if (!price) return 'N/D';
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header con KPI semplificati */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Catalogo</h1>
            <p className="text-slate-600 mt-1">Gestisci prodotti, pacchetti e offerte</p>
          </div>
            <div className="text-right">
            <div className="text-2xl font-bold text-slate-900">{activeProducts}</div>
              <div className="text-sm text-slate-600">Prodotti attivi</div>
          </div>
        </div>

        {/* Tabs funzionali */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="prodotti" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Prodotti
            </TabsTrigger>
            <TabsTrigger value="pacchetti" className="flex items-center gap-2">
              <Gift className="w-4 h-4" />
              Pacchetti
            </TabsTrigger>
            <TabsTrigger value="offerte" className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Offerte
            </TabsTrigger>
          </TabsList>

          {/* Tab Prodotti */}
          <TabsContent value="prodotti" className="space-y-4">
            {!currentOrgId ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <p className="text-slate-600">Nessuna organizzazione selezionata</p>
                    <p className="text-sm text-slate-500 mt-2">Effettua il login per vedere il catalogo</p>
          </div>
                </CardContent>
              </Card>
            ) : isLoading ? (
              <Card>
                <CardContent className="py-12">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                    <span className="ml-2 text-slate-600">Caricamento prodotti...</span>
            </div>
                </CardContent>
              </Card>
          ) : catalog.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center space-y-4">
                    <Package className="w-12 h-12 text-slate-400 mx-auto" />
                    <h3 className="text-lg font-medium text-slate-900">Catalogo non ancora configurato</h3>
                    <p className="text-slate-600">Configura il tuo catalogo selezionando i prodotti DJI da offrire.</p>
                  <Button
                      onClick={() => initializeMutation.mutate()}
                    disabled={initializeMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    {initializeMutation.isPending ? 'Inizializzazione...' : 'Inizializza Catalogo'}
                  </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {catalog.map((product) => (
                  <Card key={product.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-1">{product.productName}</CardTitle>
                          <p className="text-sm text-slate-500">SKU: {product.skuCode}</p>
                          </div>
                        <Badge
                          variant={product.isActive ? "default" : "secondary"}
                          className={product.isActive ? "bg-emerald-100 text-emerald-700" : ""}
                        >
                          {product.isActive ? 'ATTIVO' : 'DISATTIVO'}
                        </Badge>
                          </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600 flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            Prezzo
                          </span>
                          <span className="text-lg font-semibold text-slate-900">
                            {formatPrice(product.price)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600 flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            Lead time
                          </span>
                          <span className="text-sm font-medium text-slate-900">
                            {product.leadTimeDays ? `${product.leadTimeDays} giorni` : 'N/D'}
                          </span>
                          </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600 flex items-center gap-1">
                            <Box className="w-4 h-4" />
                            Stock
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={async () => {
                                const newStock = Math.max(0, (product.stock || 0) - 1);
                                try {
                                  await updateMutation.mutateAsync({ 
                                    skuId: product.id, 
                                    updates: { stock: newStock } 
                                  });
                                } catch (error) {
                                  console.error('Errore aggiornamento stock:', error);
                                }
                              }}
                              disabled={updateMutation.isPending || (product.stock || 0) <= 0}
                            >
                              -
                            </Button>
                            <span className="text-sm font-medium text-slate-900 min-w-[3rem] text-center">
                              {product.stock || 0} unità
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={async () => {
                                const newStock = (product.stock || 0) + 1;
                                try {
                                  await updateMutation.mutateAsync({ 
                                    skuId: product.id, 
                                    updates: { stock: newStock } 
                                  });
                                } catch (error) {
                                  console.error('Errore aggiornamento stock:', error);
                                }
                              }}
                              disabled={updateMutation.isPending}
                            >
                              +
                            </Button>
                          </div>
                        </div>
                        {product.location && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600 flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              Location
                            </span>
                            <span className="text-sm text-slate-700">{product.location}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleOpenEdit(product)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Modifica
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleProduct(product.id, product.isActive)}
                          disabled={toggleMutation.isPending}
                          className={product.isActive ? "text-red-600 hover:text-red-700" : "text-emerald-600 hover:text-emerald-700"}
                        >
                          {product.isActive ? (
                            <>
                              <EyeOff className="w-4 h-4 mr-1" />
                              Disattiva
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4 mr-1" />
                              Attiva
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>


          {/* Tab Pacchetti */}
          <TabsContent value="pacchetti" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-900">Pacchetti</h2>
              <Button
                onClick={() => {
                  setEditingBundle(null);
                  setBundleSheetOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crea nuovo pacchetto
              </Button>
            </div>

            {offersLoading ? (
              <Card>
                <CardContent className="py-12">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                    <span className="ml-2 text-slate-600">Caricamento pacchetti...</span>
                  </div>
                </CardContent>
              </Card>
            ) : bundles.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <Gift className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 mb-2">Nessun pacchetto</h3>
                    <p className="text-slate-600 mb-4">Crea bundle strutturati (drone + batterie + training)</p>
                    <Button
                      onClick={() => {
                        setEditingBundle(null);
                        setBundleSheetOpen(true);
                      }}
                      variant="outline"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Crea nuovo pacchetto
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bundles.map((bundle) => {
                  const rules = bundle.rules_json as any;
                  return (
                    <Card key={bundle.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg">{bundle.name}</CardTitle>
                            <p className="text-sm text-slate-500 mt-1">
                              {new Date(bundle.valid_from).toLocaleDateString('it-IT')} - {bundle.valid_to ? new Date(bundle.valid_to).toLocaleDateString('it-IT') : 'Sempre'}
                            </p>
                          </div>
                          <Badge className={bundle.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : ''}>
                            {bundle.status === 'ACTIVE' ? 'ATTIVO' : 'INATTIVO'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 mb-4">
                          {rules.items && Array.isArray(rules.items) && (
                            <div>
                              <p className="text-sm font-medium text-slate-700 mb-1">Include:</p>
                              <ul className="text-sm text-slate-600 space-y-1">
                                {rules.items.map((item: any, idx: number) => (
                                  <li key={idx}>• {item.name || item.sku_code} (x{item.qty || 1})</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {rules.bundle_price && (
                            <div className="flex items-center justify-between pt-2 border-t">
                              <span className="text-sm text-slate-600">Prezzo pacchetto:</span>
                              <span className="text-lg font-semibold text-slate-900">
                                {formatPrice(rules.bundle_price)}
                          </span>
                            </div>
                          )}
                          {rules.discount_percent && (
                            <div className="text-sm text-emerald-600">
                              Sconto: -{rules.discount_percent}%
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setEditingBundle(bundle);
                              setBundleSheetOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Modifica
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteOfferMutation.mutate(bundle.id)}
                            disabled={deleteOfferMutation.isPending}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Tab Offerte */}
          <TabsContent value="offerte" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-900">Offerte</h2>
              <Button
                onClick={() => {
                  setEditingOffer(null);
                  setOfferSheetOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crea nuova offerta
              </Button>
            </div>

            {offersLoading ? (
              <Card>
                <CardContent className="py-12">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                    <span className="ml-2 text-slate-600">Caricamento offerte...</span>
                  </div>
                </CardContent>
              </Card>
            ) : promos.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <Tag className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 mb-2">Nessuna offerta</h3>
                    <p className="text-slate-600 mb-4">Crea promo temporanee e sconti stagionali</p>
                    <Button
                      onClick={() => {
                        setEditingOffer(null);
                        setOfferSheetOpen(true);
                      }}
                      variant="outline"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Crea nuova offerta
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {promos.map((promo) => {
                  const rules = promo.rules_json as any;
                  return (
                    <Card key={promo.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg">{promo.name}</CardTitle>
                            <p className="text-sm text-slate-500 mt-1">
                              {new Date(promo.valid_from).toLocaleDateString('it-IT')} - {promo.valid_to ? new Date(promo.valid_to).toLocaleDateString('it-IT') : 'Sempre'}
                            </p>
                          </div>
                          <Badge className={promo.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : ''}>
                            {promo.status === 'ACTIVE' ? 'ATTIVA' : 'INATTIVA'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-600">Tipo:</span>
                            <span className="text-sm font-medium text-slate-900">
                              {promo.offer_type === 'PROMO' ? 'Promo' : 'Pacchetto Stagionale'}
                            </span>
                          </div>
                          {rules.discount_type && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-600">Sconto:</span>
                              <span className="text-sm font-semibold text-emerald-600">
                                {rules.discount_type === 'PERCENT' ? `-${rules.discount_value}%` : `-${formatPrice(rules.discount_value)}`}
                              </span>
                            </div>
                          )}
                          {rules.applies_to && (
                            <div className="text-sm text-slate-600">
                              Applica a: {Array.isArray(rules.applies_to) ? rules.applies_to.join(', ') : rules.applies_to}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setEditingOffer(promo);
                              setOfferSheetOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Modifica
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteOfferMutation.mutate(promo.id)}
                            disabled={deleteOfferMutation.isPending}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}
          </TabsContent>
        </Tabs>

        {/* Sheet laterale per modifiche */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="right" className="w-full sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>
                Modifica prodotto – {editingProduct?.productName}
              </SheetTitle>
              <SheetDescription>
                Aggiorna prezzo, lead time, stock e note per questo prodotto
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="price">Prezzo base (€)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={editForm.price}
                  onChange={(e) => setEditForm(prev => ({ ...prev, price: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leadTime">Lead time (giorni)</Label>
                <Input
                  id="leadTime"
                  type="number"
                  placeholder="7"
                  value={editForm.leadTimeDays}
                  onChange={(e) => setEditForm(prev => ({ ...prev, leadTimeDays: e.target.value }))}
                />
        </div>
              <div className="space-y-2">
                <Label htmlFor="stock">Stock (unità disponibili)</Label>
                <Input
                  id="stock"
                  type="number"
                  placeholder="0"
                  value={editForm.stock}
                  onChange={(e) => setEditForm(prev => ({ ...prev, stock: e.target.value }))}
                />
                <p className="text-xs text-slate-500">
                  Quantità attualmente disponibile in magazzino
                </p>
            </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Note visibili al cliente</Label>
                <Textarea
                  id="notes"
                  placeholder="Informazioni aggiuntive sul prodotto..."
                  value={editForm.notes}
                  onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                />
          </div>
        </div>
            <SheetFooter className="mt-6">
              <SheetClose asChild>
                <Button variant="outline" onClick={handleCloseSheet}>
                  Annulla
                </Button>
              </SheetClose>
              <Button
                onClick={handleSaveEdit}
                disabled={updateMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {updateMutation.isPending ? 'Salvataggio...' : 'Salva modifiche'}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* Sheet per Bundle */}
        <BundleSheet
          open={bundleSheetOpen}
          onOpenChange={setBundleSheetOpen}
          bundle={editingBundle}
          catalog={catalog}
          currentOrgId={currentOrgId}
          onSave={(bundleData) => {
            if (editingBundle) {
              updateOfferMutation.mutate({ offerId: editingBundle.id, updates: bundleData });
            } else {
              createOfferMutation.mutate({ ...bundleData, offer_type: 'BUNDLE' });
            }
          }}
          isLoading={createOfferMutation.isPending || updateOfferMutation.isPending}
        />

        {/* Sheet per Offerte */}
        <OfferSheet
          open={offerSheetOpen}
          onOpenChange={setOfferSheetOpen}
          offer={editingOffer}
          catalog={catalog}
          currentOrgId={currentOrgId}
          onSave={(offerData) => {
            if (editingOffer) {
              updateOfferMutation.mutate({ offerId: editingOffer.id, updates: offerData });
            } else {
              createOfferMutation.mutate({ ...offerData, offer_type: 'PROMO' });
            }
          }}
          isLoading={createOfferMutation.isPending || updateOfferMutation.isPending}
        />
      </div>
    </AdminLayout>
  );
}

// Componente Sheet per Bundle
function BundleSheet({
  open,
  onOpenChange,
  bundle,
  catalog,
  currentOrgId,
  onSave,
  isLoading
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundle: Offer | null;
  catalog: VendorCatalogItem[];
  currentOrgId: string | null;
  onSave: (data: any) => void;
  isLoading: boolean;
}) {
  const formatPrice = (price: number | null) => {
    if (!price) return 'N/D';
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  };
  const [form, setForm] = useState({
    name: '',
    bundle_price: '',
    discount_percent: '',
    valid_from: '',
    valid_to: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    items: [] as Array<{ sku_id: string; qty: number }>
  });

  useEffect(() => {
    if (bundle) {
      const rules = bundle.rules_json as any;
      setForm({
        name: bundle.name,
        bundle_price: rules.bundle_price?.toString() || '',
        discount_percent: rules.discount_percent?.toString() || '',
        valid_from: new Date(bundle.valid_from).toISOString().split('T')[0],
        valid_to: bundle.valid_to ? new Date(bundle.valid_to).toISOString().split('T')[0] : '',
        status: bundle.status,
        items: rules.items || []
      });
    } else {
      setForm({
        name: '',
        bundle_price: '',
        discount_percent: '',
        valid_from: new Date().toISOString().split('T')[0],
        valid_to: '',
        status: 'ACTIVE',
        items: []
      });
    }
  }, [bundle, open]);

  const handleAddItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { sku_id: '', qty: 1 }]
    }));
  };

  const handleRemoveItem = (index: number) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleItemChange = (index: number, field: 'sku_id' | 'qty', value: string) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: field === 'qty' ? parseInt(value) || 1 : value } : item
      )
    }));
  };

  const handleSave = () => {
    const rules_json = {
      items: form.items.filter(item => item.sku_id),
      bundle_price: form.bundle_price ? parseFloat(form.bundle_price) : null,
      discount_percent: form.discount_percent ? parseFloat(form.discount_percent) : null
    };

    onSave({
      name: form.name,
      rules_json,
      valid_from: form.valid_from,
      valid_to: form.valid_to || null,
      status: form.status
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{bundle ? 'Modifica pacchetto' : 'Crea nuovo pacchetto'}</SheetTitle>
          <SheetDescription>
            Crea un bundle strutturato con più prodotti
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bundle-name">Nome pacchetto</Label>
            <Input
              id="bundle-name"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Es. Avvio Agricoltura 50ha"
            />
          </div>

          <div className="space-y-2">
            <Label>Prodotti inclusi</Label>
            <div className="space-y-2">
              {form.items.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={item.sku_id}
                    onValueChange={(value) => handleItemChange(index, 'sku_id', value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Seleziona prodotto" />
                    </SelectTrigger>
                    <SelectContent>
                      {catalog.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.productName} - {formatPrice(product.price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="1"
                    value={item.qty}
                    onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                    className="w-20"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveItem(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={handleAddItem}>
                <Plus className="w-4 h-4 mr-1" />
                Aggiungi prodotto
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bundle-price">Prezzo pacchetto (€)</Label>
              <Input
                id="bundle-price"
                type="number"
                step="0.01"
                value={form.bundle_price}
                onChange={(e) => setForm(prev => ({ ...prev, bundle_price: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount">Sconto (%)</Label>
              <Input
                id="discount"
                type="number"
                value={form.discount_percent}
                onChange={(e) => setForm(prev => ({ ...prev, discount_percent: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valid-from">Valido dal</Label>
              <Input
                id="valid-from"
                type="date"
                value={form.valid_from}
                onChange={(e) => setForm(prev => ({ ...prev, valid_from: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valid-to">Valido fino al</Label>
              <Input
                id="valid-to"
                type="date"
                value={form.valid_to}
                onChange={(e) => setForm(prev => ({ ...prev, valid_to: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bundle-status">Stato</Label>
            <Select
              value={form.status}
              onValueChange={(value: 'ACTIVE' | 'INACTIVE') => setForm(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Attivo</SelectItem>
                <SelectItem value="INACTIVE">Inattivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <SheetFooter className="mt-6">
          <SheetClose asChild>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
          </SheetClose>
          <Button
            onClick={handleSave}
            disabled={isLoading || !form.name || form.items.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isLoading ? 'Salvataggio...' : 'Salva pacchetto'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Componente Sheet per Offerte
function OfferSheet({
  open,
  onOpenChange,
  offer,
  catalog,
  currentOrgId,
  onSave,
  isLoading
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: Offer | null;
  catalog: VendorCatalogItem[];
  currentOrgId: string | null;
  onSave: (data: any) => void;
  isLoading: boolean;
}) {
  const formatPrice = (price: number | null) => {
    if (!price) return 'N/D';
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  };
  const [form, setForm] = useState({
    name: '',
    discount_type: 'PERCENT' as 'PERCENT' | 'FIXED',
    discount_value: '',
    applies_to: [] as string[],
    valid_from: '',
    valid_to: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE'
  });

  useEffect(() => {
    if (offer) {
      const rules = offer.rules_json as any;
      setForm({
        name: offer.name,
        discount_type: rules.discount_type || 'PERCENT',
        discount_value: rules.discount_value?.toString() || '',
        applies_to: rules.applies_to || [],
        valid_from: new Date(offer.valid_from).toISOString().split('T')[0],
        valid_to: offer.valid_to ? new Date(offer.valid_to).toISOString().split('T')[0] : '',
        status: offer.status
      });
    } else {
      setForm({
        name: '',
        discount_type: 'PERCENT',
        discount_value: '',
        applies_to: [],
        valid_from: new Date().toISOString().split('T')[0],
        valid_to: '',
        status: 'ACTIVE'
      });
    }
  }, [offer, open]);

  const handleToggleProduct = (skuId: string) => {
    setForm(prev => ({
      ...prev,
      applies_to: prev.applies_to.includes(skuId)
        ? prev.applies_to.filter(id => id !== skuId)
        : [...prev.applies_to, skuId]
    }));
  };

  const handleSave = () => {
    const rules_json = {
      discount_type: form.discount_type,
      discount_value: form.discount_type === 'PERCENT' 
        ? parseFloat(form.discount_value) 
        : parseFloat(form.discount_value) * 100, // Converti in centesimi per FIXED
      applies_to: form.applies_to
    };

    onSave({
      name: form.name,
      rules_json,
      valid_from: form.valid_from,
      valid_to: form.valid_to || null,
      status: form.status
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{offer ? 'Modifica offerta' : 'Crea nuova offerta'}</SheetTitle>
          <SheetDescription>
            Crea una promo temporanea o sconto stagionale
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="offer-name">Nome offerta</Label>
            <Input
              id="offer-name"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Es. Promo Primavera Agras"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="discount-type">Tipo sconto</Label>
              <Select
                value={form.discount_type}
                onValueChange={(value: 'PERCENT' | 'FIXED') => setForm(prev => ({ ...prev, discount_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT">Percentuale (%)</SelectItem>
                  <SelectItem value="FIXED">Importo fisso (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount-value">Valore</Label>
              <Input
                id="discount-value"
                type="number"
                step={form.discount_type === 'PERCENT' ? '1' : '0.01'}
                value={form.discount_value}
                onChange={(e) => setForm(prev => ({ ...prev, discount_value: e.target.value }))}
                placeholder={form.discount_type === 'PERCENT' ? '10' : '100.00'}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Applica a prodotti</Label>
            <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
              {catalog.map((product) => (
                <label key={product.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.applies_to.includes(product.id)}
                    onChange={() => handleToggleProduct(product.id)}
                    className="rounded"
                  />
                  <span className="text-sm">{product.productName}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="offer-valid-from">Valida dal</Label>
              <Input
                id="offer-valid-from"
                type="date"
                value={form.valid_from}
                onChange={(e) => setForm(prev => ({ ...prev, valid_from: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="offer-valid-to">Valida fino al</Label>
              <Input
                id="offer-valid-to"
                type="date"
                value={form.valid_to}
                onChange={(e) => setForm(prev => ({ ...prev, valid_to: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="offer-status">Stato</Label>
            <Select
              value={form.status}
              onValueChange={(value: 'ACTIVE' | 'INACTIVE') => setForm(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Attiva</SelectItem>
                <SelectItem value="INACTIVE">Inattiva</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <SheetFooter className="mt-6">
          <SheetClose asChild>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
          </SheetClose>
          <Button
            onClick={handleSave}
            disabled={isLoading || !form.name || !form.discount_value || form.applies_to.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isLoading ? 'Salvataggio...' : 'Salva offerta'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
