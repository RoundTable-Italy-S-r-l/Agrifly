import { Resend } from 'resend';

// Inizializza Resend solo se la chiave API è presente
const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';

// Invia codice verifica email
export async function sendVerificationCodeEmail(
  to: string,
  code: string,
  expiresMinutes: number = 10
): Promise<void> {
  if (!resend) {
    console.warn('⚠️  Resend API key not configured. Email not sent. Code:', code);
    return;
  }
  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Agrifly <noreply@agrifly.it>';
    await resend.emails.send({
      from: fromEmail,
      to,
      subject: 'Codice di verifica email - Agrifly',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Verifica la tua email</h2>
          <p>Il tuo codice di verifica è:</p>
          <div style="background: #f0f0f0; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
            ${code}
          </div>
          <p>Questo codice è valido per ${expiresMinutes} minuti.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error('Error sending verification email:', error);
    // Non bloccare il flusso se l'email fallisce
  }
}

// Email di benvenuto
export async function sendWelcomeEmail(
  to: string,
  userName: string,
  loginUrl: string
): Promise<void> {
  if (!resend) {
    console.warn('⚠️  Resend API key not configured. Welcome email not sent.');
    return;
  }
  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Agrifly <noreply@agrifly.it>';
    await resend.emails.send({
      from: fromEmail,
      to,
      subject: 'Benvenuto in Agrifly',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Benvenuto, ${userName}!</h2>
          <p>Il tuo account è stato creato con successo.</p>
          <p><a href="${loginUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">Accedi ora</a></p>
        </div>
      `,
    });
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
}

// Email reset password
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<{ sent: boolean; resetUrl?: string; error?: string }> {
  try {
    if (!resend) {
      console.warn('⚠️  Resend API key not configured. Password reset email not sent.');
      console.warn('📧 RESET PASSWORD LINK (DEV MODE):', resetUrl);
      // In sviluppo, restituiamo il link nella risposta
      return { sent: false, resetUrl };
    }
    
    console.log('📧 Tentativo invio email reset password a:', to);
    
    // Usa il dominio verificato agrifly.it
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Agrifly <noreply@agrifly.it>';
    
    const result = await resend.emails.send({
      from: fromEmail,
      to,
      subject: 'Reset password - Agrifly',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Reset password</h2>
          <p>Hai richiesto il reset della password per il tuo account Agrifly. Clicca sul link qui sotto:</p>
          <p><a href="${resetUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">Reset password</a></p>
          <p>Il link è valido per 24 ore.</p>
          <p>Se non hai richiesto questo reset, ignora questa email.</p>
        </div>
      `,
    });
    
    // Controlla se c'è un errore nella risposta
    if (result.error) {
      console.error('❌ Errore Resend:', result.error);
      // Se il dominio non è verificato, restituiamo il link per mostrarlo all'utente
      const errorObj = result.error as any;
      if (errorObj.statusCode === 403 && errorObj.message?.includes('domain is not verified')) {
        console.warn('⚠️  Dominio non verificato su Resend - restituisco link nella risposta');
        return { sent: false, resetUrl, error: 'Dominio email non verificato' };
      }
      return { sent: false, resetUrl, error: errorObj.message || 'Errore invio email' };
    }
    
    console.log('✅ Password reset email sent to:', to);
    return { sent: true };
  } catch (error: any) {
    console.error('❌ Error sending password reset email:', error);
    console.error('Error details:', error.message, error.stack);
    // Restituiamo comunque il link in caso di errore
    return { sent: false, resetUrl, error: error.message || 'Errore invio email' };
  }
}

// Email invito organization
export async function sendOrganizationInvitationEmail(
  to: string,
  invitedBy: string,
  organizationName: string,
  inviteUrl: string
): Promise<void> {
  if (!resend) {
    console.warn('⚠️  Resend API key not configured. Invitation email not sent.');
    return;
  }
  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Agrifly <noreply@agrifly.it>';
    await resend.emails.send({
      from: fromEmail,
      to,
      subject: `Invito a ${organizationName} - Agrifly`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Sei stato invitato</h2>
          <p><strong>${invitedBy}</strong> ti ha invitato a unirti a <strong>${organizationName}</strong>.</p>
          <p><a href="${inviteUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">Accetta invito</a></p>
        </div>
      `,
    });
  } catch (error) {
    console.error('Error sending invitation email:', error);
  }
}

