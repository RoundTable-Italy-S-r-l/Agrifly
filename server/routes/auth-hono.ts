import { Hono } from 'hono';
import { UserStatus, VerificationPurpose, OrgRole } from '../../generated/prisma';
import { hashPassword, verifyPassword, generateJWT, generateResetToken, generateVerificationCode, rateLimiter, sendEmail } from '../utils/auth';
import { prisma } from '../utils/prisma';

const app = new Hono();

// ============================================================================
// MIDDLEWARE AUTENTICAZIONE JWT CUSTOM
// ============================================================================

/**
 * Middleware per verificare JWT custom (come Agoralia)
 */
export function requireAuth(c: any, next: any) {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Token mancante' }, 401);
    }

    const token = authHeader.substring(7);
    const payload = require('../utils/auth').verifyJWT(token);

    if (!payload) {
      return c.json({ error: 'Token invalido' }, 401);
    }

    c.set('user', payload);
    return next();
  } catch (error) {
    return c.json({ error: 'Errore autenticazione' }, 401);
  }
}

/**
 * Middleware per verificare admin (come Agoralia)
 */
export function requireAdmin(c: any, next: any) {
  const user = c.get('user');
  if (!user?.isAdmin) {
    return c.json({ error: 'Accesso admin richiesto' }, 403);
  }
  return next();
}

// ============================================================================
// REGISTRAZIONE
// ============================================================================

/**
 * POST /auth/register
 * Registrazione utente con verifica email
 */
app.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, firstName, lastName, phone, organizationName } = body;

    // Validazione input
    if (!email || !password || !firstName || !lastName) {
      return c.json({ error: 'Tutti i campi sono obbligatori' }, 400);
    }

    // Rate limiting per email
    const rateLimit = rateLimiter.check(`register_${email}`, 3, 60 * 60 * 1000); // 3 tentativi/ora
    if (!rateLimit.allowed) {
      return c.json({
        error: 'Troppe richieste di registrazione',
        retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
      }, 429);
    }

    // Verifica email unica
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return c.json({ error: 'Email già registrata' }, 400);
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

    return c.json({
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
    }, 201);

  } catch (error: any) {
    console.error('Errore registrazione:', error);
    return c.json({ error: 'Errore interno del server' }, 500);
  }
});

// ============================================================================
// LOGIN
// ============================================================================

/**
 * POST /auth/login
 * Login con email/password
 */
app.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: 'Email e password obbligatorie' }, 400);
    }

    // Rate limiting per IP/email
    const clientIP = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    const rateLimit = rateLimiter.check(`login_${clientIP}_${email}`, 5, 15 * 60 * 1000); // 5 tentativi/15min
    if (!rateLimit.allowed) {
      return c.json({
        error: 'Troppe richieste di login',
        retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
      }, 429);
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
      return c.json({ error: 'Credenziali invalide' }, 401);
    }

    // Verifica password
    if (!user.password_hash || !user.password_salt) {
      return c.json({ error: 'Account non configurato per login tradizionale' }, 401);
    }

    if (!verifyPassword(password, user.password_hash, user.password_salt)) {
      return c.json({ error: 'Credenziali invalide' }, 401);
    }

    // Trova membership attiva
    const membership = user.org_memberships[0];
    if (!membership) {
      return c.json({ error: 'Nessuna organizzazione attiva' }, 400);
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

    return c.json({
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
    return c.json({ error: 'Errore interno del server' }, 500);
  }
});

// ============================================================================
// VERIFICA EMAIL
// ============================================================================

/**
 * POST /auth/verify-email
 * Verifica email con codice 6 cifre
 */
app.post('/verify-email', requireAuth, async (c) => {
  try {
    const { code } = await c.req.json();
    const user = c.get('user');

    if (!code || code.length !== 6) {
      return c.json({ error: 'Codice di verifica non valido' }, 400);
    }

    // Trova codice valido
    const verification = await prisma.verificationCode.findFirst({
      where: {
        user_id: user.userId,
        code,
        purpose: 'EMAIL_VERIFICATION',
        used: false,
        expires_at: { gt: new Date() }
      }
    });

    if (!verification) {
      return c.json({ error: 'Codice invalido o scaduto' }, 400);
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
      where: { id: user.userId },
      data: {
        email_verified: true,
        email_verified_at: new Date()
      }
    });

    return c.json({ message: 'Email verificata con successo' });

  } catch (error: any) {
    console.error('Errore verifica email:', error);
    return c.json({ error: 'Errore interno del server' }, 500);
  }
});

// ============================================================================
// ALTRE ROUTES AUTH (placeholder per completezza)
// ============================================================================

app.post('/resend-verification', requireAuth, async (c) => {
  // Implementazione semplificata
  return c.json({ message: 'Funzionalità da implementare' });
});

app.post('/request-password-reset', async (c) => {
  // Implementazione semplificata
  return c.json({ message: 'Funzionalità da implementare' });
});

app.post('/reset-password', async (c) => {
  // Implementazione semplificata
  return c.json({ message: 'Funzionalità da implementare' });
});

app.get('/me', requireAuth, async (c) => {
  // Implementazione semplificata
  return c.json({ message: 'Profilo utente' });
});

export default app;
