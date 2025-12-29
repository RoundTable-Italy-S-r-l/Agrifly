import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { authAPI } from "@/lib/auth";
import { migrateCart } from "@/lib/api";

export default function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [isLogin, setIsLogin] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [accountType, setAccountType] = useState<"buyer" | "vendor" | "operator">("buyer");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  // Check URL parameters on component mount
  useEffect(() => {
    const mode = searchParams.get('mode');
    const redirect = searchParams.get('redirect');
    const action = searchParams.get('action');
    const productId = searchParams.get('productId');

    console.log('🔍 Login page loaded with params:', { mode, redirect, action, productId });

    if (mode === 'register') {
      setIsLogin(false);
      setAccountType('buyer'); // Default to buyer for preventivo flow
    }

    // Store redirect information for post-login navigation
    if (redirect) {
      localStorage.setItem('post_login_redirect', redirect);
      console.log('💾 Stored post_login_redirect:', redirect);
    }

    // Store wishlist action if present
    if (action === 'wishlist' && productId) {
      localStorage.setItem('wishlist_action', 'true');
      localStorage.setItem('wishlist_product_id', productId);
      console.log('💾 Stored wishlist action for product:', productId);
    }

    // Check for temp field data
    const tempData = localStorage.getItem('temp_field_data');
    if (tempData) {
      console.log('📊 Found temp_field_data:', JSON.parse(tempData));
    }
  }, [searchParams]);

  // Check for temporary field data from preventivo flow
  useEffect(() => {
    const tempData = localStorage.getItem('temp_field_data');
    if (tempData) {
      console.log('📋 Temporary field data found:', JSON.parse(tempData));
      // Keep it in localStorage until user completes registration/login
    }
  }, []);

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
        organizationName: organizationName.trim() || `${firstName} ${lastName}`, // Nome org personalizzato o default
        accountType
      });

      // Salva JWT, utente e organizzazione
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem('organization', JSON.stringify(data.organization));
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }

      setError(
        `Registrazione completata come ${accountType === 'buyer' ? 'Acquirente' : accountType === 'vendor' ? 'Fornitore' : 'Operatore'}! Accesso automatico effettuato.`
      );

      // Controlla se c'è un redirect speciale (es. da flusso anonimo)
      await queryClient.invalidateQueries();

      const postLoginRedirect = localStorage.getItem('post_login_redirect');
      console.log('🔄 Checking redirect after registration:', { postLoginRedirect, canBuy: data.organization.can_buy, emailVerified: data.user?.email_verified });

      // Se l'email non è verificata, redirect a verifica email
      // NON migrare il carrello ora - sarà migrato dopo la verifica email
      // MANTIENI session_id e post_login_redirect per dopo
      if (!data.user?.email_verified) {
        console.log(`📧 Email non verificata, redirect a /verify-email (mantenendo session_id e post_login_redirect: ${postLoginRedirect})`);
        navigate('/verify-email', { replace: true });
        return;
      }

      // Se l'email è già verificata, migra il carrello ora
      const sessionId = localStorage.getItem('session_id');
      if (sessionId && data.user?.id && data.organization?.id) {
        try {
          console.log('🛒 Migrazione carrello guest dopo registrazione (email già verificata)...');
          const migrateResult = await migrateCart(sessionId, data.user.id, data.organization.id);
          console.log('📦 Risultato migrazione:', migrateResult);
          localStorage.removeItem('session_id');
          localStorage.removeItem('guest_org_id');
          console.log('✅ Carrello migrato con successo');
          // Invalida specificamente le query del carrello
          await queryClient.invalidateQueries({ queryKey: ['cart'] });
        } catch (err) {
          console.error('⚠️ Errore migrazione carrello (non critico):', err);
          // Non bloccare il flusso se la migrazione fallisce
        }
      }

      if (postLoginRedirect === 'nuovo-preventivo' && data.organization.can_buy) {
        // Trasferisci dati campo temporanei ai dati utente
        const tempFieldData = localStorage.getItem('temp_field_data');
        console.log('📋 Temp field data before transfer:', tempFieldData);

        if (tempFieldData) {
          localStorage.setItem('pending_field_data', tempFieldData);
          localStorage.removeItem('temp_field_data');
          console.log('✅ Field data transferred to pending for nuovo-preventivo');

          // Verifica che il trasferimento sia avvenuto
          const pendingData = localStorage.getItem('pending_field_data');
          console.log('🔍 Pending field data after transfer:', pendingData);
        } else {
          console.log('⚠️ No temp field data found to transfer');
        }

        localStorage.removeItem('post_login_redirect');
        console.log(`🚀 Redirect speciale dopo registrazione: /buyer/nuovo-preventivo`);
        navigate('/buyer/nuovo-preventivo', { replace: true });
        return;
      }

      // Gestisci redirect al carrello (sia 'carrello' che '/buyer/carrello')
      // Solo se l'email è già verificata
      if ((postLoginRedirect === 'carrello' || postLoginRedirect === '/buyer/carrello' || postLoginRedirect?.includes('carrello')) && data.organization.can_buy) {
        localStorage.removeItem('post_login_redirect');
        console.log(`🛒 Redirect speciale dopo registrazione: /buyer/carrello`);
        navigate('/buyer/carrello', { replace: true });
        return;
      }
      
      // Gestisci altri redirect diretti (percorsi completi)
      // Solo se l'email è già verificata
      if (postLoginRedirect && postLoginRedirect.startsWith('/')) {
        localStorage.removeItem('post_login_redirect');
        console.log(`🔄 Redirect a percorso specifico: ${postLoginRedirect}`);
        navigate(postLoginRedirect, { replace: true });
        return;
      }

      // Determina dashboard in base alle capabilities (come nel login)
      if (data.organization.can_buy && !data.organization.can_sell && !data.organization.can_operate && !data.organization.can_dispatch) {
        // Solo buyer → dashboard buyer
        console.log('🛒 Redirect buyer dopo registrazione');
        navigate('/buyer', { replace: true });
      } else if (data.organization.can_sell || data.organization.can_operate || data.organization.can_dispatch) {
        // Vendor/Operator/Dispatcher → dashboard admin
        console.log('🏪 Redirect admin dopo registrazione');
        navigate('/admin', { replace: true });
      } else {
        // Fallback
        console.log('📊 Redirect dashboard generica dopo registrazione');
        navigate('/dashboard', { replace: true });
      }

    } catch (err: any) {
      console.error('❌ Registration error:', err);
      if (err?.message?.includes('Email già registrata')) {
        setError("Questa email è già registrata. Usa 'Accedi' invece di registrarti, oppure usa un'email diversa per creare un nuovo account.");
      } else if (err?.message?.includes('Hai già un profilo')) {
        setError(err.message);
      } else {
        setError(err?.message || "Errore nella registrazione");
      }
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

      console.log('📦 Dati login ricevuti:', { 
        hasToken: !!data.token, 
        hasUser: !!data.user, 
        hasOrganization: !!data.organization 
      });

      // Salva JWT, utente e organizzazione
      localStorage.setItem("auth_token", data.token);
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      localStorage.setItem('organization', JSON.stringify(data.organization));

      console.log('✅ Login completato, JWT, utente e organizzazione salvati');

      // Migra carrello guest se esiste
      const sessionId = localStorage.getItem('session_id');
      if (sessionId && data.user?.id && data.organization?.id) {
        try {
          console.log('🛒 Migrazione carrello guest...', { sessionId, userId: data.user.id, orgId: data.organization.id });
          const migrateResult = await migrateCart(sessionId, data.user.id, data.organization.id);
          console.log('📦 Risultato migrazione:', migrateResult);
          localStorage.removeItem('session_id');
          localStorage.removeItem('guest_org_id');
          console.log('✅ Carrello migrato con successo');
          // Invalida specificamente le query del carrello
          await queryClient.invalidateQueries({ queryKey: ['cart'] });
        } catch (err) {
          console.error('⚠️ Errore migrazione carrello (non critico):', err);
          // Non bloccare il flusso se la migrazione fallisce
        }
      }

      await queryClient.invalidateQueries();

      // Check for special redirect PRIMA di determinare la dashboard
      const postLoginRedirect = localStorage.getItem('post_login_redirect');
      const organization = data.organization;
      const user = data.user;

      console.log('🔄 Checking post_login_redirect:', { postLoginRedirect, canBuy: organization.can_buy });

      // Gestisci redirect al carrello (sia 'carrello' che '/buyer/carrello')
      if ((postLoginRedirect === 'carrello' || postLoginRedirect === '/buyer/carrello' || postLoginRedirect?.includes('carrello')) && organization.can_buy) {
        localStorage.removeItem('post_login_redirect');
        console.log(`🛒 Navigazione speciale a: /buyer/carrello`);
        navigate('/buyer/carrello', { replace: true });
        return;
      }

      // Gestisci redirect a nuovo-preventivo
      if (postLoginRedirect === 'nuovo-preventivo' && organization.type === 'buyer') {
        // Transfer temporary field data to user session
        const tempFieldData = localStorage.getItem('temp_field_data');
        if (tempFieldData) {
          localStorage.setItem('pending_field_data', tempFieldData);
          localStorage.removeItem('temp_field_data'); // Clean up temp data
          console.log('📋 Field data transferred to pending for nuovo-preventivo');
        }

        localStorage.removeItem('post_login_redirect');
        console.log(`🚀 Navigazione speciale a: /buyer/nuovo-preventivo`);
        navigate('/buyer/nuovo-preventivo', { replace: true });
        return;
      }
      
      // Gestisci altri redirect diretti (percorsi completi)
      if (postLoginRedirect && postLoginRedirect.startsWith('/')) {
        localStorage.removeItem('post_login_redirect');
        console.log(`🔄 Navigazione a percorso specifico: ${postLoginRedirect}`);
        navigate(postLoginRedirect, { replace: true });
        return;
      }

      // Se non c'è redirect speciale, determina la dashboard in base al ruolo dell'utente e tipo organizzazione
      let selectedRole;
      let dashboardPath;

      // Logica basata su TYPE organizzazione + ROLE utente
      if (organization.type === 'buyer') {
        // 🛒 BUYER organization - tutti i ruoli vanno alla dashboard buyer
        selectedRole = 'BUYER';
        dashboardPath = '/buyer';
        console.log('🛒 Redirect a dashboard buyer (type buyer)');

      } else if (organization.type === 'vendor' || organization.type === 'operator') {
        // 🏪/👷‍♂️ VENDOR/OPERATOR organization - logica basata su role utente
        if (user.role === 'admin') {
          selectedRole = 'ADMIN';
          dashboardPath = '/admin/catalogo'; // Admin di vendor/operator
          console.log('👑 Redirect a dashboard admin (vendor/operator)');
        } else if (user.role === 'operator') {
          selectedRole = 'OPERATOR';
          dashboardPath = '/admin/prenotazioni';
          console.log('👷‍♂️ Redirect a dashboard operator');
        } else if (user.role === 'vendor') {
          selectedRole = 'VENDOR';
          dashboardPath = '/admin/catalogo';
          console.log('🏪 Redirect a dashboard vendor');
        } else if (user.role === 'dispatcher') {
          selectedRole = 'DISPATCHER';
          dashboardPath = '/admin';
          console.log('🚛 Redirect a dashboard dispatcher');
        } else {
          // Ruolo sconosciuto - default admin
          selectedRole = 'ADMIN';
          dashboardPath = '/admin/catalogo';
          console.log('❓ Redirect a dashboard admin (ruolo sconosciuto)');
        }

      } else {
        // Tipo organizzazione sconosciuto
        console.error('❌ Tipo organizzazione non riconosciuto:', organization.type);
        setError('Tipo organizzazione non supportato. Contatta l\'amministratore.');
        return;
      }

      const roleData = {
        role: selectedRole,
        organization: organization
      };
      localStorage.setItem('selected_role', JSON.stringify(roleData));

      console.log(`🚀 Navigazione a dashboard:`, dashboardPath);
      navigate(dashboardPath, { replace: true });

    } catch (err: any) {
      setError(err?.message || "Errore nel login");
    } finally {
      setLoading(false);
    }
  };

  // RICHIESTA RESET PASSWORD
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError("Inserisci la tua email");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResetUrl(null);

      const response = await authAPI.requestPasswordReset(email);
      
      // Se il backend restituisce un resetUrl (sviluppo senza RESEND configurato)
      if ((response as any).resetUrl) {
        setResetUrl((response as any).resetUrl);
      }
      
      setResetEmailSent(true);
      setError("");

    } catch (err: any) {
      setError(err?.message || "Errore nella richiesta reset password");
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
          {showForgotPassword
            ? "Inserisci la tua email per ricevere il link di reset password"
            : isLogin
            ? "Accedi al tuo account per gestire la dashboard"
            : "Crea un nuovo account per iniziare"}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {resetEmailSent ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg mb-6">
            {resetUrl ? (
              <>
                <p className="font-semibold mb-2">⚠️ Email non configurata (modalità sviluppo)</p>
                <p className="text-sm mb-3">
                  RESEND_API_KEY non è configurato. Usa questo link per resettare la password:
                </p>
                <div className="bg-white p-3 rounded border border-emerald-300 mb-3">
                  <a 
                    href={resetUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:underline break-all text-sm"
                  >
                    {resetUrl}
                  </a>
                </div>
                <p className="text-xs text-emerald-600 mb-3">
                  ⚠️ Questo link è visibile solo perché RESEND_API_KEY non è configurato. In produzione, il link verrà inviato via email.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold mb-2">Email inviata!</p>
                <p className="text-sm">
                  Controlla la tua casella email ({email}) per il link di reset password.
                  Se non la trovi, controlla anche la cartella spam.
                </p>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(false);
                setResetEmailSent(false);
                setResetUrl(null);
                setError("");
              }}
              className="mt-4 text-sm text-emerald-600 hover:underline"
            >
              Torna al login
            </button>
          </div>
        ) : (
          <form
            onSubmit={showForgotPassword ? handleForgotPassword : isLogin ? handleLogin : handleRegister}
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

            {!showForgotPassword && !isLogin && (
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

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Nome organizzazione (opzionale)
                </label>
                <input
                  type="text"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder={firstName && lastName ? `Se vuoto: ${firstName} ${lastName}` : 'Es: Azienda Agricola Rossi'}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {firstName && lastName 
                    ? `Se non inserisci un nome, verrà usato automaticamente "${firstName} ${lastName}"`
                    : 'Se non inserisci un nome, verrà usato Nome Cognome'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Tipo di account
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setAccountType("buyer")}
                    className={`px-4 py-3 border rounded-lg text-sm font-medium transition-colors ${
                      accountType === "buyer"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    🛒 Acquirente
                    <div className="text-xs mt-1 opacity-75">
                      Acquisto servizi
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccountType("vendor")}
                    className={`px-4 py-3 border rounded-lg text-sm font-medium transition-colors ${
                      accountType === "vendor"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    🏢 Fornitore
                    <div className="text-xs mt-1 opacity-75">
                      Vendo droni
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccountType("operator")}
                    className={`px-4 py-3 border rounded-lg text-sm font-medium transition-colors ${
                      accountType === "operator"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    ✈️ Operatore
                    <div className="text-xs mt-1 opacity-75">
                      Eseguo servizi
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}

            {!showForgotPassword && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Password
                  </label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(true);
                        setError("");
                      }}
                      className="text-sm text-emerald-600 hover:underline"
                    >
                      Password dimenticata?
                    </button>
                  )}
                </div>
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
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {loading 
                ? "Caricamento..." 
                : showForgotPassword 
                ? "Invia link reset" 
                : isLogin 
                ? "Accedi" 
                : "Registrati"}
            </Button>
          </form>
        )}

        {!showForgotPassword && !resetEmailSent && (
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
        )}
        
        {showForgotPassword && !resetEmailSent && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(false);
                setError("");
              }}
              className="text-sm text-emerald-600 hover:underline"
            >
              Torna al login
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
