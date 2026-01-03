import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import {
  CreditCard,
  Truck,
  Lock,
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { getCart, createOrderFromCart, type CartResponse } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Checkout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Form data
  const [shippingAddress, setShippingAddress] = useState({
    name: "",
    company: "",
    address: "",
    city: "",
    province: "",
    postal_code: "",
    country: "Italia",
    phone: "",
  });

  const [billingAddress, setBillingAddress] = useState({
    name: "",
    company: "",
    address: "",
    city: "",
    province: "",
    postal_code: "",
    country: "Italia",
    phone: "",
    vat_number: "",
  });

  const [paymentData, setPaymentData] = useState({
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    cardholderName: "",
  });

  const [useSameAddress, setUseSameAddress] = useState(true);
  const [customerNotes, setCustomerNotes] = useState("");

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

  // Carica carrello
  const { data: cartData, isLoading: cartLoading } = useQuery({
    queryKey: ["cart", currentOrgId, currentUserId],
    queryFn: () => {
      if (!currentOrgId) throw new Error("Organizzazione non trovata");
      return getCart(currentOrgId, currentUserId || undefined);
    },
    enabled: !!currentOrgId,
  });

  // Mutazione per creare ordine
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!cartData?.cart?.id) {
        throw new Error("Carrello non trovato");
      }

      const billing = useSameAddress ? shippingAddress : billingAddress;

      return await createOrderFromCart({
        cartId: cartData.cart.id,
        shippingAddress,
        billingAddress: billing,
        customerNotes: customerNotes || undefined,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Ordine creato con successo!");
      navigate(`/ordini/${data.order.id}`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Errore nella creazione dell'ordine");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validazione base
    if (
      !paymentData.cardNumber ||
      !paymentData.expiryDate ||
      !paymentData.cvv ||
      !paymentData.cardholderName
    ) {
      toast.error("Compila tutti i campi di pagamento");
      return;
    }

    if (
      !shippingAddress.name ||
      !shippingAddress.address ||
      !shippingAddress.city
    ) {
      toast.error("Compila tutti i campi di spedizione");
      return;
    }

    // Simula pagamento Stripe (mock)
    try {
      // Simula chiamata Stripe
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Crea ordine
      createOrderMutation.mutate();
    } catch (error) {
      toast.error("Errore nel pagamento");
    }
  };

  const cartItems = cartData?.items || [];
  const cartTotal = cartItems.reduce((total, item) => {
    const itemPrice =
      item.unit_price_cents && item.unit_price_cents > 0
        ? item.unit_price_cents
        : 0;
    return total + (itemPrice * item.quantity) / 100;
  }, 0);
  const shippingCost = cartTotal > 500 ? 0 : 2.5;
  const total = cartTotal + shippingCost;

  if (!currentOrgId) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Accesso richiesto
            </h2>
            <p className="text-slate-600 mb-6">
              Devi essere loggato per procedere al checkout
            </p>
            <Link to="/login">
              <button className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700">
                Accedi
              </button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  if (cartLoading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p className="text-slate-600">Caricamento...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (cartItems.length === 0) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto py-12">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Carrello vuoto
            </h2>
            <p className="text-slate-600 mb-6">Il tuo carrello è vuoto</p>
            <Link to="/catalogo">
              <button className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700">
                Continua gli acquisti
              </button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto py-8">
        <Link
          to="/buyer/carrello"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Torna al carrello
        </Link>

        <h1 className="text-3xl font-bold text-slate-900 mb-8">Checkout</h1>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          {/* Form principale */}
          <div className="lg:col-span-2 space-y-6">
            {/* Indirizzo di spedizione */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Truck className="w-5 h-5 text-slate-600" />
                <h2 className="text-xl font-semibold text-slate-900">
                  Indirizzo di spedizione
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nome completo *
                  </label>
                  <Input
                    value={shippingAddress.name}
                    onChange={(e) =>
                      setShippingAddress({
                        ...shippingAddress,
                        name: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Azienda
                  </label>
                  <Input
                    value={shippingAddress.company}
                    onChange={(e) =>
                      setShippingAddress({
                        ...shippingAddress,
                        company: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Indirizzo *
                  </label>
                  <Input
                    value={shippingAddress.address}
                    onChange={(e) =>
                      setShippingAddress({
                        ...shippingAddress,
                        address: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Città *
                  </label>
                  <Input
                    value={shippingAddress.city}
                    onChange={(e) =>
                      setShippingAddress({
                        ...shippingAddress,
                        city: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Provincia *
                  </label>
                  <Input
                    value={shippingAddress.province}
                    onChange={(e) =>
                      setShippingAddress({
                        ...shippingAddress,
                        province: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    CAP *
                  </label>
                  <Input
                    value={shippingAddress.postal_code}
                    onChange={(e) =>
                      setShippingAddress({
                        ...shippingAddress,
                        postal_code: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Telefono *
                  </label>
                  <Input
                    value={shippingAddress.phone}
                    onChange={(e) =>
                      setShippingAddress({
                        ...shippingAddress,
                        phone: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              </div>
            </div>

            {/* Indirizzo di fatturazione */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-slate-600" />
                  <h2 className="text-xl font-semibold text-slate-900">
                    Indirizzo di fatturazione
                  </h2>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={useSameAddress}
                    onChange={(e) => setUseSameAddress(e.target.checked)}
                    className="rounded"
                  />
                  Stesso indirizzo di spedizione
                </label>
              </div>

              {!useSameAddress && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nome completo *
                    </label>
                    <Input
                      value={billingAddress.name}
                      onChange={(e) =>
                        setBillingAddress({
                          ...billingAddress,
                          name: e.target.value,
                        })
                      }
                      required={!useSameAddress}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Azienda
                    </label>
                    <Input
                      value={billingAddress.company}
                      onChange={(e) =>
                        setBillingAddress({
                          ...billingAddress,
                          company: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Indirizzo *
                    </label>
                    <Input
                      value={billingAddress.address}
                      onChange={(e) =>
                        setBillingAddress({
                          ...billingAddress,
                          address: e.target.value,
                        })
                      }
                      required={!useSameAddress}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Città *
                    </label>
                    <Input
                      value={billingAddress.city}
                      onChange={(e) =>
                        setBillingAddress({
                          ...billingAddress,
                          city: e.target.value,
                        })
                      }
                      required={!useSameAddress}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Provincia *
                    </label>
                    <Input
                      value={billingAddress.province}
                      onChange={(e) =>
                        setBillingAddress({
                          ...billingAddress,
                          province: e.target.value,
                        })
                      }
                      required={!useSameAddress}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      CAP *
                    </label>
                    <Input
                      value={billingAddress.postal_code}
                      onChange={(e) =>
                        setBillingAddress({
                          ...billingAddress,
                          postal_code: e.target.value,
                        })
                      }
                      required={!useSameAddress}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      P.IVA
                    </label>
                    <Input
                      value={billingAddress.vat_number}
                      onChange={(e) =>
                        setBillingAddress({
                          ...billingAddress,
                          vat_number: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Dati di pagamento */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Lock className="w-5 h-5 text-slate-600" />
                <h2 className="text-xl font-semibold text-slate-900">
                  Dati di pagamento
                </h2>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                  Stripe Mock
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nome sul carta *
                  </label>
                  <Input
                    value={paymentData.cardholderName}
                    onChange={(e) =>
                      setPaymentData({
                        ...paymentData,
                        cardholderName: e.target.value,
                      })
                    }
                    placeholder="Mario Rossi"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Numero carta *
                  </label>
                  <Input
                    value={paymentData.cardNumber}
                    onChange={(e) =>
                      setPaymentData({
                        ...paymentData,
                        cardNumber: e.target.value.replace(/\s/g, ""),
                      })
                    }
                    placeholder="4242 4242 4242 4242"
                    maxLength={16}
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Usa 4242 4242 4242 4242 per test
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Scadenza *
                    </label>
                    <Input
                      value={paymentData.expiryDate}
                      onChange={(e) =>
                        setPaymentData({
                          ...paymentData,
                          expiryDate: e.target.value,
                        })
                      }
                      placeholder="MM/AA"
                      maxLength={5}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      CVV *
                    </label>
                    <Input
                      type="password"
                      value={paymentData.cvv}
                      onChange={(e) =>
                        setPaymentData({ ...paymentData, cvv: e.target.value })
                      }
                      placeholder="123"
                      maxLength={3}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Note */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Note per l'ordine
              </label>
              <textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                rows={3}
                placeholder="Note aggiuntive per questo ordine..."
              />
            </div>
          </div>

          {/* Riepilogo */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Riepilogo ordine
              </h3>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">
                    Prodotti ({cartItems.length})
                  </span>
                  <span className="font-medium">€{cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Spedizione</span>
                  <span className="font-medium">
                    {shippingCost === 0
                      ? "Gratuita"
                      : `€${shippingCost.toFixed(2)}`}
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-3">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Totale</span>
                    <span>€{total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={createOrderMutation.isPending}
                className="w-full bg-emerald-600 text-white py-3 px-4 rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2 font-medium disabled:opacity-50"
              >
                {createOrderMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Elaborazione...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Completa l'acquisto
                  </>
                )}
              </Button>

              <p className="text-xs text-slate-500 text-center mt-3">
                Il pagamento viene processato in modo sicuro tramite Stripe
              </p>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
}
