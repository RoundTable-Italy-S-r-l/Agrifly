import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { authAPI } from "@/lib/auth";
import { getCart } from "@/lib/api";
import { ShoppingCart } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path: string) => location.pathname === path;
  const [isAuthenticated, setIsAuthenticated] = useState(authAPI.isAuthenticated());
  const [cartItemCount, setCartItemCount] = useState(0);

  // Aggiorna lo stato di autenticazione quando cambia il token o l'organizzazione
  useEffect(() => {
    const checkAuth = () => {
      setIsAuthenticated(authAPI.isAuthenticated());
    };

    // Controlla immediatamente
    checkAuth();

    // Ascolta cambiamenti nel localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token' || e.key === 'organization') {
        checkAuth();
      }
    };

    // Ascolta eventi custom per aggiornamenti di autenticazione
    const handleAuthChange = () => {
      checkAuth();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('authChanged', handleAuthChange);

    // Controlla periodicamente (ogni 5 secondi) per gestire cambiamenti nella stessa tab
    const interval = setInterval(checkAuth, 5000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('authChanged', handleAuthChange);
      clearInterval(interval);
    };
  }, [location.pathname]);

  // Ottieni conteggio item carrello
  useEffect(() => {
    const updateCartCount = async () => {
      try {
        let orgId = null;
        let userId = null;
        let sessionId = null;

        // Prova a ottenere orgId da localStorage (utenti autenticati)
        const orgData = localStorage.getItem('organization');
        if (orgData) {
          try {
            const org = JSON.parse(orgData);
            orgId = org.id;
          } catch (e) {
            console.warn('Errore parsing organization:', e);
          }
        }

        // Se non abbiamo orgId da organization, prova guest_org_id (utenti guest)
        if (!orgId) {
          orgId = localStorage.getItem('guest_org_id');
        }

        // Se non abbiamo orgId, non possiamo avere un carrello
        if (!orgId) {
          setCartItemCount(0);
          return;
        }

        // Prova a ottenere userId da token JWT
        const token = localStorage.getItem('auth_token');
        if (token) {
          try {
            const parts = token.split('.');
            const body = parts.length === 3 ? parts[1] : parts[0];
            const base64 = body.replace(/-/g, '+').replace(/_/g, '/');
            const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
            const decoded = atob(padded);
            const payload = JSON.parse(decoded);
            userId = payload.userId;
          } catch (e) {
            console.warn('❌ Errore parsing token:', e);
          }
        }

        // Se non abbiamo userId, usa sessionId per carrelli guest
        if (!userId) {
          sessionId = localStorage.getItem('session_id');
          if (!sessionId) {
            // Genera un sessionId se non esiste
            sessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('session_id', sessionId);
          }
        }

        const cartData = await getCart(orgId, userId || undefined, sessionId || undefined);
        const itemCount = cartData.items?.length || 0;
        setCartItemCount(itemCount);
      } catch (error) {
        console.warn('❌ Errore caricamento carrello:', error);
        console.error('Error details:', error);
        setCartItemCount(0);
      }
    };

    updateCartCount();

    // Aggiorna ogni 30 secondi o quando cambia location
    const interval = setInterval(updateCartCount, 30000);

    // Ascolta eventi custom per aggiornamenti immediati del carrello
    const handleCartUpdate = () => {
      updateCartCount();
    };

    window.addEventListener('cartUpdated', handleCartUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('cartUpdated', handleCartUpdate);
    };
  }, [location.pathname]);

  // Funzione per ottenere il ruolo dell'utente
  const getUserRole = () => {
    try {
      const orgData = localStorage.getItem('organization');
      if (orgData) {
        const org = JSON.parse(orgData);
        return org.role;
      }
    } catch (e) {
      console.warn('Errore lettura ruolo utente:', e);
    }
    return null;
  };

  // Funzione per ottenere il path della dashboard in base al ruolo
  const getDashboardPath = () => {
    const role = getUserRole();
    if (role && role.includes('ADMIN')) {
      return '/admin';
    }
    return '/dashboard'; // Reindirizza automaticamente
  };

  const handleLogout = () => {
    authAPI.logout();
    navigate('/login');
    };

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-slate-200">
      {/* Header con menu */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 cursor-pointer group">
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2F2465e073f7c94097be8616ce134014fe%2Fab87517a72b04105b416c2482c4ec60b?format=webp&width=800"
              alt="DJI Agriculture app icon"
              className="h-9 w-9 rounded-2xl object-cover shadow-md group-hover:shadow-lg transition-shadow"
            />
            <span className="hidden sm:flex flex-col items-start leading-none">
              <span className="text-[10px] tracking-[0.28em] font-semibold text-slate-500 uppercase">
                DJI
              </span>
              <span className="text-xs tracking-[0.24em] font-semibold text-slate-900 uppercase">
                Agriculture
              </span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center justify-center flex-1">
            <div className="inline-flex items-center gap-1 rounded-full bg-slate-100/70 px-1.5 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-600">
              <Link
                to="/"
                className={`px-3 py-1 rounded-full transition-colors ${
                  isActive("/") ? "bg-slate-900 text-white" : "hover:bg-white hover:text-slate-900"
                }`}
              >
                Home
              </Link>
              <Link
                to="/catalogo"
                className={`px-3 py-1 rounded-full transition-colors ${
                  isActive("/catalogo")
                    ? "bg-slate-900 text-white"
                    : "hover:bg-white hover:text-slate-900"
                }`}
              >
                Catalogo Droni
              </Link>
              <Link
                to="/servizi"
                className={`px-3 py-1 rounded-full transition-colors ${
                  isActive("/servizi")
                    ? "bg-slate-900 text-white"
                    : "hover:bg-white hover:text-slate-900"
                }`}
              >
                Servizi GIS
              </Link>
            </div>
          </nav>

          <div className="flex items-center gap-2 md:gap-3">
            {/* Carrello */}
            <button
              onClick={() => {
                if (isAuthenticated) {
                  navigate('/buyer/carrello');
                } else {
                  navigate('/login?redirect=/buyer/carrello');
                }
              }}
              className="relative inline-flex items-center gap-1.5 text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-full hover:bg-slate-50 transition-colors"
              title="Carrello"
            >
              <ShoppingCart className="w-4 h-4" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[8px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </span>
              )}
            </button>

            {isAuthenticated ? (
              <>
                <Link
                  to={getDashboardPath()}
                  className="hidden sm:inline-flex items-center gap-1.5 text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-full hover:bg-slate-50 transition-colors"
                >
                  <span>Dashboard</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="hidden sm:inline-flex items-center gap-1.5 text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-full hover:bg-slate-50 transition-colors"
                  >
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="hidden sm:inline-flex items-center gap-1.5 text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-full hover:bg-slate-50 transition-colors"
              >
                <span>Login</span>
              </Link>
            )}

            <button className="text-xs md:text-sm py-2 px-4 md:px-5 font-semibold tracking-wide rounded-full bg-slate-900 text-white hover:bg-black">
              Contattaci
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12">{children}</main>

      <footer className="border-t border-slate-200 bg-white mt-20">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center text-sm text-slate-500">
          <p>© 2024 DJI Agriculture Partner Platform – soluzione white-label per rivenditori autorizzati.</p>
          <p className="text-xs mt-2">
            Dati ROI basati su medie di mercato reali. Consulta il tuo commerciale per dettagli.
          </p>
        </div>
      </footer>
    </div>
  );
}
