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
  Lock,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  getCart,
  updateCartItem,
  removeFromCart,
  getWishlist,
  removeFromWishlist,
  fetchOrders,
  type CartItem,
  type WishlistItem,
  type Order,
} from "@/lib/api";

export default function Carrello() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Ottieni dati utente/org
  useEffect(() => {
    const orgData = localStorage.getItem("organization");
    const token = localStorage.getItem("auth_token");

    if (orgData) {
      try {
        const org = JSON.parse(orgData);
        setCurrentOrgId(org.id);
      } catch (error) {
        console.error("Errore parsing organization:", error);
      }
    } else {
      // Guest user: salva redirect per dopo login/registrazione
      localStorage.setItem("post_login_redirect", "/buyer/carrello");

      // Per utenti guest, usa 'guest_org' come placeholder (coerente con backend)
      setCurrentOrgId("guest_org");

      // Per utenti guest, genera/usa sessionId
      let session = localStorage.getItem("session_id");
      if (!session) {
        session = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem("session_id", session);
      }
      setSessionId(session);
    }

    if (token) {
      try {
        const parts = token.split(".");
        const body = parts.length === 3 ? parts[1] : parts[0];
        const base64 = body.replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
        const decoded = atob(padded);
        setCurrentUser(JSON.parse(decoded));
      } catch (error) {
        console.error("Errore parsing token:", error);
      }
    }
  }, []);

  const { data: cartData, isLoading: cartLoading } = useQuery({
    queryKey: ["cart", currentOrgId, currentUser?.userId, sessionId],
    queryFn: () => {
      // Per guest users, sessionId è sufficiente (orgId è 'guest_org')
      if (!currentOrgId && !sessionId)
        throw new Error("Session ID o Organizzazione richiesta");
      // Passa currentOrgId (che sarà 'guest_org' per guest) e sessionId
      return getCart(currentOrgId, currentUser?.userId, sessionId || undefined);
    },
    enabled: !!currentOrgId || !!sessionId,
  });

  // Query per wishlist (solo se autenticato con orgId reale)
  const { data: wishlistData, isLoading: wishlistLoading } = useQuery({
    queryKey: ["wishlist", currentOrgId],
    queryFn: () => {
      if (!currentOrgId || currentOrgId === "guest_org")
        throw new Error("Organizzazione non trovata");
      return getWishlist(currentOrgId);
    },
    enabled: !!currentOrgId && !!currentUser && currentOrgId !== "guest_org",
  });

  // Query per ordini (solo se autenticato con orgId reale, non guest)
  // IMPORTANTE: passa role='buyer' per filtrare correttamente gli ordini
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["orders", currentOrgId, "buyer"],
    queryFn: () => {
      if (!currentOrgId || currentOrgId === "guest_org")
        throw new Error("Organizzazione non trovata");
      console.log("🛒 Fetching orders for buyer org:", currentOrgId);
      return fetchOrders(currentOrgId, "buyer");
    },
    enabled: !!currentOrgId && !!currentUser && currentOrgId !== "guest_org",
  });

  // Mutazioni per carrello
  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      updateCartItem(itemId, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      window.dispatchEvent(new CustomEvent("cartUpdated"));
      toast.success("Quantità aggiornata");
    },
    onError: () => {
      toast.error("Errore nell'aggiornamento della quantità");
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => removeFromCart(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      window.dispatchEvent(new CustomEvent("cartUpdated"));
      toast.success("Prodotto rimosso dal carrello");
    },
    onError: () => {
      toast.error("Errore nella rimozione del prodotto");
    },
  });

  const removeFromWishlistMutation = useMutation({
    mutationFn: (itemId: string) => removeFromWishlist(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      window.dispatchEvent(new CustomEvent("cartUpdated"));
      toast.success("Prodotto rimosso dalla wishlist");
    },
    onError: () => {
      toast.error("Errore nella rimozione dalla wishlist");
    },
  });

  const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    updateItemMutation.mutate({ itemId, quantity: newQuantity });
  };

  const handleRemoveItem = (itemId: string) => {
    removeItemMutation.mutate(itemId);
  };

  const handleRemoveFromWishlist = (itemId: string) => {
    removeFromWishlistMutation.mutate(itemId);
  };

  const handleCheckout = () => {
    if (!currentUser) {
      // Utente non autenticato - vai al login con redirect al checkout
      navigate("/login?redirect=/checkout");
      return;
    }
    // Utente autenticato - vai al checkout
    navigate("/checkout");
  };

  const cartItems = cartData?.items || [];
  const wishlistItems = wishlistData?.items || [];
  const orders = ordersData || [];
  const cartTotal = cartItems.reduce((total, item) => {
    const itemPrice =
      item.unit_price_cents && item.unit_price_cents > 0
        ? item.unit_price_cents
        : 0;
    return total + (itemPrice * item.quantity) / 100;
  }, 0);

  if (!currentOrgId) {
    return (
      <BuyerLayout>
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Seleziona un'organizzazione
            </h2>
            <p className="text-slate-600 mb-6">
              Devi selezionare un'organizzazione per visualizzare il carrello
            </p>
            <Link to="/login">
              <button className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700">
                Accedi
              </button>
            </Link>
          </div>
        </div>
      </BuyerLayout>
    );
  }

  return (
    <BuyerLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Carrello e Wishlist
          </h1>
          <p className="text-slate-600">
            Gestisci i tuoi prodotti preferiti e procedi all'acquisto
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Carrello */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="w-6 h-6 text-slate-600" />
                  <h2 className="text-xl font-semibold text-slate-900">
                    Carrello
                  </h2>
                  <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-full text-sm">
                    {cartItems.length} prodott
                    {cartItems.length !== 1 ? "i" : "o"}
                  </span>
                </div>
              </div>

              <div className="p-6">
                {cartLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                    <p className="text-slate-600">Caricamento carrello...</p>
                  </div>
                ) : cartItems.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 mb-2">
                      Il carrello è vuoto
                    </h3>
                    <p className="text-slate-600 mb-6">
                      {sessionId
                        ? "Aggiungi alcuni prodotti dal nostro catalogo per iniziare i tuoi acquisti"
                        : "Aggiungi alcuni prodotti dal nostro catalogo per iniziare i tuoi acquisti"}
                    </p>
                    <Link to="/catalogo">
                      <button className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700">
                        Sfoglia catalogo
                      </button>
                    </Link>
                  </div>
                ) : (
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
                          <h3 className="font-medium text-slate-900">
                            {item.product_name ||
                              item.product_model ||
                              `Prodotto #${item.sku_id}`}
                          </h3>
                          {item.product_model && item.brand && (
                            <p className="text-sm text-slate-600">
                              {item.product_model} • {item.brand}
                            </p>
                          )}
                          {item.sku_code && (
                            <p className="text-xs text-slate-500">
                              SKU: {item.sku_code}
                            </p>
                          )}
                          <p className="text-sm text-slate-600 mt-1">
                            {item.unit_price_cents && item.unit_price_cents > 0
                              ? `€${(item.unit_price_cents / 100).toFixed(2)} cadauno`
                              : "Prezzo da confermare"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              handleUpdateQuantity(item.id, item.quantity - 1)
                            }
                            disabled={item.quantity <= 1}
                            className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-50"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center font-medium">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              handleUpdateQuantity(item.id, item.quantity + 1)
                            }
                            className="p-1 text-slate-400 hover:text-slate-600"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">
                            {item.unit_price_cents && item.unit_price_cents > 0
                              ? `€${((item.unit_price_cents * item.quantity) / 100).toFixed(2)}`
                              : "Da confermare"}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-2 text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Wishlist - solo se autenticato */}
            {currentUser && !sessionId && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <Heart className="w-6 h-6 text-red-500" />
                    <h2 className="text-xl font-semibold text-slate-900">
                      Wishlist
                    </h2>
                    <span className="bg-red-100 text-red-600 px-2 py-1 rounded-full text-sm">
                      {wishlistItems.length} prodott
                      {wishlistItems.length !== 1 ? "i" : "o"}
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  {wishlistLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                      <p className="text-slate-600">Caricamento wishlist...</p>
                    </div>
                  ) : wishlistItems.length === 0 ? (
                    <div className="text-center py-8">
                      <Heart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-600">La tua wishlist è vuota</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {wishlistItems.map((item: WishlistItem) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-4 p-4 bg-red-50 rounded-lg"
                        >
                          <div className="w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center">
                            <Package className="w-8 h-8 text-slate-400" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium text-slate-900">
                              Prodotto #{item.sku_id}
                            </h3>
                          </div>
                          <div className="flex gap-2">
                            <button className="px-3 py-1 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700">
                              Aggiungi al carrello
                            </button>
                            <button
                              onClick={() => handleRemoveFromWishlist(item.id)}
                              className="p-2 text-red-400 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Ordini - solo se autenticato con orgId reale (non guest) */}
            {currentUser &&
              currentOrgId &&
              currentOrgId !== "guest_org" &&
              !sessionId && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-6 h-6 text-emerald-600" />
                      <h2 className="text-xl font-semibold text-slate-900">
                        I tuoi ordini
                      </h2>
                      <span className="bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full text-sm">
                        {orders.length} ordin{orders.length !== 1 ? "i" : "e"}
                      </span>
                    </div>
                  </div>

                  <div className="p-6">
                    {ordersLoading ? (
                      <div className="text-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                        <p className="text-slate-600">Caricamento ordini...</p>
                      </div>
                    ) : orders.length === 0 ? (
                      <div className="text-center py-8">
                        <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-600">Nessun ordine ancora</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {orders.map((order: Order) => (
                          <Link
                            key={order.id}
                            to={`/ordini/${order.id}`}
                            className="block p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <h3 className="font-semibold text-slate-900">
                                  {order.order_number ||
                                    `Ordine #${order.id.substring(0, 8)}`}
                                </h3>
                                <p className="text-sm text-slate-600">
                                  {new Date(
                                    order.created_at,
                                  ).toLocaleDateString("it-IT", {
                                    day: "2-digit",
                                    month: "long",
                                    year: "numeric",
                                  })}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-emerald-600">
                                  €{(order.total_cents / 100).toFixed(2)}
                                </p>
                                <span
                                  className={`text-xs px-2 py-1 rounded ${
                                    order.status === "CONFIRMED" ||
                                    order.status === "DELIVERED"
                                      ? "bg-green-100 text-green-700"
                                      : order.status === "PENDING"
                                        ? "bg-yellow-100 text-yellow-700"
                                        : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {order.status === "CONFIRMED"
                                    ? "Confermato"
                                    : order.status === "DELIVERED"
                                      ? "Consegnato"
                                      : order.status === "SHIPPED"
                                        ? "Spedito"
                                        : order.status === "PENDING"
                                          ? "In attesa"
                                          : order.status}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Package className="w-4 h-4" />
                              <span>
                                {order.order_lines?.length || 0} prodotto
                                {(order.order_lines?.length || 0) !== 1
                                  ? "i"
                                  : ""}
                              </span>
                              {order.order_lines &&
                                order.order_lines.length > 0 && (
                                  <>
                                    <span>•</span>
                                    <span>
                                      {order.order_lines[0].product_name ||
                                        order.order_lines[0].product_model ||
                                        "Prodotto"}
                                    </span>
                                    {order.order_lines.length > 1 && (
                                      <span>
                                        e altri {order.order_lines.length - 1}
                                      </span>
                                    )}
                                  </>
                                )}
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
          </div>

          {/* Riepilogo e Checkout */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Riepilogo ordine
              </h3>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-slate-600">
                    Prodotti ({cartItems.length})
                  </span>
                  <span className="font-medium">€{cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Spedizione</span>
                  <span className="font-medium">Gratuita</span>
                </div>
                <div className="border-t border-slate-200 pt-3">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Totale</span>
                    <span>€{cartTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {cartItems.length > 0 && (
                <button
                  onClick={handleCheckout}
                  className="w-full bg-emerald-600 text-white py-3 px-4 rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2 font-medium"
                >
                  {currentUser ? (
                    <>
                      <CreditCard className="w-4 h-4" />
                      Procedi al checkout
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Accedi per acquistare
                    </>
                  )}
                </button>
              )}

              {!currentUser && (
                <p className="text-xs text-slate-500 text-center mt-2">
                  Accedi per completare l'acquisto e salvare la cronologia
                  ordini
                </p>
              )}
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                <Truck className="w-4 h-4" />
                <span className="font-medium">Spedizione gratuita</span>
              </div>
              <p className="text-xs text-slate-500">
                Consegna entro 3-5 giorni lavorativi per ordini superiori a €500
              </p>
            </div>
          </div>
        </div>
      </div>
    </BuyerLayout>
  );
}
