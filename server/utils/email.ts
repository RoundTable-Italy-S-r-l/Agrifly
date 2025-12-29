import { Resend } from 'resend';

// Inizializza Resend solo se la chiave API è presente
const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8082';

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
    // Usa il dominio verificato agoralia.app come fallback se agrifly.it non è verificato
    let fromEmail = process.env.RESEND_FROM_EMAIL || 'Agoralia <no-reply@agoralia.app>';
    
    // Se RESEND_FROM_EMAIL contiene agrifly.it, verifica se funziona, altrimenti usa fallback
    if (fromEmail.includes('agrifly.it')) {
      console.warn('⚠️  Tentativo con dominio agrifly.it...');
      // Se fallisce, useremo il fallback
    }
    
    console.log('📧 Invio email verifica:', { to, from: fromEmail, code });
    
    const result = await resend.emails.send({
      from: fromEmail,
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
    
    if (result.error) {
      console.error('❌ Errore Resend API:', result.error);
      
      // Se il dominio non è verificato, prova con il dominio verificato come fallback
      if (result.error.statusCode === 403 && result.error.message?.includes('domain is not verified')) {
        console.warn('⚠️  Dominio non verificato, provo con dominio verificato agoralia.app...');
        const fallbackFrom = 'Agoralia <no-reply@agoralia.app>';
        
        const fallbackResult = await resend.emails.send({
          from: fallbackFrom,
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
        
        if (fallbackResult.error) {
          console.error('❌ Errore anche con fallback:', fallbackResult.error);
          throw new Error(`Impossibile inviare email: ${fallbackResult.error.message}`);
        } else {
          console.log('✅ Email inviata con successo usando dominio verificato!');
        }
      } else {
        throw new Error(`Errore invio email: ${result.error.message}`);
      }
    } else {
      console.log('✅ Email inviata con successo!');
      console.log('✅ Resend result:', JSON.stringify(result, null, 2));
    }
  } catch (error: any) {
    console.error('❌ Error sending verification email:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    // Non bloccare il flusso se l'email fallisce, ma logghiamo l'errore
    throw error; // Rilanciamo per far vedere l'errore ai log del server
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
      if (result.error.statusCode === 403 && result.error.message?.includes('domain is not verified')) {
        console.warn('⚠️  Dominio non verificato su Resend - restituisco link nella risposta');
        return { sent: false, resetUrl, error: 'Dominio email non verificato' };
      }
      return { sent: false, resetUrl, error: result.error.message || 'Errore invio email' };
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

