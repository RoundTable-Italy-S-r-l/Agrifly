import { Router } from 'express';
import { UserStatus, VerificationPurpose, OrgRole } from '../../generated/prisma';
import { hashPassword, verifyPassword, generateJWT, generateResetToken, generateVerificationCode, rateLimiter, sendEmail } from '../utils/auth';
import { prisma } from '../utils/prisma';

const router = Router();

// ============================================================================
// MIDDLEWARE AUTENTICAZIONE JWT CUSTOM
// ============================================================================

/**
 * Middleware per verificare JWT custom
 */
export function requireAuth(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token mancante' });
    }

    const token = authHeader.substring(7);
    const payload = require('../utils/auth').verifyJWT(token);

    if (!payload) {
      return res.status(401).json({ error: 'Token invalido' });
    }

    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Errore autenticazione' });
  }
}

/**
 * Middleware per verificare admin
 */
export function requireAdmin(req: any, res: any, next: any) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Accesso admin richiesto' });
  }
  next();
}

// ============================================================================
// REGISTRAZIONE
// ============================================================================

/**
 * POST /auth/register
 * Registrazione utente con verifica email
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, organizationName } = req.body;

    // Validazione input
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
    }

    // Rate limiting per email
    const rateLimit = rateLimiter.check(`register_${email}`, 3, 60 * 60 * 1000); // 3 tentativi/ora
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Troppe richieste di registrazione',
        retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
      });
    }

    // Verifica email unica
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email già registrata' });
    }

    // Hash password con PBKDF2 + salt
    const { salt, hash } = hashPassword(password);

    // Crea organizzazione (tenant_id = user.id per primo utente)
    const org = await prisma.organization.create({
      data: {
        legal_name: organizationName || `${firstName} ${lastName}`,
        org_type: 'FARM',
        address_line: '',
        city: '',
        province: '',
        region: '',
        status: 'ACTIVE'
      }
    });

    // Crea utente
    const user = await prisma.user.create({
      data: {
        email,
        first_name: firstName,
        last_name: lastName,
        password_salt: salt,
        password_hash: hash,
        email_verified: false,
        status: 'ACTIVE'
      }
    });

    // Crea membership admin
    await prisma.orgMembership.create({
      data: {
        org_id: org.id,
        user_id: user.id,
        role: 'BUYER_ADMIN',
        is_active: true
      }
    });

    // Genera codice verifica email (6 cifre, 10 minuti)
    const verificationCode = generateVerificationCode();
    await prisma.verificationCode.create({
      data: {
        user_id: user.id,
        email,
        code: verificationCode,
        purpose: 'EMAIL_VERIFICATION',
        expires_at: new Date(Date.now() + 10 * 60 * 1000) // 10 minuti
      }
    });

    // Invia email verifica (placeholder)
    const emailHtml = `
      <h2>Benvenuto su DJI Agras!</h2>
      <p>Codice di verifica: <strong>${verificationCode}</strong></p>
      <p>Il codice scade tra 10 minuti.</p>
    `;
    await sendEmail(email, 'Verifica il tuo account DJI Agras', emailHtml);

    // Genera JWT temporaneo (non ancora verificato)
    const token = generateJWT({
      userId: user.id,
      orgId: org.id,
      role: 'BUYER_ADMIN',
      isAdmin: true,
      emailVerified: false
    });

    res.status(201).json({
      message: 'Registrazione completata. Controlla la tua email per il codice di verifica.',
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        email_verified: false
      },
      organization: {
        id: org.id,
        name: org.legal_name,
        role: 'BUYER_ADMIN',
        isAdmin: true
      }
    });

  } catch (error: any) {
    console.error('Errore registrazione:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ============================================================================
// LOGIN
// ============================================================================

/**
 * POST /auth/login
 * Login con email/password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e password obbligatorie' });
    }

    // Rate limiting per IP/email
    const rateLimit = rateLimiter.check(`login_${req.ip}_${email}`, 5, 15 * 60 * 1000); // 5 tentativi/15min
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Troppe richieste di login',
        retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
      });
    }

    // Trova utente
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        org_memberships: {
          where: { is_active: true },
          include: { org: true }
        }
      }
    });

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'Credenziali invalide' });
    }

    // Verifica password
    if (!user.password_hash || !user.password_salt) {
      return res.status(401).json({ error: 'Account non configurato per login tradizionale' });
    }

    if (!verifyPassword(password, user.password_hash, user.password_salt)) {
      return res.status(401).json({ error: 'Credenziali invalide' });
    }

    // Trova membership attiva
    const membership = user.org_memberships[0];
    if (!membership) {
      return res.status(400).json({ error: 'Nessuna organizzazione attiva' });
    }

    const isAdmin = membership.role === 'BUYER_ADMIN' || membership.role === 'VENDOR_ADMIN';

    // Genera JWT
    const token = generateJWT({
      userId: user.id,
      orgId: membership.org_id,
      role: membership.role,
      isAdmin,
      emailVerified: user.email_verified
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        email_verified: user.email_verified
      },
      organization: {
        id: membership.org_id,
        name: membership.org.legal_name,
        role: membership.role,
        isAdmin
      }
    });

  } catch (error: any) {
    console.error('Errore login:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ============================================================================
// VERIFICA EMAIL
// ============================================================================

/**
 * POST /auth/verify-email
 * Verifica email con codice 6 cifre
 */
