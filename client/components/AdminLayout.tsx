import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Calendar, Users, Settings, BarChart3, Package, Truck, CreditCard } from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Catalogo', href: '/admin/catalogo', icon: Package },
    { name: 'Ordini', href: '/admin/ordini', icon: ShoppingBag },
    { name: 'Servizi', href: '/admin/servizi', icon: Calendar },
    { name: 'Operatori', href: '/admin/operatori', icon: Users },
    { name: 'Missioni', href: '/admin/missioni', icon: Truck },
    { name: 'Finanze', href: '/admin/finanze', icon: CreditCard },
    { name: 'Impostazioni', href: '/admin/impostazioni', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg border-r border-slate-200">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <Link to="/admin" className="flex items-center gap-3 p-6 border-b border-slate-200">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">DJI Agriculture</div>
              <div className="text-xs text-slate-500">Admin Panel</div>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 border-r-2 border-emerald-600'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center">
                <span className="text-xs font-medium text-slate-600">GL</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">Giacomo Cavalcabo</div>
                <div className="text-xs text-slate-500 truncate">Admin • Lenzi</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
