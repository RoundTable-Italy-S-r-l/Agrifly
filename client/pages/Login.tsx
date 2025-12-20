import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';

// In sviluppo, usa percorso relativo (Vite fa proxy automatico)
// In produzione, usa VITE_API_URL se definito
const API_URL = "";

export default function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerificationCode, setShowVerificationCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requiresOrgSelection, setRequiresOrgSelection] = useState(false);
  const [organizations, setOrganizations] = useState<any[]>([]);

  // Helper per fare parsing sicuro della risposta JSON
  const parseJsonSafe = async (response: Response) => {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error('Resposta non JSON dal server:', text);
      throw new Error('Risposta non valida dal server');
    }
  };

  const handleSendVerificationCode = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`/.netlify/functions/send-verification-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await parseJsonSafe(response);
        throw new Error(data.error || 'Errore nell\'invio del codice');
      }

      setShowVerificationCode(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          phone: phone || undefined,
          verification_code: verificationCode || undefined,
        }),
      });

      const data = await parseJsonSafe(response);

      if (!response.ok) {
        throw new Error(data.error || 'Errore nella registrazione');
      }

      // Salva token e redirect
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('organization', JSON.stringify(data.organization));
        queryClient.invalidateQueries();
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await parseJsonSafe(response);

      if (!response.ok) {
        throw new Error(data.error || 'Errore nel login');
      }

      // Se richiede selezione organization
      if (data.requiresOrgSelection) {
        setRequiresOrgSelection(true);
        setOrganizations(data.organizations);
        return;
      }

      // Salva token e redirect
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('organization', JSON.stringify(data.organization));
        queryClient.invalidateQueries();
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOrganization = async (orgId: string) => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`${API_URL}/api/auth/select-organization`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, organization_id: orgId }),
      });

      const data = await parseJsonSafe(response);

      if (!response.ok) {
        throw new Error(data.error || 'Errore nella selezione');
      }

      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('organization', JSON.stringify(data.organization));
        queryClient.invalidateQueries();
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (requiresOrgSelection) {
    return (
      <Layout>
        <div className="max-w-md mx-auto mt-12">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Seleziona Organization</h1>
          <p className="text-slate-600 mb-8">Hai accesso a più organizzazioni. Scegli con quale vuoi accedere:</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSelectOrganization(org.id)}
                disabled={loading}
                className="w-full p-4 bg-white border-2 border-slate-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left"
              >
                <div className="font-bold text-slate-900">{org.name}</div>
                <div className="text-sm text-slate-600 mt-1">
                  Ruolo: {org.role === 'VENDOR_ADMIN' ? 'Amministratore Venditore' : 
                          org.role === 'BUYER_ADMIN' ? 'Amministratore Acquirente' :
                          org.role === 'DISPATCHER' ? 'Dispatcher' :
                          org.role === 'PILOT' ? 'Pilota' : org.role}
                </div>
              </button>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto mt-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          {isLogin ? 'Accedi' : 'Registrati'}
        </h1>
        <p className="text-slate-600 mb-8">
          {isLogin 
            ? 'Accedi al tuo account per gestire la dashboard' 
            : 'Crea un nuovo account per iniziare'}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
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
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Nome</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Cognome</label>
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
                <label className="block text-sm font-semibold text-slate-700 mb-2">Telefono (opzionale)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              {!showVerificationCode && (
                <button
                  type="button"
                  onClick={handleSendVerificationCode}
                  disabled={loading || !email}
                  className="w-full px-4 py-2 text-sm text-emerald-600 border border-emerald-600 rounded-lg hover:bg-emerald-50 transition disabled:opacity-50"
                >
                  Invia codice verifica email
                </button>
              )}

              {showVerificationCode && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Codice verifica (6 cifre)</label>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    maxLength={6}
                    placeholder="123456"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-center text-2xl tracking-widest"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Il codice è stato inviato a {email}. Valido per 10 minuti.
                  </p>
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
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
            {loading ? 'Caricamento...' : isLogin ? 'Accedi' : 'Registrati'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setShowVerificationCode(false);
              setVerificationCode('');
            }}
            className="text-sm text-emerald-600 hover:underline"
          >
            {isLogin 
              ? 'Non hai un account? Registrati' 
              : 'Hai già un account? Accedi'}
          </button>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-200">
          <p className="text-xs text-slate-500 text-center mb-4">Oppure accedi con</p>
          <div className="grid grid-cols-2 gap-3">
            <a
              href={`${API_URL}/api/auth/google`}
              className="px-4 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 transition text-center text-sm font-medium"
            >
              Google
            </a>
            <a
              href={`${API_URL}/api/auth/microsoft`}
              className="px-4 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 transition text-center text-sm font-medium"
            >
              Microsoft
            </a>
          </div>
        </div>
      </div>
    </Layout>
  );
}

