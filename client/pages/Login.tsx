import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { authAPI } from "@/lib/auth";

export default function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isLogin, setIsLogin] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // REGISTRAZIONE
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");

      const data = await authAPI.register({
        email,
        password,
        firstName,
        lastName,
        phone,
        organizationName: `${firstName} ${lastName}` // Nome org di default
      });

      // Salva JWT e organizzazione
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem('organization', JSON.stringify(data.organization));

      setError(
        "Registrazione completata! Controlla la tua email per il codice di verifica."
      );

      // Reindirizza alla dashboard (verifica email opzionale)
      await queryClient.invalidateQueries();
      navigate("/dashboard");

    } catch (err: any) {
      setError(err?.message || "Errore nella registrazione");
    } finally {
      setLoading(false);
    }
  };

  // LOGIN
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");

      const data = await authAPI.login(email, password);

      // Salva JWT e organizzazione
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem('organization', JSON.stringify(data.organization));

      console.log('✅ Login completato, JWT e organizzazione salvati');

      await queryClient.invalidateQueries();
      navigate("/dashboard");

    } catch (err: any) {
      setError(err?.message || "Errore nel login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto mt-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          {isLogin ? "Accedi" : "Registrati"}
        </h1>

        <p className="text-slate-600 mb-8">
          {isLogin
            ? "Accedi al tuo account per gestire la dashboard"
            : "Crea un nuovo account per iniziare"}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form
          onSubmit={isLogin ? handleLogin : handleRegister}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="nome@esempio.com"
            />
          </div>

          {!isLogin && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Cognome
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Telefono (opzionale)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder={isLogin ? "La tua password" : "Minimo 8 caratteri"}
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {loading ? "Caricamento..." : isLogin ? "Accedi" : "Registrati"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin((v) => !v);
              setError("");
            }}
            className="text-sm text-emerald-600 hover:underline"
          >
            {isLogin ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
          </button>
        </div>
      </div>
    </Layout>
  );
}
