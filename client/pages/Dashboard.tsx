import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    // Verifica se l'utente è autenticato
        const token = localStorage.getItem('auth_token');
        if (!token) {
          navigate('/login');
        } else {
          // Controlla il tipo di utente dall'organizzazione
          const orgData = localStorage.getItem('organization');
          if (orgData) {
            try {
              const org = JSON.parse(orgData);
              // Determina dashboard basandosi sulle capabilities
              // Se è buyer (can_buy=true e non ha altre capabilities) → dashboard buyer
              // Se ha can_sell, can_operate, o can_dispatch → dashboard admin
              if (org.can_buy && !org.can_sell && !org.can_operate && !org.can_dispatch) {
                navigate('/buyer');
              } else if (org.can_sell || org.can_operate || org.can_dispatch) {
                // Altrimenti vai alla dashboard admin
                navigate('/admin');
              } else {
                // Fallback: usa isAdmin se presente, altrimenti buyer
                navigate(org.isAdmin ? '/admin' : '/buyer');
              }
            } catch (error) {
              console.error('Errore nel parsing dati organizzazione:', error);
              navigate('/login');
            }
          } else {
            navigate('/login');
          }
        }
  }, [navigate]);

  return null; // Redirect in corso
}

