import { Hono } from 'hono';
import { hashPassword, verifyPassword, generateJWT, generateResetToken, generateVerificationCode, rateLimiter } from '../utils/auth';
import { query } from '../utils/database';
import type { UserStatus, OrgRole } from '../types';

const app = new Hono();

// ============================================================================
// REGISTRAZIONE SEMPLIFICATA
// ============================================================================

app.post('/register', async (c) => {
  try {
    const { email, password, firstName, lastName, phone, organizationName } = await c.req.json();

    // Validazione
    if (!email || !password || !firstName || !lastName) {
      return c.json({ error: 'Campi obbligatori mancanti' }, 400);
    }

    // Rate limiting
    const rateLimit = rateLimiter.check(`register_${email}`, 3, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return c.json({ error: 'Troppe richieste' }, 429);
    }

    // Verifica email esistente
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return c.json({ error: 'Email già registrata' }, 400);
    }

    // Hash password
    const { salt, hash } = hashPassword(password);

    // Crea organizzazione
    const orgResult = await query(
      'INSERT INTO organizations (legal_name, org_type, address_line, city, province, region, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [organizationName || `${firstName} ${lastName}`, 'FARM', '', '', '', '', 'ACTIVE']
    );
    const orgId = orgResult.rows[0].id;

    // Crea utente
    const userResult = await query(
      'INSERT INTO users (email, first_name, last_name, password_salt, password_hash, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [email, firstName, lastName, salt, hash, 'ACTIVE']
    );
    const userId = userResult.rows[0].id;

    // Crea membership
    await query(
      'INSERT INTO org_memberships (org_id, user_id, role, is_active) VALUES ($1, $2, $3, $4)',
      [orgId, userId, 'BUYER_ADMIN', true]
    );

    // Genera codice verifica
    const code = generateVerificationCode();
    await query(
      'INSERT INTO verification_codes (user_id, email, code, purpose, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [userId, email, code, 'EMAIL_VERIFICATION', new Date(Date.now() + 10 * 60 * 1000)]
    );

    // Genera JWT
    const token = generateJWT({
      userId,
      orgId,
      role: 'BUYER_ADMIN',
      isAdmin: true,
      emailVerified: false
    });

    return c.json({
      message: 'Registrazione completata',
      token,
      user: { id: userId, email, first_name: firstName, last_name: lastName, email_verified: false },
      organization: { id: orgId, name: organizationName || `${firstName} ${lastName}`, role: 'BUYER_ADMIN', isAdmin: true }
    }, 201);

  } catch (error: any) {
    console.error('Errore registrazione:', error);
    return c.json({ error: 'Errore interno' }, 500);
  }
});

// ============================================================================
// LOGIN SEMPLIFICATO
// ============================================================================

app.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: 'Email e password obbligatorie' }, 400);
    }

    // Rate limiting
    const clientIP = c.req.header('x-forwarded-for') || 'unknown';
    const rateLimit = rateLimiter.check(`login_${clientIP}_${email}`, 5, 15 * 60 * 1000);
    if (!rateLimit.allowed) {
      return c.json({ error: 'Troppe richieste' }, 429);
    }

    // Trova utente
    const userResult = await query(`
      SELECT u.*, om.role, o.id as org_id, o.legal_name
      FROM users u
      LEFT JOIN org_memberships om ON u.id = om.user_id AND om.is_active = true
      LEFT JOIN organizations o ON om.org_id = o.id
      WHERE u.email = $1 AND u.status = 'ACTIVE'
    `, [email]);

    if (userResult.rows.length === 0) {
      return c.json({ error: 'Credenziali invalide' }, 401);
    }

    const user = userResult.rows[0];

    // Verifica password
    if (!user.password_hash || !user.password_salt || !verifyPassword(password, user.password_hash, user.password_salt)) {
      return c.json({ error: 'Credenziali invalide' }, 401);
    }

    // Genera JWT
    const token = generateJWT({
      userId: user.id,
      orgId: user.org_id,
      role: user.role,
      isAdmin: user.role === 'BUYER_ADMIN' || user.role === 'VENDOR_ADMIN',
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
        id: user.org_id,
        name: user.legal_name,
        role: user.role,
        isAdmin: user.role === 'BUYER_ADMIN' || user.role === 'VENDOR_ADMIN'
      }
    });

  } catch (error: any) {
    console.error('Errore login:', error);
    return c.json({ error: 'Errore interno' }, 500);
  }
});

// ============================================================================
// HEALTH CHECK SEMPLIFICATO
// ============================================================================

app.get('/health', async (c) => {
  try {
    // Test connessione database
    await query('SELECT 1');

    return c.json({
      timestamp: new Date().toISOString(),
      status: 'ok',
      database: 'connected',
      environment: process.env.NODE_ENV
    });
  } catch (error: any) {
    return c.json({
      status: 'error',
      database: 'disconnected',
      error: error.message
    }, 500);
  }
});

export default app;
