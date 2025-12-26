import { useState } from 'react';
import { X, Mail, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authAPI } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';

interface EmailVerificationBannerProps {
  userEmail: string;
  onVerified?: () => void;
}

export default function EmailVerificationBanner({ userEmail, onVerified }: EmailVerificationBannerProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const queryClient = useQueryClient();

  if (dismissed) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code || code.length !== 6) {
      setError('Inserisci un codice di 6 cifre');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      await authAPI.verifyEmail(code);

      setSuccess('✅ Email verificata con successo!');
      setCode('');

      // Invalida le query per ricaricare i dati utente
      await queryClient.invalidateQueries();

      // Chiudi il banner dopo 2 secondi
      setTimeout(() => {
        if (onVerified) onVerified();
      }, 2000);

    } catch (err: any) {
      setError(err?.message || 'Codice non valido o scaduto');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      setResendLoading(true);
      setError('');
      setSuccess('');

      await authAPI.resendVerification();

      setSuccess('📧 Nuovo codice inviato! Controlla la tua email.');
      setCode('');

    } catch (err: any) {
      setError(err?.message || 'Errore durante il reinvio del codice');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 relative">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-amber-600 hover:text-amber-800"
        aria-label="Chiudi"
      >
        <X size={20} />
      </button>

      <div className="flex items-start gap-3">
        <Mail className="text-amber-600 mt-1 flex-shrink-0" size={24} />

        <div className="flex-1">
          <h3 className="font-semibold text-amber-900 mb-1">
            Verifica la tua email
          </h3>

          <p className="text-sm text-amber-800 mb-4">
            Abbiamo inviato un codice di 6 cifre a <strong>{userEmail}</strong>.
            Inseriscilo qui sotto per verificare il tuo account.
          </p>

          <form onSubmit={handleVerify} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setCode(value);
                  setError('');
                }}
                placeholder="123456"
                maxLength={6}
                className="flex-1 px-4 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-center text-lg tracking-widest font-mono"
                disabled={loading || resendLoading}
              />

              <Button
                type="submit"
                disabled={loading || code.length !== 6}
                className="bg-amber-600 hover:bg-amber-700 text-white px-6"
              >
                {loading ? 'Verifica...' : 'Verifica'}
              </Button>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-3 py-2 rounded">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded">
                <CheckCircle size={16} />
                {success}
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-amber-700">
                Non hai ricevuto il codice?
              </span>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendLoading || loading}
                className="text-amber-600 hover:text-amber-800 font-medium underline"
              >
                {resendLoading ? 'Invio...' : 'Reinvia codice'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
