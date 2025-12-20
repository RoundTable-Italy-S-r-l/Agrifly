import "./global.css";

import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import RequireSupabaseAuth from "@/components/RequireSupabaseAuth";

import { supabase } from "./lib/supabase";

import Index from "./pages/Index";
import Catalogo from "./pages/Catalogo";
import ServiziGIS from "./pages/ServiziGIS";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import DashboardAdmin from "./pages/DashboardAdmin";
import AdminCatalog from "./pages/AdminCatalog";
import Orders from "./pages/Orders";
import Servizi from "./pages/Servizi";
import Prenotazioni from "./pages/Prenotazioni";
import Missioni from "./pages/Missioni";
import Operatori from "./pages/Operatori";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import AuthCallback from "./pages/AuthCallback";
import DroneDetail from "./pages/DroneDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [dbStatus, setDbStatus] = useState<string>("DB: checking...");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("healthcheck")
        .select("label")
        .limit(1)
        .single();

      if (error) {
        console.error("Supabase healthcheck error:", error);
        setDbStatus("DB: ERROR (vedi console)");
      } else {
        setDbStatus(`DB: OK (${data.label})`);
      }
    })();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />

        {/* Badge di debug: lo togli quando hai finito */}
        <div
          style={{
            position: "fixed",
            bottom: 12,
            left: 12,
            zIndex: 9999,
            padding: "8px 10px",
            borderRadius: 8,
            background: "rgba(0,0,0,0.75)",
            color: "white",
            fontSize: 12,
          }}
        >
          {dbStatus}
        </div>

        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/catalogo" element={<Catalogo />} />
            <Route path="/servizi" element={<ServiziGIS />} />
            <Route path="/login" element={<Login />} />

            <Route
              path="/dashboard"
              element={
                <RequireSupabaseAuth>
                  <Dashboard />
                </RequireSupabaseAuth>
              }
            />

            <Route
              path="/admin"
              element={
                <RequireSupabaseAuth>
                  <DashboardAdmin />
                </RequireSupabaseAuth>
              }
            />

            <Route
              path="/admin/catalogo"
              element={
                <RequireSupabaseAuth>
                  <AdminCatalog />
                </RequireSupabaseAuth>
              }
            />

            <Route
              path="/admin/ordini"
              element={
                <RequireSupabaseAuth>
                  <Orders />
                </RequireSupabaseAuth>
              }
            />

            <Route
              path="/admin/servizi"
              element={
                <RequireSupabaseAuth>
                  <Servizi />
                </RequireSupabaseAuth>
              }
            />

            <Route
              path="/admin/prenotazioni"
              element={
                <RequireSupabaseAuth>
                  <Prenotazioni />
                </RequireSupabaseAuth>
              }
            />

            <Route
              path="/admin/missioni"
              element={
                <RequireSupabaseAuth>
                  <Missioni />
                </RequireSupabaseAuth>
              }
            />

            <Route
              path="/admin/operatori"
              element={
                <RequireSupabaseAuth>
                  <Operatori />
                </RequireSupabaseAuth>
              }
            />

            <Route
              path="/admin/impostazioni"
              element={
                <RequireSupabaseAuth>
                  <AdminSettingsPage />
                </RequireSupabaseAuth>
              }
            />

            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/drones/:id" element={<DroneDetail />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

createRoot(document.getElementById("root")!).render(<App />);
