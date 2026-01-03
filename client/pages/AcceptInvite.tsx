import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Mail,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  User,
  Lock,
  Building,
} from "lucide-react";

interface AcceptInviteData {
  token: string;
  password: string;
  firstName: string;
  lastName: string;
}

export default function AcceptInvite() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState<AcceptInviteData>({
    token: "",
    password: "",
    firstName: "",
    lastName: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<{
    email?: string;
    organizationName?: string;
    role?: string;
  }>({});

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setError("Token di invito mancante o non valido");
      return;
    }

    setFormData((prev) => ({ ...prev, token }));

    // Prova a decodificare info dal token (se possibile)
    // Per ora mostriamo un messaggio generico
    console.log("Token invito ricevuto:", token.substring(0, 20) + "...");
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.password || !formData.firstName || !formData.lastName) {
      setError("Tutti i campi sono obbligatori");
      return;
    }

    if (formData.password.length < 8) {
      setError("La password deve essere di almeno 8 caratteri");
      return;
    }

    try {
      setLoading(true);
      setError("");

      console.log("📧 Accettazione invito in corso...");

      const response = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Errore durante l'accettazione dell'invito",
        );
      }

      console.log("✅ Invito accettato con successo:", data);

      setInviteInfo({
        email: data.user.email,
        organizationName: data.organization.name,
        role: data.membership.role,
      });

      setSuccess(true);
      toast.success("Invito accettato con successo!");

      // Reindirizza al login dopo 3 secondi
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (error: any) {
      console.error("❌ Errore accettazione invito:", error);
      setError(error.message || "Errore durante l'accettazione dell'invito");
      toast.error("Errore durante l'accettazione dell'invito");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange =
    (field: keyof AcceptInviteData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  if (success) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8">
            <div className="bg-white py-8 px-4 shadow-lg rounded-lg sm:px-10">
              <div className="text-center">
                <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                  Invito accettato!
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  Benvenuto in {inviteInfo.organizationName}
                </p>
                <div className="mt-4 text-left bg-gray-50 p-4 rounded-md">
                  <p className="text-sm text-gray-700">
                    <strong>Email:</strong> {inviteInfo.email}
                  </p>
                  <p className="text-sm text-gray-700 mt-1">
                    <strong>Organizzazione:</strong>{" "}
                    {inviteInfo.organizationName}
                  </p>
                  <p className="text-sm text-gray-700 mt-1">
                    <strong>Ruolo:</strong> {inviteInfo.role}
                  </p>
                </div>
                <p className="mt-4 text-sm text-gray-500">
                  Tra pochi secondi verrai reindirizzato al login...
                </p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="bg-white py-8 px-4 shadow-lg rounded-lg sm:px-10">
            <div className="text-center">
              <Mail className="mx-auto h-12 w-12 text-blue-500" />
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                Accetta invito
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Completa la registrazione per unirti all'organizzazione
              </p>
            </div>

            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <Label
                    htmlFor="firstName"
                    className="flex items-center gap-2"
                  >
                    <User className="h-4 w-4" />
                    Nome
                  </Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={handleInputChange("firstName")}
                    placeholder="Il tuo nome"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="lastName" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Cognome
                  </Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={handleInputChange("lastName")}
                    placeholder="Il tuo cognome"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Password
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={handleInputChange("password")}
                    placeholder="Scegli una password sicura"
                    className="mt-1"
                    minLength={8}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Almeno 8 caratteri
                  </p>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Accettazione in corso...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Accetta invito
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/")}
                  disabled={loading}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Torna alla home
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
