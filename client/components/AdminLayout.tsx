import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Calendar, Users, Settings, BarChart3, Package, Truck, CreditCard, Pin, PinOff, ClipboardList } from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const isExpanded = isPinned || isHovered;

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Servizi', href: '/admin/servizi', icon: Calendar },
    { name: 'Prenotazioni', href: '/admin/prenotazioni', icon: ClipboardList },
    { name: 'Missioni', href: '/admin/missioni', icon: Truck },
    { name: 'Operatori', href: '/admin/operatori', icon: Users },
    { name: 'Catalogo', href: '/admin/catalogo', icon: Package },
    { name: 'Ordini', href: '/admin/ordini', icon: ShoppingBag },
    { name: 'Impostazioni', href: '/admin/impostazioni', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 bg-white shadow-lg border-r border-slate-200 transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded ? 'w-64' : 'w-16'
        }`}
        onMouseEnter={() => !isPinned && setIsHovered(true)}
        onMouseLeave={() => !isPinned && setIsHovered(false)}
        style={{ willChange: 'width' }}
      >
        <div className="flex flex-col h-full">
          {/* Logo e Pin button */}
          <div className="relative border-b border-slate-200">
            <Link
              to="/admin"
              className={`flex items-center gap-3 p-6 transition-all duration-300 ease-in-out ${
                isExpanded ? 'justify-start' : 'justify-center'
              }`}
            >
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  isExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'
                }`}
              >
                <div className="text-sm font-bold text-slate-900 whitespace-nowrap">DJI Agriculture</div>
                <div className="text-xs text-slate-500 whitespace-nowrap">Admin Panel</div>
              </div>
            </Link>
            {/* Pin button */}
            <button
              onClick={() => setIsPinned(!isPinned)}
              className={`absolute top-2 right-2 p-1.5 rounded-md hover:bg-slate-100 transition-all duration-300 ease-in-out ${
                isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'
              }`}
              title={isPinned ? 'Sblocca sidebar' : 'Blocca sidebar'}
            >
              {isPinned ? (
                <Pin className="w-4 h-4 text-slate-600" />
              ) : (
                <PinOff className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>

          {/* Navigation */}
          <nav className={`flex-1 py-6 space-y-2 ${isExpanded ? 'px-4' : 'px-2'}`}>
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center rounded-lg text-sm font-medium transition-all duration-300 ease-in-out ${
                    isExpanded ? 'gap-3 px-3 py-2' : 'justify-center px-2 py-2'
                  } ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 border-r-2 border-emerald-600'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  title={!isExpanded ? item.name : undefined}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span
                    className={`overflow-hidden transition-all duration-300 ease-in-out whitespace-nowrap ${
                      isExpanded ? 'opacity-100 max-w-[180px] ml-0' : 'opacity-0 max-w-0 ml-0'
                    }`}
                  >
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* User info */}
          <div className={`p-4 border-t border-slate-200 transition-all duration-300 ease-in-out ${isExpanded ? 'px-4' : 'px-2'}`}>
            <div className={`flex items-center transition-all duration-300 ease-in-out ${isExpanded ? 'gap-3' : 'justify-center'}`}>
              <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-slate-600">GL</span>
              </div>
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  isExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'
                }`}
              >
                <div className="text-sm font-medium text-slate-900 whitespace-nowrap">Giacomo Cavalcabo</div>
                <div className="text-xs text-slate-500 whitespace-nowrap">Admin • Lenzi</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div
        className={`transition-all duration-300 ease-in-out ${isExpanded ? 'pl-64' : 'pl-16'}`}
        style={{ willChange: 'padding-left' }}
      >
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
