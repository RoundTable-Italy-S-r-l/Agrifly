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
              // NUOVA LOGICA: determina dashboard dal tipo organizzazione
              // buyer → /buyer, vendor/operator → /admin
              const orgType = org.type || org.org_type;
              if (orgType === 'buyer') {
                navigate('/buyer');
              } else if (orgType === 'vendor' || orgType === 'operator') {
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

