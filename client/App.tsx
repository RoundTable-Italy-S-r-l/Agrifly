import "./global.css";

import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import RequireAuth from "@/components/RequireAuth";

import Index from "./pages/Index";
import Catalogo from "./pages/Catalogo";
import Carrello from "./pages/Carrello";
import ServiziGIS from "./pages/ServiziGIS";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import AcceptInvite from "./pages/AcceptInvite";
import Dashboard from "./pages/Dashboard";
import DashboardAdmin from "./pages/DashboardAdmin";
import AdminCatalog from "./pages/AdminCatalog";
import Orders from "./pages/Orders";
import Servizi from "./pages/Servizi";
import Missioni from "./pages/Missioni";
import OfferDetail from "./pages/OfferDetail";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import ServiceDetail from "./pages/ServiceDetail";
import DroneDetail from "./pages/DroneDetail";
import Checkout from "./pages/Checkout";
import OrderDetail from "./pages/OrderDetail";
import OperatorProfile from "./pages/OperatorProfile";
import NotFound from "./pages/NotFound";

// Buyer pages
import DashboardBuyer from "./pages/DashboardBuyer";
import NuovoPreventivoBuyer from "./pages/NuovoPreventivoBuyer";
import StoricoBuyer from "./pages/StoricoBuyer";
import ImpostazioniBuyer from "./pages/ImpostazioniBuyer";
import DettagliJobBuyer from "./pages/DettagliJobBuyer";
import CartBuyer from "./pages/CartBuyer";

// Landing page preventivo rimossa - non più utilizzata

const queryClient = new QueryClient();

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />

          <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/catalogo" element={<Catalogo />} />
            <Route
              path="/buyer/carrello"
              element={
                <RequireAuth>
                  <Carrello />
                </RequireAuth>
              }
            />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/servizi" element={<ServiziGIS />} />
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route
              path="/verify-email"
              element={
                <RequireAuth>
                  <VerifyEmail />
                </RequireAuth>
              }
            />

            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />

            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <DashboardAdmin />
                </RequireAuth>
              }
            />

            <Route
              path="/admin/catalogo"
              element={
                <RequireAuth>
                  <AdminCatalog />
                </RequireAuth>
              }
            />

            <Route
              path="/admin/ordini"
              element={
                <RequireAuth>
                  <Orders />
                </RequireAuth>
              }
            />

            <Route
              path="/admin/servizi"
              element={
                <RequireAuth>
                  <Servizi />
                </RequireAuth>
              }
            />

            <Route
              path="/admin/servizi/:serviceType"
              element={
                <RequireAuth>
                  <ServiceDetail />
                </RequireAuth>
              }
            />

            <Route
              path="/admin/offer/:offerId"
              element={
                <RequireAuth>
                  <OfferDetail />
                </RequireAuth>
              }
            />

            <Route
              path="/admin/prenotazioni"
              element={
                <RequireAuth>
                  <Missioni />
                </RequireAuth>
              }
            />


            <Route
              path="/admin/impostazioni"
              element={
                <RequireAuth>
                  <AdminSettingsPage />
                </RequireAuth>
              }
            />

            {/* Buyer Routes */}
            <Route
              path="/buyer"
              element={
                <RequireAuth>
                  <DashboardBuyer />
                </RequireAuth>
              }
            />

            <Route
              path="/buyer/carrello"
              element={
                <RequireAuth>
                  <CartBuyer />
                </RequireAuth>
              }
            />

            <Route
              path="/buyer/nuovo-preventivo"
              element={
                <RequireAuth>
                  <NuovoPreventivoBuyer />
                </RequireAuth>
              }
            />

            <Route
              path="/buyer/servizi"
              element={
                <RequireAuth>
                  <StoricoBuyer />
                </RequireAuth>
              }
            />

            <Route
              path="/buyer/impostazioni"
              element={
                <RequireAuth>
                  <ImpostazioniBuyer />
                </RequireAuth>
              }
            />

            <Route
              path="/buyer/job/:jobId"
              element={
                <RequireAuth>
                  <DettagliJobBuyer />
                </RequireAuth>
              }
            />

            <Route path="/prodotti/:id" element={<DroneDetail />} />
            <Route path="/ordini/:orderId" element={<OrderDetail />} />
            <Route path="/operators/:orgId" element={<OperatorProfile />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

createRoot(document.getElementById("root")!).render(<App />);
