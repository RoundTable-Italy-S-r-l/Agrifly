import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { authAPI } from "@/lib/auth";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Token mancante. Usa il link ricevuto via email.");
    }
  }, [token]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setError("Token mancante");
      return;
    }

    if (newPassword.length < 8) {
      setError("La password deve essere di almeno 8 caratteri");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Le password non corrispondono");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await authAPI.resetPassword(token, newPassword);
      setSuccess(true);

      // Reindirizza al login dopo 3 secondi
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err: any) {
      setError(err?.message || "Errore nel reset password");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Layout>
        <div className="max-w-md mx-auto mt-12">
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg mb-6">
            <p className="font-semibold mb-2">
              Password resettata con successo!
            </p>
            <p className="text-sm">
              La tua password è stata aggiornata. Verrai reindirizzato al
              login...
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto mt-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Reset Password
        </h1>

        <p className="text-slate-600 mb-8">Inserisci la tua nuova password</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Nuova Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Minimo 8 caratteri"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Conferma Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Ripeti la password"
            />
          </div>

          <Button
            type="submit"
            disabled={loading || !token}
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {loading ? "Caricamento..." : "Reset Password"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="text-sm text-emerald-600 hover:underline"
          >
            Torna al login
          </button>
        </div>
      </div>
    </Layout>
  );
}
