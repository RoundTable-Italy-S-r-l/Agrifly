import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { authAPI } from '@/lib/auth';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { addToWishlist, migrateCart } from '@/lib/api';
import { Mail, ArrowLeft, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Verifica che l'utente sia autenticato (deve avere token)
    const token = localStorage.getItem('auth_token');
    if (!token) {
      navigate('/login');
      return;
    }
  }, [navigate]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code || code.length !== 6) {
      setError('Inserisci un codice a 6 cifre');
      return;
    }

    try {
      setLoading(true);
      setError('');

      await authAPI.verifyEmail(code);
      
      setSuccess(true);
      toast.success('Email verificata con successo!');

      // Attendi 2 secondi prima del redirect
      setTimeout(async () => {
        // Controlla se c'è un redirect salvato
        const postLoginRedirect = localStorage.getItem('post_login_redirect');
        const wishlistAction = localStorage.getItem('wishlist_action');
        const wishlistProductId = localStorage.getItem('wishlist_product_id');
        
        // Migra carrello guest se esiste (potrebbe non essere stato migrato durante la registrazione)
        const sessionId = localStorage.getItem('session_id');
        const orgData = localStorage.getItem('organization');
        const userData = localStorage.getItem('user');
        
        if (sessionId && orgData && userData) {
          try {
            const org = JSON.parse(orgData);
            const user = JSON.parse(userData);
            if (org.id && user.id) {
              console.log('🛒 Migrazione carrello guest dopo verifica email...', { sessionId, userId: user.id, orgId: org.id });
              const migrateResult = await migrateCart(sessionId, user.id, org.id);
              console.log('📦 Risultato migrazione:', migrateResult);
              localStorage.removeItem('session_id');
              localStorage.removeItem('guest_org_id');
              console.log('✅ Carrello migrato con successo dopo verifica email');
              // Invalida specificamente le query del carrello
              await queryClient.invalidateQueries({ queryKey: ['cart'] });
            }
          } catch (err) {
            console.error('⚠️ Errore migrazione carrello dopo verifica email (non critico):', err);
            // Non bloccare il flusso se la migrazione fallisce
          }
        }
        
        // Se c'è un'azione wishlist, aggiungi il prodotto ai preferiti
        if (wishlistAction === 'true' && wishlistProductId) {
          try {
            if (orgData) {
              const org = JSON.parse(orgData);
              await addToWishlist(org.id, wishlistProductId);
              console.log('✅ Prodotto aggiunto automaticamente ai preferiti dopo verifica email');
            }
          } catch (error) {
            console.error('⚠️ Errore aggiunta automatica ai preferiti:', error);
            // Non bloccare il flusso se fallisce
          }
          localStorage.removeItem('wishlist_action');
          localStorage.removeItem('wishlist_product_id');
        }
        
        // Invalida tutte le query per assicurarsi che i dati siano aggiornati
        await queryClient.invalidateQueries();
        
        // Gestisci redirect al carrello (sia 'carrello' che '/buyer/carrello')
        if ((postLoginRedirect === 'carrello' || postLoginRedirect === '/buyer/carrello' || postLoginRedirect?.includes('carrello')) && orgData) {
          try {
            const org = JSON.parse(orgData);
            if (org.can_buy) {
              localStorage.removeItem('post_login_redirect');
              console.log(`🛒 Redirect a /buyer/carrello dopo verifica email`);
              navigate('/buyer/carrello', { replace: true });
              return;
            }
          } catch (error) {
            console.error('Errore parsing org data:', error);
          }
        }
        
        // Gestisci redirect a nuovo-preventivo
        if (postLoginRedirect === 'nuovo-preventivo' && orgData) {
          try {
            const org = JSON.parse(orgData);
            if (org.can_buy) {
              localStorage.removeItem('post_login_redirect');
              console.log(`🚀 Redirect a /buyer/nuovo-preventivo dopo verifica email`);
              navigate('/buyer/nuovo-preventivo', { replace: true });
              return;
            }
          } catch (error) {
            console.error('Errore parsing org data:', error);
          }
        }
        
        // Gestisci altri redirect diretti (percorsi completi)
        if (postLoginRedirect && postLoginRedirect.startsWith('/')) {
          localStorage.removeItem('post_login_redirect');
          console.log(`🔄 Redirect a percorso specifico dopo verifica email: ${postLoginRedirect}`);
          navigate(postLoginRedirect, { replace: true });
          return;
        }
        
        localStorage.removeItem('post_login_redirect');
        
        // Determina dashboard in base alle capabilities dell'organizzazione
        if (orgData) {
          try {
            const org = JSON.parse(orgData);
            // NUOVA LOGICA: usa solo il tipo organizzazione
            const orgType = org.type || org.org_type;
            if (orgType === 'buyer') {
              // Buyer → dashboard buyer
              navigate('/buyer', { replace: true });
            } else if (orgType === 'vendor' || orgType === 'operator') {
              // Vendor/Operator → dashboard admin
              navigate('/admin', { replace: true });
            } else {
              // Fallback alla dashboard generica
              navigate('/dashboard', { replace: true });
            }
          } catch (error) {
            console.error('Errore parsing org data:', error);
            navigate('/dashboard', { replace: true });
          }
        } else {
          navigate('/dashboard', { replace: true });
        }
      }, 2000);

    } catch (err: any) {
      console.error('Errore verifica email:', err);
      setError(err?.message || 'Codice non valido. Controlla di aver inserito il codice corretto.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      setResending(true);
      setError('');

      await authAPI.resendVerification();
      toast.success('Codice reinviato! Controlla la tua email.');
    } catch (err: any) {
      console.error('Errore reinvio codice:', err);
      setError(err?.message || 'Errore nel reinvio del codice');
    } finally {
      setResending(false);
    }
  };

  if (success) {
    return (
      <Layout>
        <div className="max-w-md mx-auto mt-12">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-8 text-center">
            <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-emerald-900 mb-2">Email verificata!</h1>
            <p className="text-emerald-700">Stai per essere reindirizzato...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto mt-12">
        <div className="mb-6">
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Torna al login
          </button>
          <div className="flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4 mx-auto">
            <Mail className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 text-center mb-2">
            Verifica la tua email
          </h1>
          <p className="text-slate-600 text-center">
            Inserisci il codice a 6 cifre che abbiamo inviato alla tua email
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Errore</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Codice di verifica
            </label>
            <Input
              type="text"
              value={code}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(value);
                setError('');
              }}
              placeholder="000000"
              maxLength={6}
              className="text-center text-2xl tracking-widest font-mono"
              required
              disabled={loading}
            />
            <p className="text-xs text-slate-500 mt-2 text-center">
              Inserisci il codice a 6 cifre ricevuto via email
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || code.length !== 6}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifica in corso...
              </>
            ) : (
              'Verifica email'
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600 mb-2">
            Non hai ricevuto il codice?
          </p>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-50"
          >
            {resending ? (
              <>
                <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                Invio in corso...
              </>
            ) : (
              'Reinvia codice'
            )}
          </button>
        </div>
      </div>
    </Layout>
  );
}

