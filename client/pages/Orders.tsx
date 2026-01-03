import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { fetchOrders, fetchOrderById, Order } from "@/lib/api";
import {
  ShoppingBag,
  Package,
  DollarSign,
  User,
  Filter,
  CheckCircle,
  Clock,
  XCircle,
  Truck,
  AlertTriangle,
  Download,
  X,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OrderChat } from "@/components/OrderChat";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type KanbanStatus =
  | "PAID"
  | "SHIPPED"
  | "FULFILLED"
  | "CANCELLED"
  | "PROBLEMATIC";

const kanbanColumns: Array<{
  status: KanbanStatus;
  label: string;
  color: string;
  icon: any;
}> = [
  {
    status: "PAID",
    label: "Pagato",
    color: "bg-yellow-50 border-yellow-200",
    icon: DollarSign,
  },
  {
    status: "SHIPPED",
    label: "Spedito",
    color: "bg-blue-50 border-blue-200",
    icon: Truck,
  },
  {
    status: "FULFILLED",
    label: "Completato",
    color: "bg-green-50 border-green-200",
    icon: CheckCircle,
  },
  {
    status: "CANCELLED",
    label: "Annullato",
    color: "bg-red-50 border-red-200",
    icon: XCircle,
  },
  {
    status: "PROBLEMATIC",
    label: "Problematico",
    color: "bg-orange-50 border-orange-200",
    icon: AlertTriangle,
  },
];

