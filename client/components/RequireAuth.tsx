import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

type Props = {
  children: React.ReactNode;
};

// Funzione per verificare se il JWT è valido (sincrona, basata su localStorage)
function isAuthenticated(): boolean {
  const token = localStorage.getItem("auth_token");
  const organization = localStorage.getItem("organization");

  if (!token || !organization) {
    console.log('🔐 Auth check: token o organization mancanti');
    return false;
  }

  try {
    // Il nostro JWT custom ha formato {body}.{signature} (senza header)
    const parts = token.split('.');
    if (parts.length !== 2) {
      console.log('🔐 Auth check: formato token invalido (parts:', parts.length, ')');
      return false;
    }

    // Decodifica il body (base64url) - funzione compatibile browser
    const body = parts[0];
    // Converti base64url a base64 standard
    const base64 = body.replace(/-/g, '+').replace(/_/g, '/');
    // Padding
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    // Decodifica
    const decoded = atob(padded);
    const payload = JSON.parse(decoded);
    const now = Math.floor(Date.now() / 1000);

    const isValid = payload.exp > now;
    console.log('🔐 Auth check:', isValid ? '✅ valido' : '❌ scaduto', 'exp:', payload.exp, 'now:', now);
    
    return isValid;
  } catch (error: any) {
    console.log('🔐 Auth check: errore parsing token:', error.message);
    return false;
  }
}

export default function RequireAuth({ children }: Props) {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    // Verifica autenticazione dal localStorage
    const authenticated = isAuthenticated();
    setIsAuthed(authenticated);
    setLoading(false);

    // Opzionale: verifica con API /me per refresh token
    if (authenticated) {
      fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })
      .then(response => {
        if (!response.ok) {
          // Token invalido, logout
          localStorage.removeItem('auth_token');
          localStorage.removeItem('organization');
          setIsAuthed(false);
        }
      })
      .catch(() => {
        // Errore network, mantieni autenticazione locale
      });
    }
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-slate-600">
        Caricamento...
      </div>
    );
  }

  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
