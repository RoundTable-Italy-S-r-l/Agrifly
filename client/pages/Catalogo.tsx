import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { fetchPublicCatalog, CatalogProduct, BundleOffer } from "@/lib/api";
import {
  ShoppingBag,
  Clock,
  Package,
  Filter,
  Search,
  Star,
  Gift,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "react-router-dom";

// Componente per le card bundle sovrapposte
const BundleCard = ({ bundle }: { bundle: BundleOffer }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="relative group">
      {/* Contenitore principale con cornice verde */}
      <div className="relative bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-6 shadow-lg border-2 border-emerald-300 hover:border-emerald-400 transition-all duration-300 hover:shadow-xl">
        {/* Badge promozione */}
        <div className="absolute -top-3 left-4">
          <span className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
            🔥 BUNDLE
          </span>
        </div>

        {/* Header con nome e vendor */}
        <div className="mb-4">
          <h3 className="text-lg font-bold text-slate-900 mb-1">
            {bundle.name}
          </h3>
          <p className="text-sm text-emerald-700 font-medium">
            {bundle.vendorName}
          </p>
          <p className="text-xs text-slate-600 mt-1">{bundle.description}</p>
        </div>

        {/* Stack di carte sovrapposte */}
        <div className="relative mb-6" style={{ height: "200px" }}>
          {bundle.products.map((product, index) => (
            <div
              key={product.product_id}
              className={`absolute inset-0 bg-white rounded-lg shadow-md border-2 transition-all duration-300 ${
                hoveredIndex === index
                  ? "transform scale-105 z-20 border-blue-400 shadow-xl"
                  : hoveredIndex !== null && hoveredIndex !== index
                    ? "transform scale-95 z-10 opacity-70"
                    : "z-10 border-slate-200"
              }`}
              style={{
                transform: `translateX(${index * 8}px) translateY(${index * 4}px) ${hoveredIndex === index ? "scale(1.05)" : hoveredIndex !== null && hoveredIndex !== index ? "scale(0.95)" : "scale(1)"}`,
                zIndex: hoveredIndex === index ? 20 : 10 - index,
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div className="p-3 h-full flex flex-col justify-center items-center text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-2">
                  <Package className="w-6 h-6 text-slate-600" />
                </div>
                <p className="text-xs font-medium text-slate-900 leading-tight">
                  {product.name}
                </p>
                <p className="text-xs text-slate-500 mt-1">{product.model}</p>
                {product.quantity > 1 && (
                  <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full mt-1">
                    x{product.quantity}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Prezzo e risparmio */}
        <div className="text-center mb-4">
          <div className="text-2xl font-bold text-emerald-600 mb-1">
            €{bundle.bundlePrice.toLocaleString("it-IT")}
          </div>
          {bundle.savings && (
            <p className="text-sm text-emerald-700 font-medium">
              {bundle.savings}
            </p>
          )}
        </div>

        {/* Pulsante Dettagli */}
        <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
          <Gift className="w-4 h-4 mr-2" />
          Dettagli Bundle
        </Button>
      </div>
    </div>
  );
};

export default function Catalogo() {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");

  const { data: catalogData, isLoading } = useQuery({
    queryKey: ["publicCatalog", selectedCategory, minPrice, maxPrice],
    queryFn: () =>
      fetchPublicCatalog({
        category: selectedCategory || undefined,
        minPrice: minPrice ? parseInt(minPrice) : undefined,
        maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
      }),
    staleTime: 0, // Disabilitato per testing - mostra sempre dati freschi
    gcTime: 10 * 60 * 1000, // 10 minuti
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const products = catalogData?.products || [];
  const bundles = catalogData?.bundles || [];

  // Filtra prodotti per ricerca
  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Filtra bundle per ricerca
  const filteredBundles = bundles.filter(
    (bundle) =>
      bundle.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bundle.description.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Catalogo Prodotti
          </h1>
          <p className="text-slate-600">
            Scopri i prodotti offerti dalle nostre aziende partner
          </p>
        </div>

        {/* Filtri */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Filter className="w-5 h-5 text-slate-600" />
            <h3 className="font-semibold text-slate-900">Filtri</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Cerca
              </label>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Categoria
              </label>
              <Select
                value={selectedCategory}
                onValueChange={(value) =>
                  setSelectedCategory(value === "all" ? "" : value)
                }
              >
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

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Prezzo Min
              </label>
              <Input
                type="number"
                placeholder="€"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Prezzo Max
              </label>
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
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              Nessun prodotto trovato
            </h3>
            <p className="text-slate-600">
              Prova a modificare i filtri di ricerca
            </p>
          </div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="bg-slate-50 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  {/* Modello 3D GLB (priorità) o Immagine (fallback) */}
                  <div
                    className={`aspect-square rounded-lg mb-4 overflow-hidden ${
                      product.glbUrl
                        ? "bg-gradient-to-br from-slate-50 to-slate-100"
                        : "bg-white"
                    }`}
                  >
                    {product.glbUrl ? (
                      // @ts-ignore - model-viewer è un web component
                      <model-viewer
                        src={product.glbUrl}
                        alt={`Modello 3D ${product.name}`}
                        auto-rotate
                        camera-controls
                        interaction-policy="allow-when-focused"
                        style={{ width: "100%", height: "100%" }}
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
                      <h3 className="font-semibold text-slate-900 text-sm">
                        {product.name}
                      </h3>
                      <p className="text-xs text-slate-600">
                        {product.brand} {product.model}
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-emerald-600">
                        €
                        {(() => {
                          const rawPrice = product.price;
                          const price =
                            typeof rawPrice === "number"
                              ? rawPrice
                              : typeof rawPrice === "string" &&
                                  !isNaN(parseFloat(rawPrice))
                                ? parseFloat(rawPrice)
                                : 0;

                          if (
                            price === 0 &&
                            rawPrice !== 0 &&
                            rawPrice !== "0"
                          ) {
                            return "N/D";
                          }

                          // Mostra decimali solo se necessari
                          const hasDecimals = price % 1 !== 0;
                          return price.toLocaleString("it-IT", {
                            minimumFractionDigits: hasDecimals ? 2 : 0,
                            maximumFractionDigits: hasDecimals ? 2 : 0,
                          });
                        })()}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          product.stock && product.stock > 0
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {product.stock && product.stock > 0
                          ? `${product.stock} disponibili`
                          : "Esaurito"}
                      </span>
                    </div>

                    {product.leadTimeDays && (
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        <span>Consegna: {product.leadTimeDays} giorni</span>
                      </div>
                    )}

                    {product.vendorCount > 0 && (
                      <div className="text-xs text-slate-500">
                        Offered by {product.vendorCount}{" "}
                        {product.vendorCount === 1 ? "venditore" : "venditori"}
                      </div>
                    )}
                  </div>

                  {/* Azioni */}
                  <div className="mt-4 space-y-2">
                    <Link
                      to={`/prodotti/${product.productId || product.id}`}
                      className="block"
                    >
                      <Button variant="outline" className="w-full text-sm">
                        <Star className="w-4 h-4 mr-2" />
                        Visualizza prodotto
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Offerte Bundle */}
        {filteredBundles.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              🎁 Offerte Bundle
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredBundles.map((bundle) => (
                <BundleCard key={bundle.id} bundle={bundle} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
