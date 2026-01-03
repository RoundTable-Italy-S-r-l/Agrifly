import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BuyerLayout } from "@/components/BuyerLayout";
import {
  ArrowLeft,
  Package,
  Truck,
  CreditCard,
  CheckCircle,
  Loader2,
  AlertCircle,
  MapPin,
  FileText,
} from "lucide-react";
import { fetchOrderById, type Order } from "@/lib/api";
import { toast } from "sonner";
import { OrderChat } from "@/components/OrderChat";
import { useState, useEffect } from "react";

export default function OrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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

  const {
    data: order,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => {
      if (!orderId) throw new Error("Order ID required");
      return fetchOrderById(orderId);
    },
    enabled: !!orderId,
  });

  if (isLoading) {
    return (
      <BuyerLayout>
        <div className="max-w-6xl mx-auto py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p className="text-slate-600">Caricamento ordine...</p>
          </div>
        </div>
      </BuyerLayout>
    );
  }

  if (error || !order) {
    return (
      <BuyerLayout>
        <div className="max-w-6xl mx-auto py-12">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Ordine non trovato
            </h2>
            <p className="text-slate-600 mb-6">
              L'ordine richiesto non esiste o non è accessibile
            </p>
            <Link to="/buyer/carrello">
              <button className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700">
                Torna al carrello
              </button>
            </Link>
          </div>
        </div>
      </BuyerLayout>
    );
  }

  const subtotal = (order.subtotal_cents || 0) / 100;
  const tax = (order.tax_cents || 0) / 100;
  const shipping = (order.shipping_cents || 0) / 100;
  const total = order.total_cents / 100;

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

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                {order.order_number || `Ordine #${order.id.substring(0, 8)}`}
              </h1>
              <p className="text-slate-600">
                Ordine del{" "}
                {new Date(order.created_at).toLocaleDateString("it-IT", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="text-right">
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  order.status === "CONFIRMED" || order.status === "DELIVERED"
                    ? "bg-green-100 text-green-700"
                    : order.status === "PENDING"
                      ? "bg-yellow-100 text-yellow-700"
                      : order.status === "SHIPPED"
                        ? "bg-blue-100 text-blue-700"
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
              <p className="text-xs text-slate-500 mt-1">
                Pagamento:{" "}
                {order.payment_status === "PAID"
                  ? "Pagato"
                  : order.payment_status}
              </p>
            </div>
          </div>

          {order.tracking_number && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-semibold text-blue-900">
                    Numero di tracking
                  </p>
                  <p className="text-sm text-blue-700">
                    {order.tracking_number}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Prodotti ordinati */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Prodotti ordinati
              </h2>

              <div className="space-y-4">
                {order.order_lines.map((line) => (
                  <div
                    key={line.id}
                    className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg"
                  >
                    <div className="w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center">
                      <Package className="w-8 h-8 text-slate-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-900">
                        {line.product_name ||
                          line.product_model ||
                          `Prodotto #${line.sku_id}`}
                      </h3>
                      {line.product_model && line.brand && (
                        <p className="text-sm text-slate-600">
                          {line.product_model} • {line.brand}
                        </p>
                      )}
                      {line.sku_code && (
                        <p className="text-xs text-slate-500">
                          SKU: {line.sku_code}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-600">
                        Quantità: {line.quantity}
                      </p>
                      <p className="font-semibold text-slate-900">
                        €{((line.line_total_cents || 0) / 100).toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-500">
                        €{((line.unit_price_cents || 0) / 100).toFixed(2)}{" "}
                        cadauno
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Indirizzi */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {order.shipping_address && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Truck className="w-5 h-5" />
                    Indirizzo di spedizione
                  </h3>
                  <div className="space-y-1 text-sm text-slate-600">
                    {order.shipping_address.name && (
                      <p className="font-medium text-slate-900">
                        {order.shipping_address.name}
                      </p>
                    )}
                    {order.shipping_address.company && (
                      <p>{order.shipping_address.company}</p>
                    )}
                    {order.shipping_address.address && (
                      <p>{order.shipping_address.address}</p>
                    )}
                    <p>
                      {order.shipping_address.postal_code}{" "}
                      {order.shipping_address.city}
                      {order.shipping_address.province &&
                        ` (${order.shipping_address.province})`}
                    </p>
                    {order.shipping_address.country && (
                      <p>{order.shipping_address.country}</p>
                    )}
                    {order.shipping_address.phone && (
                      <p className="mt-2">
                        Tel: {order.shipping_address.phone}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {order.billing_address && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Indirizzo di fatturazione
                  </h3>
                  <div className="space-y-1 text-sm text-slate-600">
                    {order.billing_address.name && (
                      <p className="font-medium text-slate-900">
                        {order.billing_address.name}
                      </p>
                    )}
                    {order.billing_address.company && (
                      <p>{order.billing_address.company}</p>
                    )}
                    {order.billing_address.address && (
                      <p>{order.billing_address.address}</p>
                    )}
                    <p>
                      {order.billing_address.postal_code}{" "}
                      {order.billing_address.city}
                      {order.billing_address.province &&
                        ` (${order.billing_address.province})`}
                    </p>
                    {order.billing_address.country && (
                      <p>{order.billing_address.country}</p>
                    )}
                    {order.billing_address.vat_number && (
                      <p className="mt-2">
                        P.IVA: {order.billing_address.vat_number}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {order.customer_notes && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Note ordine
                </h3>
                <p className="text-slate-600">{order.customer_notes}</p>
              </div>
            )}

            {/* Chat */}
            {currentOrgId && order.buyer_org_id && order.seller_org_id && (
              <OrderChat
                orderId={order.id}
                currentOrgId={currentOrgId}
                currentUserId={currentUserId || undefined}
                buyerOrgId={order.buyer_org_id}
                sellerOrgId={order.seller_org_id}
              />
            )}
          </div>

          {/* Riepilogo */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Riepilogo ordine
              </h3>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotale</span>
                  <span className="font-medium">€{subtotal.toFixed(2)}</span>
                </div>
                {tax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">IVA</span>
                    <span className="font-medium">€{tax.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Spedizione</span>
                  <span className="font-medium">
                    {shipping === 0 ? "Gratuita" : `€${shipping.toFixed(2)}`}
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-3">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Totale</span>
                    <span>€{total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {order.payment_status === "PAID" && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-semibold">Pagamento completato</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
