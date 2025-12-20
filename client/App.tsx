
import "./global.css";

import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";


import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import DroneDetail from "./pages/DroneDetail";
import Catalogo from "./pages/Catalogo";
import ServiziGIS from "./pages/ServiziGIS";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import DashboardAdmin from "./pages/DashboardAdmin";
import AdminCatalog from "./pages/AdminCatalog";
import Orders from "./pages/Orders";
import Servizi from "./pages/Servizi";
import Missioni from "./pages/Missioni";
import Operatori from "./pages/Operatori";
import Prenotazioni from "./pages/Prenotazioni";
import AuthCallback from "./pages/AuthCallback";
import NotFound from "./pages/NotFound";
import AdminSettingsPage from "./pages/AdminSettingsPage";

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
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<DashboardAdmin />} />
            <Route path="/admin/catalogo" element={<AdminCatalog />} />
            <Route path="/admin/ordini" element={<Orders />} />
            <Route path="/admin/servizi" element={<Servizi />} />
            <Route path="/admin/prenotazioni" element={<Prenotazioni />} />
            <Route path="/admin/missioni" element={<Missioni />} />
            <Route path="/admin/operatori" element={<Operatori />} />
            <Route path="/admin/impostazioni" element={<AdminSettingsPage />} />
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
