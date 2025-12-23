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
    return false;
  }

  try {
    // Parsing semplice del JWT per verificare scadenza
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);

    return payload.exp > now;
  } catch (error) {
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
