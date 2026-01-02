import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Package, MapPin, Target, Zap, TrendingUp, Phone, LogOut } from 'lucide-react';
import { authAPI } from '@/lib/auth';
import { saveCurrentPathAsRedirect } from '@/lib/auth-redirect';

export default function Index() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [orgType, setOrgType] = useState<string | null>(null);

  useEffect(() => {
    // Verifica autenticazione
    const token = localStorage.getItem('auth_token');
    const orgData = localStorage.getItem('organization');
    
    if (token && orgData) {
      try {
        const org = JSON.parse(orgData);
        setIsAuthenticated(true);
        setOrgType(org.type || org.org_type || null);
      } catch {
        setIsAuthenticated(false);
      }
    } else {
      setIsAuthenticated(false);
    }

    // Ascolta eventi di cambio autenticazione
    const handleAuthChange = () => {
      const token = localStorage.getItem('auth_token');
      const orgData = localStorage.getItem('organization');
      setIsAuthenticated(!!(token && orgData));
      if (orgData) {
        try {
          const org = JSON.parse(orgData);
          setOrgType(org.type || org.org_type || null);
        } catch {
          setOrgType(null);
        }
      }
    };

    window.addEventListener('authChanged', handleAuthChange);
    return () => window.removeEventListener('authChanged', handleAuthChange);
  }, []);

  const handleLoginClick = () => {
    saveCurrentPathAsRedirect();
    navigate('/login');
  };

  const handleLogout = () => {
    authAPI.logout();
    setIsAuthenticated(false);
    setOrgType(null);
    navigate('/');
  };

  const getDashboardPath = () => {
    if (orgType === 'buyer') return '/buyer';
    if (orgType === 'provider') return '/admin';
    // Fallback per retrocompatibilità
    if (orgType === 'vendor' || orgType === 'operator') return '/admin';
    return '/dashboard';
  };

  const getDashboardLabel = () => {
    if (orgType === 'buyer') return 'Dashboard Buyer';
    if (orgType === 'provider') return 'Dashboard Admin';
    // Fallback per retrocompatibilità
    if (orgType === 'vendor' || orgType === 'operator') return 'Dashboard Admin';
    return 'Dashboard';
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="flex items-center gap-3 cursor-pointer group"
          >
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2F2465e073f7c94097be8616ce134014fe%2Fab87517a72b04105b416c2482c4ec60b?format=webp&width=800"
              alt="DJI Agriculture app icon"
              className="h-9 w-9 rounded-2xl object-cover shadow-md group-hover:shadow-lg transition-shadow"
            />
            <span className="hidden sm:flex flex-col items-start leading-none">
              <span className="text-[10px] tracking-[0.28em] font-semibold text-slate-500 uppercase">DJI</span>
              <span className="text-xs tracking-[0.24em] font-semibold text-slate-900 uppercase">Agriculture</span>
    </span>
          </Link>

          <nav className="hidden md:flex items-center justify-center flex-1">
            <div className="inline-flex items-center gap-1 rounded-full bg-slate-100/70 px-1.5 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-600">
              <Link
                to="/"
                className="px-3 py-1 rounded-full hover:bg-slate-900 hover:text-white transition-colors"
              >
                Home
              </Link>
              <Link
                to="/catalogo"
                className="px-3 py-1 rounded-full hover:bg-slate-900 hover:text-white transition-colors"
              >
                Catalogo Droni
              </Link>
              <Link
                to="/servizi"
                className="px-3 py-1 rounded-full hover:bg-slate-900 hover:text-white transition-colors"
              >
                Servizi GIS
              </Link>
                </div>
          </nav>

          <div className="flex items-center gap-2 md:gap-3">
            {isAuthenticated ? (
              <>
                <button
                  onClick={handleLogout}
                  className="hidden sm:inline-flex items-center gap-1.5 text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-full hover:bg-slate-50 transition-colors"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Logout</span>
                </button>
                <Link
                  to={getDashboardPath()}
                  className="text-xs md:text-sm py-2 px-4 md:px-5 font-semibold tracking-wide rounded-full bg-slate-900 text-white hover:bg-black transition-colors"
                >
                  {getDashboardLabel()}
                </Link>
              </>
            ) : (
              <>
                <button
                  onClick={handleLoginClick}
                  className="hidden sm:inline-flex items-center gap-1.5 text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-full hover:bg-slate-50 transition-colors"
                >
                  <span>Login</span>
                </button>
                <button className="text-xs md:text-sm py-2 px-4 md:px-5 font-semibold tracking-wide rounded-full bg-slate-900 text-white hover:bg-black">
                  Contattaci
                </button>
              </>
            )}
          </div>
                        </div>
      </header>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-white">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
                    </div>

        <div className="relative max-w-7xl mx-auto px-4 py-16 sm:py-24 lg:py-32">
          <div className="text-center">
            {/* Logo */}
            <div className="flex justify-center mb-8">
              <img
                src="https://cdn.builder.io/api/v1/image/assets%2F2465e073f7c94097be8616ce134014fe%2Fab87517a72b04105b416c2482c4ec60b?format=webp&width=800"
                alt="DJI Agriculture logo"
                className="h-16 w-auto"
              />
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 mb-6">
              <span className="block">Drone Agriculture</span>
              <span className="block text-emerald-600">Partner Platform</span>
            </h1>

            {/* Subtitle */}
            <p className="max-w-3xl mx-auto text-xl text-slate-600 mb-12 leading-relaxed">
              Soluzione white-label per rivenditori autorizzati DJI. Offri droni agricoli,
              servizi di trattamento e monitoraggio con la nostra piattaforma completa.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                to="/catalogo"
                className="inline-flex items-center px-8 py-4 text-lg font-semibold text-white bg-slate-900 hover:bg-black rounded-full transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <Package className="w-5 h-5 mr-2" />
                Catalogo Droni
              </Link>
              <Link
                to="/servizi"
                className="inline-flex items-center px-8 py-4 text-lg font-semibold text-slate-900 bg-white border-2 border-slate-200 hover:border-emerald-400 rounded-full transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <MapPin className="w-5 h-5 mr-2" />
                Servizi GIS
              </Link>
            </div>
              </div>
            </div>
                </div>

      {/* Features Grid */}
      <div className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Perché Scegliere DJI Agriculture</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Tecnologia all'avanguardia per l'agricoltura di precisione
                     </p>
                   </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-6">
                <Target className="w-6 h-6 text-emerald-600" />
                   </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Precisione Millimetrica</h3>
              <p className="text-slate-600">
                Applicazione precisa di fertilizzanti e pesticidi con risparmio fino al 30% sui costi operativi.
              </p>
                </div>

            {/* Feature 2 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                <Zap className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Velocità Operativa</h3>
              <p className="text-slate-600">
                Copertura di ettari in poche ore, sostituendo giorni di lavoro manuale tradizionale.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-6">
                <TrendingUp className="w-6 h-6 text-amber-600" />
        </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">ROI Rapido</h3>
              <p className="text-slate-600">
                Ritorno sull'investimento in 6-8 mesi grazie al risparmio sui costi e nuove opportunità di business.
              </p>
          </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Risultati Misurabili</h2>
            <p className="text-lg text-slate-600">Dati reali da implementazioni agricole</p>
            </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-6 bg-white border-l-4 border-emerald-600 rounded-lg shadow-sm">
                <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl font-bold text-slate-900">-30%</span>
                </div>
              <h4 className="font-bold text-slate-800 mb-2 uppercase tracking-wide text-sm">Costi Operativi</h4>
              <p className="text-slate-600 text-sm">Riduzione significativa nei costi di fertilizzanti e pesticidi.</p>
              </div>
              <div className="p-6 bg-white border-l-4 border-blue-600 rounded-lg shadow-sm">
                <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl font-bold text-slate-900">10x</span>
                </div>
              <h4 className="font-bold text-slate-800 mb-2 uppercase tracking-wide text-sm">Velocità</h4>
              <p className="text-slate-600 text-sm">Trattamenti completati 10 volte più velocemente.</p>
              </div>
              <div className="p-6 bg-white border-l-4 border-amber-600 rounded-lg shadow-sm">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-5xl font-bold text-slate-900">6-8</span>
                  <span className="text-lg text-slate-600">mesi</span>
                </div>
              <h4 className="font-bold text-slate-800 mb-2 uppercase tracking-wide text-sm">Break-even</h4>
              <p className="text-slate-600 text-sm">Ritorno sull'investimento in 6-8 mesi.</p>
              </div>
            </div>
          </div>
          </div>

      {/* CTA Section */}
      <div className="py-16 bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Pronto a Trasformare la Tua Azienda Agricola?</h2>
          <p className="text-xl text-slate-300 mb-8">
            Contatta il nostro team per una dimostrazione personalizzata
          </p>
          <button className="inline-flex items-center px-8 py-4 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl">
            <Phone className="w-5 h-5 mr-2" />
            Contattaci Ora
              </button>
            </div>
          </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-20">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center text-sm text-slate-500">
          <p>© 2024 DJI Agriculture Partner Platform – soluzione white‑label per rivenditori autorizzati.</p>
          <p className="text-xs mt-2">Dati ROI basati su medie di mercato reali. Consulta il tuo commerciale per dettagli.</p>
        </div>
      </footer>
    </div>
  );
}