import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';

export default function AuthCallback() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      // Salva token (il backend ha già fornito user e organization nel redirect)
      localStorage.setItem('auth_token', token);
      
      // Prova a recuperare user e organization dal localStorage se disponibili
      // (il backend potrebbe averli passati come query params o li recuperiamo con una chiamata)
      
      queryClient.invalidateQueries();
      navigate('/dashboard');
    } else {
      // Nessun token, redirect a login
      navigate('/login?error=oauth_failed');
    }
  }, [token, navigate, queryClient]);

  return (
    <Layout>
      <div className="max-w-md mx-auto mt-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
        <p className="text-slate-600">Accesso in corso...</p>
      </div>
    </Layout>
  );
}

