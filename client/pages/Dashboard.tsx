import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardPath } from '@/lib/auth-redirect';

export default function Dashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    // Verifica se l'utente è autenticato
    const token = localStorage.getItem('auth_token');
    if (!token) {
      navigate('/login');
      return;
    }

    // Controlla il tipo di utente dall'organizzazione
    const orgData = localStorage.getItem('organization');
    if (!orgData) {
      navigate('/login');
      return;
    }

    try {
      const org = JSON.parse(orgData);
      const dashboardPath = getDashboardPath(org);
      navigate(dashboardPath, { replace: true });
    } catch (error) {
      console.error('Errore nel parsing dati organizzazione:', error);
      navigate('/login');
    }
  }, [navigate]);

  return null; // Redirect in corso
}