router.post('/verify-email', requireAuth, async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.userId;

    if (!code || code.length !== 6) {
      return res.status(400).json({ error: 'Codice di verifica non valido' });
    }

    // Trova codice valido
    const verification = await prisma.verificationCode.findFirst({
      where: {
        user_id: userId,
        code,
        purpose: 'EMAIL_VERIFICATION',
        used: false,
        expires_at: { gt: new Date() }
      }
    });

    if (!verification) {
      return res.status(400).json({ error: 'Codice invalido o scaduto' });
    }

    // Marca come usato
    await prisma.verificationCode.update({
      where: { id: verification.id },
      data: {
        used: true,
        used_at: new Date()
      }
    });

    // Aggiorna utente
    await prisma.user.update({
      where: { id: userId },
      data: {
        email_verified: true,
        email_verified_at: new Date()
      }
    });

    res.json({ message: 'Email verificata con successo' });

  } catch (error: any) {
    console.error('Errore verifica email:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

/**
 * POST /auth/resend-verification
 * Reinvia codice verifica email
 */
router.post('/resend-verification', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Rate limiting
    const rateLimit = rateLimiter.check(`resend_${userId}`, 3, 60 * 60 * 1000); // 3 invii/ora
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Troppe richieste',
        retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
      });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: 'Email già verificata' });
    }

    // Genera nuovo codice
    const verificationCode = generateVerificationCode();
    await prisma.verificationCode.create({
      data: {
        user_id: userId,
        email: user.email,
        code: verificationCode,
        purpose: 'EMAIL_VERIFICATION',
        expires_at: new Date(Date.now() + 10 * 60 * 1000)
      }
    });

    // Invia email
    const emailHtml = `
      <h2>Codice di verifica DJI Agras</h2>
      <p>Nuovo codice: <strong>${verificationCode}</strong></p>
      <p>Scade tra 10 minuti.</p>
    `;
    await sendEmail(user.email, 'Nuovo codice verifica DJI Agras', emailHtml);

    res.json({ message: 'Codice inviato via email' });

  } catch (error: any) {
    console.error('Errore reinvio verifica:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ============================================================================
// RESET PASSWORD
// ============================================================================

/**
 * POST /auth/request-password-reset
 * Richiesta reset password
 */
router.post('/request-password-reset', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email obbligatoria' });
    }

    // Rate limiting
    const rateLimit = rateLimiter.check(`reset_${email}`, 3, 60 * 60 * 1000); // 3 richieste/ora
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Troppe richieste',
        retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Non rivelare se email esiste per sicurezza
      return res.json({ message: 'Se l\'email è registrata, riceverai le istruzioni via email' });
    }

    // Genera token reset (32 caratteri URL-safe)
    const resetToken = generateResetToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 ore

    await prisma.user.update({
      where: { id: user.id },
      data: {
        reset_token: resetToken,
        reset_token_expires: expiresAt
      }
    });

    // Invia email con link
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/reset-password?token=${resetToken}`;
    const emailHtml = `
      <h2>Reset Password DJI Agras</h2>
      <p>Clicca il link per reimpostare la password:</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>Il link scade tra 24 ore.</p>
    `;
    await sendEmail(email, 'Reset Password DJI Agras', emailHtml);

    res.json({ message: 'Se l\'email è registrata, riceverai le istruzioni via email' });

  } catch (error: any) {
    console.error('Errore richiesta reset:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

/**
 * POST /auth/reset-password
 * Reset password con token
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token e nuova password obbligatori' });
    }

    // Trova utente con token valido
    const user = await prisma.user.findFirst({
      where: {
        reset_token: token,
        reset_token_expires: { gt: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Token invalido o scaduto' });
    }

    // Hash nuova password
    const { salt, hash } = hashPassword(newPassword);

    // Aggiorna password e resetta token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password_salt: salt,
        password_hash: hash,
        reset_token: null,
        reset_token_expires: null
      }
    });

    res.json({ message: 'Password aggiornata con successo' });

  } catch (error: any) {
    console.error('Errore reset password:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ============================================================================
// PROFILO UTENTE
// ============================================================================

/**
 * GET /auth/me
 * Ottieni profilo utente autenticato
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        org_memberships: {
          where: { is_active: true },
          include: { org: true }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    const membership = user.org_memberships[0];
    if (!membership) {
      return res.status(400).json({ error: 'Nessuna organizzazione attiva' });
    }

    const isAdmin = membership.role === 'BUYER_ADMIN' || membership.role === 'VENDOR_ADMIN';

    res.json({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        email_verified: user.email_verified
      },
      organization: {
        id: membership.org_id,
        name: membership.org.legal_name,
        role: membership.role,
        isAdmin
      }
    });

  } catch (error: any) {
    console.error('Errore profilo:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

/**
 * PUT /auth/me
 * Aggiorna profilo utente
 */
router.put('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { firstName, lastName, phone } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        first_name: firstName,
        last_name: lastName,
        phone
      }
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        email_verified: user.email_verified
      }
    });

  } catch (error: any) {
    console.error('Errore aggiornamento profilo:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

/**
 * POST /auth/change-password
 * Cambia password (richiede password attuale)
 */
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Password attuale e nuova obbligatorie' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.password_hash || !user?.password_salt) {
      return res.status(400).json({ error: 'Account non configurato per password' });
    }

    // Verifica password attuale
    if (!verifyPassword(currentPassword, user.password_hash, user.password_salt)) {
      return res.status(400).json({ error: 'Password attuale errata' });
    }

    // Hash nuova password
    const { salt, hash } = hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password_salt: salt,
        password_hash: hash
      }
    });

    res.json({ message: 'Password cambiata con successo' });

  } catch (error: any) {
    console.error('Errore cambio password:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;
