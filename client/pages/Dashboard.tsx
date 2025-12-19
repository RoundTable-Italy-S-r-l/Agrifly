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
          // Tutti gli utenti autenticati vanno direttamente alla gestione catalogo
          navigate('/admin/catalogo');
        }
  }, [navigate]);

  return null; // Redirect in corso
}

