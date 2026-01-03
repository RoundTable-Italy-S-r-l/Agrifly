import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BuyerLayout } from "@/components/BuyerLayout";
import {
  ShoppingCart,
  Heart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Truck,
  Package,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  getCart,
  updateCartItem,
  removeFromCart,
  getWishlist,
  removeFromWishlist,
  type CartItem,
  type WishlistItem,
} from "@/lib/api";

export default function CartBuyer() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Ottieni dati utente/org
  useEffect(() => {
    const orgData = localStorage.getItem("organization");
    const userData = localStorage.getItem("user");

    if (orgData) {
      try {
        const org = JSON.parse(orgData);
        setCurrentOrgId(org.id);
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

  // Query per carrello
  const { data: cartData, isLoading: cartLoading } = useQuery({
    queryKey: ["cart", currentOrgId, currentUserId],
    queryFn: () => {
      if (!currentOrgId) throw new Error("Organizzazione non trovata");
      return getCart(currentOrgId, currentUserId || undefined);
    },
    enabled: !!currentOrgId,
  });

  // Query per wishlist
  const { data: wishlistData, isLoading: wishlistLoading } = useQuery({
    queryKey: ["wishlist", currentOrgId],
    queryFn: () => {
      if (!currentOrgId) throw new Error("Organizzazione non trovata");
      return getWishlist(currentOrgId);
    },
    enabled: !!currentOrgId,
  });

  // Mutazioni per carrello
  const updateCartMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      updateCartItem(itemId, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      toast.success("Carrello aggiornato");
    },
    onError: (error: any) => {
      toast.error(error.message || "Errore aggiornamento carrello");
    },
  });

  const removeCartMutation = useMutation({
    mutationFn: (itemId: string) => removeFromCart(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      toast.success("Prodotto rimosso dal carrello");
    },
    onError: (error: any) => {
      toast.error(error.message || "Errore rimozione prodotto");
    },
  });

  // Mutazioni per wishlist
  const removeWishlistMutation = useMutation({
    mutationFn: (itemId: string) => removeFromWishlist(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      toast.success("Prodotto rimosso dalla wishlist");
    },
    onError: (error: any) => {
      toast.error(error.message || "Errore rimozione dalla wishlist");
    },
  });

  const cartItems = cartData?.items || [];
  const wishlistItems = wishlistData || [];

  // Calcola totali
  const subtotal = cartItems.reduce((sum, item) => {
    const price = item.unit_price_cents || 0;
    return sum + price * item.quantity;
  }, 0);

  const shipping = subtotal > 50000 ? 0 : 2500; // Spedizione gratuita sopra €500
  const total = subtotal + shipping;

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(cents / 100);
  };

  return (
    <BuyerLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Carrello & Wishlist
            </h1>
            <p className="text-slate-600 mt-1">
              Gestisci i tuoi acquisti e prodotti preferiti
            </p>
          </div>
        </div>

        {/* Carrello */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-slate-900">
                Carrello ({cartItems.length} prodotti)
              </h2>
            </div>
          </div>

          <div className="p-6">
            {cartLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                <span className="ml-2 text-slate-600">
                  Caricamento carrello...
                </span>
              </div>
            ) : cartItems.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">
                  Il carrello è vuoto
                </h3>
                <p className="text-slate-600 mb-6">
                  Aggiungi prodotti dal catalogo per iniziare gli acquisti
                </p>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <ArrowRight className="w-4 h-4" />
                  Vai al Catalogo
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Lista prodotti */}
                <div className="space-y-4">
                  {cartItems.map((item: CartItem) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg"
                    >
                      <div className="w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center">
                        <Package className="w-8 h-8 text-slate-400" />
                      </div>

                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900">
                          {item.product_name}
                        </h4>
                        <p className="text-sm text-slate-600">
                          {item.product_model} • {item.brand}
                        </p>
                        <p className="text-sm text-slate-500">
                          SKU: {item.sku_code}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Controlli quantità */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              updateCartMutation.mutate({
                                itemId: item.id,
                                quantity: Math.max(1, item.quantity - 1),
                              })
                            }
                            disabled={updateCartMutation.isPending}
                            className="p-1 hover:bg-slate-200 rounded"
                          >
                            <Minus className="w-4 h-4" />
                          </button>

                          <span className="w-8 text-center font-medium">
                            {item.quantity}
                          </span>

                          <button
                            onClick={() =>
                              updateCartMutation.mutate({
                                itemId: item.id,
                                quantity: item.quantity + 1,
                              })
                            }
                            disabled={updateCartMutation.isPending}
                            className="p-1 hover:bg-slate-200 rounded"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Prezzo */}
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">
                            {formatPrice(
                              (item.unit_price_cents || 0) * item.quantity,
                            )}
                          </p>
                          {item.unit_price_cents && (
                            <p className="text-sm text-slate-500">
                              {formatPrice(item.unit_price_cents)} cad.
                            </p>
                          )}
                        </div>

                        {/* Rimuovi */}
                        <button
                          onClick={() => removeCartMutation.mutate(item.id)}
                          disabled={removeCartMutation.isPending}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Riepilogo e Checkout */}
                <div className="border-t border-slate-200 pt-6">
                  <div className="bg-slate-50 rounded-lg p-6 space-y-4">
                    <h3 className="font-semibold text-slate-900">
                      Riepilogo Ordine
                    </h3>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotale</span>
                        <span>{formatPrice(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Spedizione</span>
                        <span
                          className={shipping === 0 ? "text-green-600" : ""}
                        >
                          {shipping === 0 ? "Gratuita" : formatPrice(shipping)}
                        </span>
                      </div>
                      {subtotal < 50000 && (
                        <p className="text-xs text-slate-500">
                          Spedizione gratuita sopra €500
                        </p>
                      )}
                      <div className="border-t border-slate-200 pt-2 flex justify-between font-semibold">
                        <span>Totale</span>
                        <span>{formatPrice(total)}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        // Controlla se l'utente è autenticato
                        const userData = localStorage.getItem("user");
                        if (!userData) {
                          // Reindirizza al login con redirect
                          navigate("/login?redirect=/buyer/carrello");
                          return;
                        }
                        // TODO: Naviga al checkout
                        alert("Checkout in sviluppo...");
                      }}
                      className="w-full bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <CreditCard className="w-5 h-5" />
                      Procedi al Checkout
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Wishlist */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <Heart className="w-5 h-5 text-red-500" />
              <h2 className="text-lg font-semibold text-slate-900">
                Wishlist ({wishlistItems.length} prodotti)
              </h2>
            </div>
          </div>

          <div className="p-6">
            {wishlistLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                <span className="ml-2 text-slate-600">
                  Caricamento wishlist...
                </span>
              </div>
            ) : wishlistItems.length === 0 ? (
              <div className="text-center py-8">
                <Heart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">
                  La wishlist è vuota
                </h3>
                <p className="text-slate-600">
                  Aggiungi prodotti preferiti dal catalogo
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {wishlistItems.map((item: WishlistItem) => (
                  <div
                    key={item.id}
                    className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900">
                          {item.product_name}
                        </h4>
                        <p className="text-sm text-slate-600">
                          {item.product_model}
                        </p>
                        <p className="text-sm text-slate-500">{item.brand}</p>
                      </div>
                      <button
                        onClick={() => removeWishlistMutation.mutate(item.id)}
                        disabled={removeWishlistMutation.isPending}
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {item.note && (
                      <p className="text-sm text-slate-600 mb-3 italic">
                        "{item.note}"
                      </p>
                    )}

                    <div className="flex gap-2">
                      <Link
                        to={`/prodotti/${item.sku_id}`}
                        className="flex-1 text-center px-3 py-2 bg-slate-100 text-slate-700 rounded text-sm font-medium hover:bg-slate-200 transition-colors"
                      >
                        Vedi Dettagli
                      </Link>
                      <button className="px-3 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 transition-colors">
                        <ShoppingCart className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </BuyerLayout>
  );
}
