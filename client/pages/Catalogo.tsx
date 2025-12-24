import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { fetchPublicCatalog, CatalogVendor, CatalogProduct } from '@/lib/api';
import {
  ShoppingBag,
  Building,
  Clock,
  Package,
  Filter,
  Search,
  Star,
  Truck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';

export default function Catalogo() {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');

  const { data: catalogData, isLoading } = useQuery({
    queryKey: ['publicCatalog', selectedCategory, selectedVendor, minPrice, maxPrice],
    queryFn: () => fetchPublicCatalog({
      category: selectedCategory || undefined,
      vendor: selectedVendor || undefined,
      minPrice: minPrice ? parseInt(minPrice) : undefined,
      maxPrice: maxPrice ? parseInt(maxPrice) : undefined
    }),
    staleTime: 5 * 60 * 1000, // 5 minuti
    gcTime: 10 * 60 * 1000, // 10 minuti
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });

  const vendors = catalogData?.vendors || [];

  // Filtra prodotti per ricerca
  const filteredVendors = vendors.map(vendor => ({
    ...vendor,
    products: vendor.products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(vendor => vendor.products.length > 0);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Catalogo Prodotti</h1>
          <p className="text-slate-600">Scopri i prodotti offerti dalle nostre aziende partner</p>
        </div>

        {/* Filtri */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Filter className="w-5 h-5 text-slate-600" />
            <h3 className="font-semibold text-slate-900">Filtri</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cerca</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Nome prodotto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
              <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tutte le categorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le categorie</SelectItem>
                  <SelectItem value="DRONE">Droni</SelectItem>
                  <SelectItem value="BATTERY">Batterie</SelectItem>
                  <SelectItem value="SPARE">Ricambi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {vendors.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Azienda</label>
                <Select value={selectedVendor} onValueChange={(value) => setSelectedVendor(value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tutte le aziende" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le aziende</SelectItem>
                    {vendors.map(vendor => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Prezzo Min</label>
              <Input
                type="number"
                placeholder="€"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Prezzo Max</label>
              <Input
                type="number"
                placeholder="€"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Catalogo */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Caricamento catalogo...</p>
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Nessun prodotto trovato</h3>
            <p className="text-slate-600">Prova a modificare i filtri di ricerca</p>
          </div>
        ) : (
          <div className="space-y-12">
            {filteredVendors.map(vendor => (
              <div key={vendor.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Header Vendor */}
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <Building className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">{vendor.name}</h2>
                      <p className="text-sm text-slate-600">{vendor.description}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {vendor.products.length} prodotto{vendor.products.length !== 1 ? 'i' : ''} disponibile
                      </p>
                    </div>
                  </div>
                </div>

                {/* Prodotti */}
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {vendor.products.map(product => (
                      <div key={product.id} className="bg-slate-50 rounded-lg p-4 hover:shadow-md transition-shadow">
                        {/* Modello 3D GLB o Immagine */}
                        <div className={`aspect-square rounded-lg mb-4 overflow-hidden ${
                          product.glbUrl 
                            ? 'bg-gradient-to-br from-slate-50 to-slate-100' 
                            : 'bg-white'
                        }`}>
                          {product.glbUrl ? (
                            // @ts-ignore - model-viewer è un web component
                            <model-viewer
                              src={product.glbUrl}
                              alt={`Modello 3D ${product.name}`}
                              auto-rotate
                              camera-controls
                              interaction-policy="allow-when-focused"
                              style={{ width: '100%', height: '100%' }}
                              className="object-contain"
                              loading="lazy"
                              camera-orbit="45deg 55deg 3m"
                              field-of-view="50deg"
                              min-camera-orbit="auto auto 2.5m"
                              max-camera-orbit="auto auto 5m"
                            />
                          ) : product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-full h-full object-contain p-4"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-50">
                            <Package className="w-16 h-16 text-slate-400" />
                            </div>
                          )}
                        </div>

                        {/* Info Prodotto */}
                        <div className="space-y-2">
                          <div>
                            <h3 className="font-semibold text-slate-900 text-sm">{product.name}</h3>
                            <p className="text-xs text-slate-600">{product.brand} {product.model}</p>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-lg font-bold text-emerald-600">
                              €{product.price.toLocaleString('it-IT')}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              product.stock > 0
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {product.stock > 0 ? `${product.stock} disponibili` : 'Esaurito'}
                            </span>
                          </div>

                          {product.leadTimeDays && (
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <Clock className="w-3 h-3" />
                              <span>Consegna: {product.leadTimeDays} giorni</span>
                            </div>
                          )}

                          <div className="text-xs text-slate-500">
                            Offered by {vendor.name}
                          </div>
                        </div>

                        {/* Azioni */}
                        <div className="mt-4 space-y-2">
                          <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm">
                            <ShoppingBag className="w-4 h-4 mr-2" />
                            Richiedi Preventivo
                          </Button>

                          {product.glbUrl && (
                            <Link
                              to={`/drones/${product.id}`}
                              className="block"
                            >
                              <Button variant="outline" className="w-full text-sm">
                                <Star className="w-4 h-4 mr-2" />
                                Visualizza prodotto
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}