// Componente per card ordine draggable
function OrderCard({
  order,
  onOpenDetail,
}: {
  order: Order;
  onOpenDetail: (order: Order) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: order.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition:
      transition ||
      "transform 200ms cubic-bezier(0.2, 0, 0.2, 1), opacity 150ms ease-out",
    opacity: isDragging ? 0.6 : 1,
    scale: isDragging ? 1.05 : 1,
  };

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("it-IT", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatPrice = (cents: number, currency: string = "EUR") => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: currency,
    }).format(cents / 100);
  };

  // Ottieni il nome del primo prodotto
  const firstProduct =
    order.order_lines && order.order_lines.length > 0
      ? order.order_lines[0]
      : null;
  const productName =
    firstProduct?.product_name || firstProduct?.product_model || "Prodotto";
  const orderIdShort = order.id.slice(-8);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`hover:shadow-md transition-all duration-200 ${
        isDragging
          ? "ring-2 ring-emerald-500 shadow-xl scale-105 rotate-1"
          : "hover:scale-[1.02]"
      }`}
      onClick={() => onOpenDetail(order)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base mb-1 cursor-pointer hover:text-emerald-600">
              {productName}
            </CardTitle>
            <CardDescription className="text-sm">
              {order.buyer_org_name}
            </CardDescription>
          </div>
          {/* Handle per drag - separato dal click */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-100 rounded"
            onClick={(e) => e.stopPropagation()} // Previeni il click quando si fa drag
          >
            <svg
              className="w-4 h-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8h16M4 16h16"
              />
            </svg>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-xs text-slate-500">
          {formatDateShort(order.created_at)}
        </div>
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm text-slate-600">#{orderIdShort}</span>
          <span className="text-lg font-bold text-slate-900">
            {formatPrice(order.total_cents, order.currency)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// Componente colonna Kanban (droppable)
function KanbanColumn({
  column,
  orders,
  onOpenDetail,
  landingOrderId,
}: {
  column: (typeof kanbanColumns)[0];
  orders: Order[];
  onOpenDetail: (order: Order) => void;
  landingOrderId: string | null;
}) {
  const ColumnIcon = column.icon;
  const { setNodeRef, isOver } = useDroppable({
    id: column.status,
  });

  return (
    <div className="space-y-3 w-full" ref={setNodeRef}>
      {/* Header colonna */}
      <div
        className={`flex items-center justify-between p-3 rounded-lg border-2 ${column.color} ${
          isOver
            ? "ring-2 ring-emerald-500 ring-offset-2 scale-[1.02] shadow-lg bg-emerald-50"
            : ""
        } transition-all duration-200 ease-out`}
      >
        <div className="flex items-center gap-2">
          <ColumnIcon className="w-4 h-4" />
          <h3 className="font-semibold text-slate-900 text-sm">
            {column.label}
          </h3>
        </div>
        <Badge variant="secondary" className="bg-white font-semibold text-xs">
          {orders.length}
        </Badge>
      </div>

      {/* Card ordini */}
      <SortableContext
        items={orders.map((o) => o.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3 min-h-[200px]">
          {orders.map((order, index) => (
            <div
              key={order.id}
              className={landingOrderId === order.id ? "order-landing" : ""}
              style={{
                animation:
                  landingOrderId === order.id
                    ? undefined
                    : `fadeInSlide 0.3s ease-out ${index * 30}ms both`,
              }}
            >
              <OrderCard order={order} onOpenDetail={onOpenDetail} />
            </div>
          ))}
          {orders.length === 0 && (
            <div className="text-center py-8 text-sm text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
              Nessun ordine
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function Orders() {
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isVendor, setIsVendor] = useState<boolean>(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<
    "today" | "week" | "month" | "all"
  >("month");
  const [customerFilter, setCustomerFilter] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [landingOrderId, setLandingOrderId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Ottieni l'ID dell'organizzazione corrente
  useEffect(() => {
    const orgData = localStorage.getItem("organization");
    const userData = localStorage.getItem("user");

    if (orgData) {
      try {
        const org = JSON.parse(orgData);
        console.log("📦 Dati organizzazione dal localStorage:", org);
        setCurrentOrgId(org.id);
        // NUOVA LOGICA: determina se è vendor/operator dal tipo organizzazione
        const orgType = ((org.type || org.org_type || "") + "").toLowerCase();
        const vendor = orgType === "vendor" || orgType === "operator";
        setIsVendor(vendor);
        console.log(
          "🏪 Organizzazione:",
          org.name || org.legal_name || org.id,
          "orgType:",
          orgType,
          "isVendor:",
          vendor,
        );
      } catch (error) {
        console.error("Errore nel parsing dei dati organizzazione:", error);
      }
    }

    if (userData) {
      try {
        const user = JSON.parse(userData);
        setCurrentUserId(user.id);
      } catch (error) {
        console.error("Errore nel parsing dei dati utente:", error);
      }
    }
  }, []);

  // Query per ordini - passa role=seller se è un vendor
  // IMPORTANTE: enabled deve dipendere anche da isVendor per evitare race conditions
  const {
    data: orders = [],
    isLoading,
    error: ordersError,
  } = useQuery({
    queryKey: ["orders", currentOrgId, isVendor ? "seller" : "buyer"],
    queryFn: async () => {
      if (!currentOrgId) {
        console.log("⚠️ No currentOrgId, returning empty array");
        return [];
      }
      const role = isVendor ? "seller" : "buyer";
      console.log(
        "🛒 Fetching orders for org:",
        currentOrgId,
        "role:",
        role,
        "isVendor:",
        isVendor,
      );
      try {
        const result = await fetchOrders(currentOrgId, role);
        console.log("✅ Orders fetched:", result.length, "orders", result);
        return result;
      } catch (error) {
        console.error("❌ Error fetching orders:", error);
        throw error;
      }
    },
    enabled: !!currentOrgId && isVendor !== undefined, // Aspetta che isVendor sia determinato
    refetchInterval: 30000, // Auto-refresh ogni 30 secondi
  });

  // Log quando orders cambia
  useEffect(() => {
    console.log("📦 Orders state updated:", {
      ordersCount: orders.length,
      isLoading,
      ordersError,
      currentOrgId,
      isVendor,
      orders: orders.slice(0, 2), // Log solo i primi 2 per non intasare
    });
  }, [orders, isLoading, ordersError, currentOrgId, isVendor]);

  // Mutation per aggiornare lo stato ordine
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({
      orderId,
      status,
    }: {
      orderId: string;
      status: KanbanStatus;
    }) => {
      const url = `/api/orders/${orderId}/status`;
      console.log("🔄 Chiamata API:", url, { order_status: status });

      const response = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_status: status }),
      });

      console.log("📡 Risposta API:", response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Errore API:", errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = {
            error:
              errorText || `Errore ${response.status}: ${response.statusText}`,
          };
        }
        throw new Error(
          errorData.error ||
            `Errore ${response.status}: ${response.statusText}`,
        );
      }
      return response.json();
    },
    onMutate: async ({ orderId, status }) => {
      // Cancella le query in corso per evitare override
      await queryClient.cancelQueries({ queryKey: ["orders", currentOrgId] });

      // Snapshot del valore precedente
      const previousOrders = queryClient.getQueryData<Order[]>([
        "orders",
        currentOrgId,
      ]);

      // Aggiornamento ottimistico
      if (previousOrders) {
        queryClient.setQueryData<Order[]>(["orders", currentOrgId], (old) => {
          if (!old) return old;
          return old.map((order) =>
            order.id === orderId
              ? { ...order, status: status, order_status: status }
              : order,
          );
        });
      }

      return { previousOrders };
    },
    onError: (err, variables, context) => {
      // Rollback in caso di errore
      if (context?.previousOrders) {
        queryClient.setQueryData(
          ["orders", currentOrgId],
          context.previousOrders,
        );
      }
      console.error("Errore aggiornamento stato ordine:", err);
    },
    onSuccess: () => {
      // Invalida per sincronizzare con il server
      queryClient.invalidateQueries({ queryKey: ["orders", currentOrgId] });
    },
  });

  // Filtra ordini per periodo
  const getFilteredOrdersByPeriod = (orders: Order[]) => {
    const safeOrders = orders || [];
    console.log("📅 Filtering orders by period:", {
      periodFilter,
      totalOrders: safeOrders.length,
    });

    if (periodFilter === "all") {
      console.log("✅ Returning all orders (no period filter)");
      return safeOrders;
    }

    const now = new Date();
    let startDate: Date;

    switch (periodFilter) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        return safeOrders;
    }

    const filtered = safeOrders.filter((order) => {
      if (!order.created_at) {
        console.warn("⚠️ Order without created_at:", order.id);
        return true; // Includi ordini senza data
      }
      const orderDate = new Date(order.created_at);
      const included = orderDate >= startDate;
      if (!included) {
        console.log("⏰ Order filtered out by date:", {
          orderId: order.id,
          orderDate,
          startDate,
        });
      }
      return included;
    });

    console.log("📅 Orders after period filter:", filtered.length);
    return filtered;
  };

  // Filtra ordini per cliente
  const filteredOrders = getFilteredOrdersByPeriod(orders || []).filter(
    (order) => {
      const matchesCustomer =
        customerFilter === "" ||
        (order.buyer_org_name || "")
          .toLowerCase()
          .includes(customerFilter.toLowerCase());
      if (!matchesCustomer && customerFilter) {
        console.log("👤 Order filtered out by customer:", {
          orderId: order.id,
          buyerName: order.buyer_org_name,
          filter: customerFilter,
        });
      }
      return matchesCustomer;
    },
  );

  console.log(
    "🔍 Final filtered orders:",
    filteredOrders.length,
    filteredOrders.map((o) => ({
      id: o.id,
      status: o.status,
      payment_status: o.payment_status,
    })),
  );

  // Funzione helper per mappare status dell'ordine a KanbanStatus
  const mapOrderStatusToKanban = (order: Order): KanbanStatus => {
    // Se l'ordine ha già order_status, usalo
    if ((order as any).order_status) {
      const os = (order as any).order_status.toUpperCase();
      if (
        ["PAID", "SHIPPED", "FULFILLED", "CANCELLED", "PROBLEMATIC"].includes(
          os,
        )
      ) {
        return os as KanbanStatus;
      }
    }

    // Mappa status + payment_status a KanbanStatus
    const status = (order.status || "").toUpperCase();
    const paymentStatus = (order.payment_status || "").toUpperCase();

    let mappedStatus: KanbanStatus;

    if (status === "CANCELLED") {
      mappedStatus = "CANCELLED";
    } else if (status === "FULFILLED" || status === "DELIVERED") {
      mappedStatus = "FULFILLED";
    } else if (status === "SHIPPED") {
      mappedStatus = "SHIPPED";
    } else if (status === "CONFIRMED" && paymentStatus === "PAID") {
      mappedStatus = "PAID";
    } else if (paymentStatus === "PAID") {
      mappedStatus = "PAID";
    } else if (status === "PROBLEMATIC" || status === "ISSUE") {
      mappedStatus = "PROBLEMATIC";
    } else {
      // Fallback: PAID se non si riesce a determinare
      mappedStatus = "PAID";
    }

    console.log("🔀 Mapping order status:", {
      orderId: order.id,
      status,
      paymentStatus,
      mappedStatus,
    });

    return mappedStatus;
  };

  // Raggruppa ordini per stato
  const ordersByStatus = kanbanColumns.reduce(
    (acc, column) => {
      const ordersInColumn = filteredOrders.filter(
        (o) => mapOrderStatusToKanban(o) === column.status,
      );
      acc[column.status] = ordersInColumn;
      if (ordersInColumn.length > 0) {
        console.log(
          `📋 Colonna ${column.label}: ${ordersInColumn.length} ordini`,
        );
      }
      return acc;
    },
    {} as Record<KanbanStatus, Order[]>,
  );

  console.log(
    "📊 Orders by status summary:",
    Object.keys(ordersByStatus)
      .map((k) => `${k}: ${ordersByStatus[k as KanbanStatus].length}`)
      .join(", "),
  );

  // KPI operativi
  const kpis = {
    toFulfill: ordersByStatus.PAID?.length || 0,
    shipped: ordersByStatus.SHIPPED?.length || 0,
    completed: ordersByStatus.FULFILLED?.length || 0,
    periodValue: filteredOrders
      .filter((o) => mapOrderStatusToKanban(o) === "FULFILLED")
      .reduce((sum, o) => sum + (o.total_cents || 0), 0),
  };

  const handleOpenDetail = async (order: Order) => {
    // Carica l'ordine completo dal backend per avere tutti i dettagli (indirizzi, ecc.)
    try {
      const fullOrder = await fetchOrderById(order.id);
      setSelectedOrder(fullOrder);
      setDetailSheetOpen(true);
    } catch (error) {
      console.error("Errore caricamento dettagli ordine:", error);
      // Fallback: usa l'ordine dalla lista
      setSelectedOrder(order);
      setDetailSheetOpen(true);
    }
  };

  const handleDragStart = (event: DragEndEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const orderId = active.id as string;
    // over.id è lo status della colonna (droppable)
    const newStatus = over.id as KanbanStatus;

    // Valida che sia uno stato valido
    if (!kanbanColumns.find((c) => c.status === newStatus)) return;

    // Trova l'ordine corrente
    const currentOrder = filteredOrders.find((o) => o.id === orderId);
    if (!currentOrder) return;
    const currentStatus =
      (currentOrder as any).status || (currentOrder as any).order_status;
    if (currentStatus === newStatus) return;

    // Attiva animazione di atterraggio
    setLandingOrderId(orderId);
    setTimeout(() => setLandingOrderId(null), 400); // Rimuovi dopo l'animazione

    // Aggiorna lo stato
    updateOrderStatusMutation.mutate({ orderId, status: newStatus });
  };

  if (!currentOrgId) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-slate-600">Nessuna organizzazione selezionata</p>
            <p className="text-sm text-slate-500 mt-2">
              Seleziona un'organizzazione per visualizzare gli ordini
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const activeOrder = activeId
    ? filteredOrders.find((o) => o.id === activeId)
    : null;

  return (
    <AdminLayout>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes fadeInSlide {
              from {
                opacity: 0;
                transform: translateY(-10px) scale(0.95);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
            @keyframes landingBounce {
              0% {
                transform: scale(1.1) translateY(-5px);
                opacity: 0.8;
              }
              50% {
                transform: scale(0.98) translateY(2px);
              }
              100% {
                transform: scale(1) translateY(0);
                opacity: 1;
              }
            }
            .order-landing {
              animation: landingBounce 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
          `,
        }}
      />
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Ordini</h1>
          <p className="text-slate-600 mt-1">Gestisci ordini e spedizioni</p>
        </div>

        {/* KPI operativi */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">
                Ordini da evadere
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {kpis.toFulfill}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">
                In spedizione
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {kpis.shipped}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">
                Completati
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {kpis.completed}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">
                Valore periodo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {new Intl.NumberFormat("it-IT", {
                  style: "currency",
                  currency: "EUR",
                }).format(kpis.periodValue / 100)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtri semplici */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-600" />
                <label className="text-sm font-medium text-slate-700">
                  Periodo:
                </label>
                <Select
                  value={periodFilter}
                  onValueChange={(value: any) => setPeriodFilter(value)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Oggi</SelectItem>
                    <SelectItem value="week">Ultimi 7 giorni</SelectItem>
                    <SelectItem value="month">Questo mese</SelectItem>
                    <SelectItem value="all">Tutti</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-600" />
                <Input
                  placeholder="Cerca cliente..."
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  className="flex-1"
                />
                {customerFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCustomerFilter("")}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vista Kanban con Drag and Drop - SEMPRE VISIBILE */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {isLoading && (
            <div className="mb-4 text-center">
              <div className="inline-flex items-center gap-2 text-slate-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
                <span className="text-sm">Caricamento ordini...</span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {kanbanColumns.map((column) => (
              <KanbanColumn
                key={column.status}
                column={column}
                orders={ordersByStatus[column.status] || []}
                onOpenDetail={handleOpenDetail}
                landingOrderId={landingOrderId}
              />
            ))}
          </div>
          <DragOverlay>
            {activeOrder ? (
              <div
                className="opacity-90 rotate-3 shadow-2xl"
                style={{
                  transform: "rotate(3deg) scale(1.05)",
                  transition: "transform 100ms ease-out",
                }}
              >
                <OrderCard order={activeOrder} onOpenDetail={() => {}} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Sheet dettaglio ordine */}
        {selectedOrder && (
          <OrderDetailSheet
            order={selectedOrder}
            open={detailSheetOpen}
            onOpenChange={setDetailSheetOpen}
            currentOrgId={currentOrgId}
            currentUserId={currentUserId}
          />
        )}
      </div>
    </AdminLayout>
  );
}

// Componente Sheet per dettaglio ordine
function OrderDetailSheet({
  order,
  open,
  onOpenChange,
  currentOrgId,
  currentUserId,
}: {
  order: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentOrgId: string | null;
  currentUserId: string | null;
}) {
  const queryClient = useQueryClient();

  // Mutation per aggiornare status (stessa logica del componente principale)
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({
      orderId,
      status,
      trackingNumber,
    }: {
      orderId: string;
      status: string;
      trackingNumber?: string;
    }) => {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_status: status,
          tracking_number: trackingNumber,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `Errore ${response.status}` };
        }
        throw new Error(errorData.error || `Errore ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", currentOrgId] });
      queryClient.invalidateQueries({ queryKey: ["order", order.id] });
      toast.success("Status ordine aggiornato");
    },
    onError: (error: any) => {
      toast.error(error.message || "Errore nell'aggiornamento dello status");
    },
  });
  const formatPrice = (cents: number, currency: string = "EUR") => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: currency,
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("it-IT", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusLabels: Record<string, string> = {
    PAID: "Pagato",
    SHIPPED: "Spedito",
    FULFILLED: "Completato",
    CANCELLED: "Annullato",
    PROBLEMATIC: "Problematico",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Ordine #{order.id.slice(-8)}</SheetTitle>
          <SheetDescription>
            {statusLabels[order.order_status] || order.order_status} ·{" "}
            {formatDate(order.created_at)} ·{" "}
            {formatPrice(order.total_cents, order.currency)}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Cliente */}
          <div className="border border-slate-200 rounded-lg p-4 bg-white">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Cliente
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">
                  {order.buyer_org_name}
                </span>
              </div>
              <div className="text-sm text-slate-600 font-mono">
                ID: {order.buyer_org_id}
              </div>
            </div>
          </div>

          {/* Prodotti */}
          <div className="border border-slate-200 rounded-lg p-4 bg-white">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Prodotti
            </h3>
            <div className="space-y-3">
              {order.order_lines.map((line) => (
                <div
                  key={line.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100"
                >
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">
                      {line.product_name || line.product_model}
                    </div>
                    <div className="text-sm text-slate-600">
                      {line.product_model &&
                        line.product_name !== line.product_model &&
                        `${line.product_model} · `}
                      SKU: {line.sku_code}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-slate-600">
                      {line.quantity} ×{" "}
                      {formatPrice(line.unit_price_cents, order.currency)}
                    </div>
                    <div className="font-semibold text-slate-900">
                      {formatPrice(line.line_total_cents, order.currency)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Logistica */}
          <div className="border border-slate-200 rounded-lg p-4 bg-white">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Logistica
            </h3>
            <div className="space-y-3">
              {(() => {
                // Parse shipping_address se è una stringa JSON
                let shippingAddr = order.shipping_address;
                console.log(
                  "📦 Shipping address raw:",
                  shippingAddr,
                  "type:",
                  typeof shippingAddr,
                );

                if (typeof shippingAddr === "string" && shippingAddr.trim()) {
                  try {
                    shippingAddr = JSON.parse(shippingAddr);
                    console.log("✅ Parsed shipping address:", shippingAddr);
                  } catch (e) {
                    console.warn(
                      "⚠️ Errore parsing shipping_address:",
                      e,
                      "raw:",
                      shippingAddr,
                    );
                    shippingAddr = null;
                  }
                }

                return shippingAddr && typeof shippingAddr === "object" ? (
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                    <div className="text-sm font-medium text-slate-900 mb-2">
                      Indirizzo di consegna:
                    </div>
                    <div className="text-sm text-slate-700 space-y-1">
                      {shippingAddr.name && (
                        <div className="font-medium">{shippingAddr.name}</div>
                      )}
                      {shippingAddr.company && (
                        <div>{shippingAddr.company}</div>
                      )}
                      {shippingAddr.address && (
                        <div>{shippingAddr.address}</div>
                      )}
                      <div>
                        {shippingAddr.postal_code} {shippingAddr.city}
                        {shippingAddr.province && ` (${shippingAddr.province})`}
                      </div>
                      {shippingAddr.country && (
                        <div>{shippingAddr.country}</div>
                      )}
                      {shippingAddr.phone && (
                        <div className="mt-2 pt-2 border-t border-slate-200">
                          Tel: {shippingAddr.phone}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <span className="font-medium">Magazzino:</span> Sede
                    Principale
                    {shippingAddr && (
                      <div className="text-xs text-red-600 mt-1">
                        (Indirizzo non disponibile o formato non valido)
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className="flex items-center justify-between text-sm border-t border-slate-200 pt-3">
                <span className="text-slate-600">Lead time stimato:</span>
                <span className="text-slate-900 font-medium">7-10 giorni</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Tracking:</span>
                <span className="text-slate-900 font-medium">
                  {(order as any).tracking_number || "Non disponibile"}
                </span>
              </div>
            </div>
          </div>

          {/* Indirizzo di fatturazione */}
          <div className="border border-slate-200 rounded-lg p-4 bg-white">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Fatturazione
            </h3>
            <div className="space-y-3">
              {(() => {
                // Parse billing_address se è una stringa JSON
                let billingAddr = order.billing_address;
                console.log(
                  "💰 Billing address raw:",
                  billingAddr,
                  "type:",
                  typeof billingAddr,
                );

                if (typeof billingAddr === "string" && billingAddr.trim()) {
                  try {
                    billingAddr = JSON.parse(billingAddr);
                    console.log("✅ Parsed billing address:", billingAddr);
                  } catch (e) {
                    console.warn(
                      "⚠️ Errore parsing billing_address:",
                      e,
                      "raw:",
                      billingAddr,
                    );
                    billingAddr = null;
                  }
                }

                return billingAddr && typeof billingAddr === "object" ? (
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                    <div className="text-sm font-medium text-slate-900 mb-2">
                      Indirizzo di fatturazione:
                    </div>
                    <div className="text-sm text-slate-700 space-y-1">
                      {billingAddr.name && (
                        <div className="font-medium">{billingAddr.name}</div>
                      )}
                      {billingAddr.company && <div>{billingAddr.company}</div>}
                      {billingAddr.address && <div>{billingAddr.address}</div>}
                      <div>
                        {billingAddr.postal_code} {billingAddr.city}
                        {billingAddr.province && ` (${billingAddr.province})`}
                      </div>
                      {billingAddr.country && <div>{billingAddr.country}</div>}
                      {billingAddr.vat_number && (
                        <div className="mt-2 pt-2 border-t border-slate-200">
                          P.IVA: {billingAddr.vat_number}
                        </div>
                      )}
                      {billingAddr.phone && <div>Tel: {billingAddr.phone}</div>}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <span className="font-medium">
                      Indirizzo di fatturazione:
                    </span>{" "}
                    Non disponibile
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Dettagli ordine */}
          <div className="border border-slate-200 rounded-lg p-4 bg-white">
            <h3 className="font-semibold text-slate-900 mb-3">Dettagli</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <span className="text-slate-600 block mb-1">ID Ordine:</span>
                <div className="font-mono text-slate-900 text-xs">
                  {order.id}
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <span className="text-slate-600 block mb-1">
                  Data creazione:
                </span>
                <div className="text-slate-900">
                  {formatDate(order.created_at)}
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <span className="text-slate-600 block mb-1">Stato:</span>
                <div className="text-slate-900 font-medium">
                  {statusLabels[
                    (order as any).status || (order as any).order_status
                  ] ||
                    (order as any).status ||
                    (order as any).order_status}
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <span className="text-slate-600 block mb-1">Totale:</span>
                <div className="font-semibold text-slate-900">
                  {formatPrice(order.total_cents, order.currency)}
                </div>
              </div>
            </div>
          </div>

          {/* Chat */}
          {currentOrgId && order.buyer_org_id && order.seller_org_id && (
            <div className="border border-slate-200 rounded-lg p-4 bg-white">
              <OrderChat
                orderId={order.id}
                currentOrgId={currentOrgId}
                currentUserId={currentUserId || undefined}
                buyerOrgId={order.buyer_org_id}
                sellerOrgId={order.seller_org_id}
              />
            </div>
          )}
        </div>

        <SheetFooter className="mt-6 gap-2 flex-col sm:flex-row">
          {((order as any).status === "PAID" ||
            (order as any).order_status === "PAID") && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                const trackingNumber = prompt(
                  "Inserisci numero di tracking (opzionale):",
                );
                updateOrderStatusMutation.mutate({
                  orderId: order.id,
                  status: "SHIPPED",
                  trackingNumber: trackingNumber || undefined,
                });
              }}
            >
              <Truck className="w-4 h-4 mr-2" />
              Segna come spedito
            </Button>
          )}
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Scarica fattura
          </Button>
          <SheetClose asChild>
            <Button variant="outline">Chiudi</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
