import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GeneralSection } from "../features/settings/components/GeneralSection";
import { UsersSection } from "../features/settings/components/UsersSection";
import { NotificationsSection } from "../features/settings/components/NotificationsSection";
import { Building2, Users, Bell } from "lucide-react";

export default function AdminSettingsPage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("general");

  useEffect(() => {
    // Verifica se l'utente è autenticato
    const token = localStorage.getItem("auth_token");
    if (!token) {
      navigate("/login");
      return;
    }
  }, [navigate]);

  const settingsSections = [
    {
      id: "general",
      label: "Generale",
      icon: Building2,
      component: GeneralSection,
      description: "Impostazioni generali dell'organizzazione",
    },
    {
      id: "users",
      label: "Utenti",
      icon: Users,
      component: UsersSection,
      description: "Gestione membri e inviti",
    },
    {
      id: "notifications",
      label: "Notifiche",
      icon: Bell,
      component: NotificationsSection,
      description: "Preferenze di notifica",
    },
  ];

  const ActiveComponent =
    settingsSections.find((s) => s.id === activeSection)?.component ||
    GeneralSection;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Impostazioni</h1>
          <p className="text-slate-600 mt-1">
            Gestisci le impostazioni della tua organizzazione e preferenze
            personali
          </p>
        </div>

        <div className="flex gap-6">
          {/* Settings Submenu */}
          <div className="w-80 shrink-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sezioni</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <nav className="space-y-1">
                  {settingsSections.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;

                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                          isActive
                            ? "bg-emerald-50 text-emerald-700 border-r-2 border-emerald-600"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div
                            className={`font-medium truncate ${
                              isActive ? "text-emerald-700" : "text-slate-900"
                            }`}
                          >
                            {section.label}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {section.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Settings Content */}
          <div className="flex-1 min-w-0">
            {activeSection === "general" && <GeneralSection />}
            {activeSection === "users" && <UsersSection />}
            {activeSection === "notifications" && <NotificationsSection />}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
