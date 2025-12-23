import { Link, useLocation } from "react-router-dom";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

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
            <Link
              to="/login"
              className="hidden sm:inline-flex items-center gap-1.5 text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-full hover:bg-slate-50 transition-colors"
            >
              <span>Login</span>
            </Link>

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
