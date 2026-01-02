import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Calendar, Users, Settings, BarChart3, Package, Truck, CreditCard, Pin, PinOff, ClipboardList, Lock, LogOut, Globe } from 'lucide-react';
import { authAPI } from '@/lib/auth';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  // NUOVA LOGICA: usa permessi calcolati dinamicamente dal ruolo utente
  const [userPermissions, setUserPermissions] = useState<{
    can_access_catalog: boolean;
    can_access_orders: boolean;
    can_access_services: boolean;
    can_access_bookings: boolean;
    can_complete_missions: boolean;
  } | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [userInitials, setUserInitials] = useState<string>('');
  const [orgName, setOrgName] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');

  const isExpanded = isPinned || isHovered;

  const handleLogout = () => {
    authAPI.logout();
    localStorage.removeItem('selected_role');
    navigate('/login');
  };

  useEffect(() => {
    const loadUserAndOrgData = () => {
      // Carica dati organizzazione e utente
      const orgData = localStorage.getItem('organization');
      const userData = localStorage.getItem('user');
      
      if (orgData && userData) {
        try {
          const org = JSON.parse(orgData);
          const user = JSON.parse(userData);

          // NUOVA LOGICA: calcola permessi dinamicamente dal ruolo utente
          const role = user.role || org.role || 'admin'; // Default admin se non specificato
          const orgType = org.type || org.org_type || 'buyer';

          // Calcola permessi basati sul ruolo (stessa logica del backend)
          const permissions = {
            can_access_catalog: false,
            can_access_orders: false,
            can_access_services: false,
            can_access_bookings: false,
            can_complete_missions: false
          };

          if (role === 'admin' || role === 'dispatcher') {
            permissions.can_access_catalog = true;
            permissions.can_access_orders = true;
            permissions.can_access_services = true;
            permissions.can_access_bookings = true;
            permissions.can_complete_missions = true;
          } else if (role === 'vendor') {
            permissions.can_access_catalog = true;
            permissions.can_access_orders = true;
          } else if (role === 'operator') {
            permissions.can_access_services = true;
            permissions.can_access_bookings = true;
            permissions.can_complete_missions = true;
          }

          setUserPermissions(permissions);
          setOrgName(org.name || org.legal_name || '');
          setUserRole(role);

          // Gestisci nome utente
          const firstName = user.first_name || user.firstName || '';
          const lastName = user.last_name || user.lastName || '';
          const fullName = `${firstName} ${lastName}`.trim() || user.email || 'Utente';
          setUserName(fullName);
          
          // Genera iniziali
          if (firstName && lastName) {
            setUserInitials(`${firstName[0]}${lastName[0]}`.toUpperCase());
          } else if (fullName) {
            const parts = fullName.split(' ');
            if (parts.length >= 2) {
              setUserInitials(`${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase());
            } else {
              setUserInitials(fullName.substring(0, 2).toUpperCase());
            }
          } else {
            setUserInitials('U');
          }

        } catch (error) {
          console.error('Errore nel parsing dei dati:', error);
        }
      } else {
        // Se non ci sono dati, riprova dopo un breve delay
        setTimeout(loadUserAndOrgData, 500);
        return;
      }
    };

    loadUserAndOrgData();

    // Ascolta i cambiamenti al localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'organization' || e.key === 'user' || e.key === 'auth_token') {
        loadUserAndOrgData();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const navigation = [
    {
      name: 'Dashboard',
      href: '/admin',
      icon: LayoutDashboard,
      allowed: () => true // Sempre accessibile
    },
    {
      name: 'Configurazione Servizi',
      href: '/admin/servizi',
      icon: Calendar,
      allowed: () => userPermissions?.can_access_services || userPermissions?.can_complete_missions // Accessibile per operator/dispatcher
    },
    {
      name: 'Missioni',
      href: '/admin/prenotazioni',
      icon: ClipboardList,
      allowed: () => userPermissions?.can_access_bookings || userPermissions?.can_complete_missions // Accessibile per operator/dispatcher
    },
    {
      name: 'Catalogo',
      href: '/admin/catalogo',
      icon: Package,
      allowed: () => userPermissions?.can_access_catalog // Accessibile per vendor/admin/dispatcher
    },
    {
      name: 'Ordini',
      href: '/admin/ordini',
      icon: ShoppingBag,
      allowed: () => userPermissions?.can_access_orders // Accessibile per vendor/admin/dispatcher
    },
    {
      name: 'Impostazioni',
      href: '/admin/impostazioni',
      icon: Settings,
      allowed: () => true // Sempre accessibile
    },
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
              const isAllowed = userPermissions ? item.allowed() : true; // Mostra tutto se permissions non ancora calcolate

              if (isAllowed) {
                // Link accessibile
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
              } else {
                // Link non accessibile - mostra con lucchetto
                return (
                  <div
                    key={item.name}
                    className={`flex items-center rounded-lg text-sm font-medium transition-all duration-300 ease-in-out cursor-not-allowed ${
                      isExpanded ? 'gap-3 px-3 py-2' : 'justify-center px-2 py-2'
                    } text-slate-400 bg-slate-50`}
                    title={!isExpanded ? `${item.name} (Accesso negato)` : `Accesso negato - ${item.name}`}
                    onClick={(e) => {
                      e.preventDefault();
                      // Potremmo mostrare un toast qui se vogliamo
                      console.log(`Accesso negato a ${item.name}`);
                    }}
                  >
                    <div className="relative flex-shrink-0">
                      <item.icon className="w-5 h-5 opacity-50" />
                      <Lock className="w-3 h-3 absolute -top-1 -right-1 bg-slate-400 text-white rounded-full p-0.5" />
                    </div>
                    <span
                      className={`overflow-hidden transition-all duration-300 ease-in-out whitespace-nowrap ${
                        isExpanded ? 'opacity-100 max-w-[180px] ml-0' : 'opacity-0 max-w-0 ml-0'
                      }`}
                    >
                      {item.name}
                    </span>
                  </div>
                );
              }
            })}
          </nav>

          {/* User info */}
          <div className={`p-4 border-t border-slate-200 transition-all duration-300 ease-in-out ${isExpanded ? 'px-4' : 'px-2'}`}>
            <Link
              to="/"
              className={`w-full flex items-center gap-2 px-3 py-2 mb-3 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors ${
                isExpanded ? 'justify-start' : 'justify-center'
              }`}
              title={!isExpanded ? 'Vai al sito' : undefined}
            >
              <Globe className="w-4 h-4 flex-shrink-0" />
              {isExpanded && <span>Vai al sito</span>}
            </Link>
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-2 px-3 py-2 mb-3 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors ${
                isExpanded ? 'justify-start' : 'justify-center'
              }`}
              title={!isExpanded ? 'Esci' : undefined}
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              {isExpanded && <span>Esci</span>}
            </button>
            <div className={`flex items-center transition-all duration-300 ease-in-out ${isExpanded ? 'gap-3' : 'justify-center'}`}>
              <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-slate-600">{userInitials || 'U'}</span>
              </div>
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  isExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'
                }`}
              >
                <div className="text-sm font-medium text-slate-900 whitespace-nowrap truncate">{userName || 'Utente'}</div>
                <div className="text-xs text-slate-500 whitespace-nowrap truncate">
                  {userRole ? `${userRole}${orgName ? ' • ' : ''}` : ''}{orgName || ''}
                </div>
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
