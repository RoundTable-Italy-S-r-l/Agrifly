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
    await resend.emails.send({
      from: 'DJI Agriculture <noreply@dji-agriculture.com>',
      to,
      subject: 'Codice di verifica email',
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
    await resend.emails.send({
      from: 'DJI Agriculture <noreply@dji-agriculture.com>',
      to,
      subject: 'Benvenuto in DJI Agriculture',
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
  if (!resend) {
    console.warn('⚠️  Resend API key not configured. Password reset email not sent.');
    console.warn('📧 RESET PASSWORD LINK (DEV MODE):', resetUrl);
    // In sviluppo, restituiamo il link nella risposta
    return { sent: false, resetUrl };
  }
  try {
    const result = await resend.emails.send({
      from: 'DJI Agriculture <noreply@dji-agriculture.com>',
      to,
      subject: 'Reset password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Reset password</h2>
          <p>Hai richiesto il reset della password. Clicca sul link qui sotto:</p>
          <p><a href="${resetUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">Reset password</a></p>
          <p>Il link è valido per 24 ore.</p>
        </div>
      `,
    });
    console.log('✅ Password reset email sent to:', to);
    return { sent: true };
  } catch (error: any) {
    console.error('❌ Error sending password reset email:', error);
    return { sent: false, error: error.message || 'Errore invio email' };
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
    await resend.emails.send({
      from: 'DJI Agriculture <noreply@dji-agriculture.com>',
      to,
      subject: `Invito a ${organizationName}`,
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

