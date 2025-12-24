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
import ServiziGIS from "./pages/ServiziGIS";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import DashboardAdmin from "./pages/DashboardAdmin";
import AdminCatalog from "./pages/AdminCatalog";
import Orders from "./pages/Orders";
import Servizi from "./pages/Servizi";
import Prenotazioni from "./pages/Prenotazioni";
import Missioni from "./pages/Missioni";
import Operatori from "./pages/Operatori";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import DroneDetail from "./pages/DroneDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />

        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/catalogo" element={<Catalogo />} />
            <Route path="/servizi" element={<ServiziGIS />} />
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />

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
              path="/admin/prenotazioni"
              element={
                <RequireAuth>
                  <Prenotazioni />
                </RequireAuth>
              }
            />

            <Route
              path="/admin/missioni"
              element={
                <RequireAuth>
                  <Missioni />
                </RequireAuth>
              }
            />

            <Route
              path="/admin/operatori"
              element={
                <RequireAuth>
                  <Operatori />
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

            <Route path="/prodotti/:id" element={<DroneDetail />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

createRoot(document.getElementById("root")!).render(<App />);
