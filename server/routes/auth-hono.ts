// ============================================================================
// MODELLO AUTENTICAZIONE E AUTORIZZAZIONE
// ============================================================================
//
// ORGANIZZAZIONI (type scelto alla registrazione):
// - buyer: compra prodotti/servizi → tutti membri vanno a /buyer
// - vendor: vende prodotti → membri admin/vendor vanno a /admin/catalogo
// - operator: fornisce servizi operativi → membri admin/operator vanno a /admin/prenotazioni
//
// RUOLI UTENTE (gerarchia):
// - admin: grado gerarchico (tutti iniziano così)
// - vendor: ruolo funzionale (solo per org vendor)
// - operator: ruolo funzionale (solo per org vendor/operator)
// - dispatcher: ruolo funzionale (solo per org vendor/operator)
//
// LOGICA INVITI:
// - Buyer org: possono invitare solo admin
// - Vendor/Operator org: possono invitare admin/vendor/operator/dispatcher
//
// ============================================================================

import { Hono } from 'hono';
import { hashPassword, verifyPassword, generateJWT, verifyJWT, generateResetToken, generateVerificationCode, rateLimiter } from '../utils/auth';
import { query } from '../utils/database';
import { sendPasswordResetEmail, sendVerificationCodeEmail } from '../utils/email';
import { publicObjectUrl } from '../utils/storage';
import type { UserStatus, UserRole } from '../types';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const app = new Hono();

// ============================================================================
// REGISTRAZIONE SEMPLIFICATA
// ============================================================================

app.post('/register', async (c) => {
  try {
    const { email, password, firstName, lastName, phone, organizationName, accountType } = await c.req.json();

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

    // Genera ID sicuri con crypto
    const generateId = () => randomUUID().replace(/-/g, '').slice(0, 21);

    const orgId = generateId();
    const userId = generateId();

    // Determina tipo organizzazione basato su accountType
    const orgType = accountType; // 'buyer', 'vendor', o 'operator'
    const orgTypeLower = orgType.toLowerCase();
    
    // Ruolo iniziale: tutti iniziano come admin (grado gerarchico)
    // Secondo il nuovo modello: admin è il grado gerarchico, tutti iniziano così
    const initialRole = 'admin';

    // Crea organizzazione (nuovo schema: type invece di can_*)
    await query(
      'INSERT INTO organizations (id, legal_name, type, address_line, city, province, region, country, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [orgId, organizationName || `${firstName} ${lastName}`, orgTypeLower, 'Da completare', 'Da completare', 'Da completare', 'Da completare', 'IT', 'ACTIVE']
    );

    // Crea utente (senza role nella tabella users, il ruolo è solo in org_memberships)
    await query(
      'INSERT INTO users (id, email, first_name, last_name, password_salt, password_hash, email_verified, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [userId, email, firstName, lastName, salt, hash, false, 'ACTIVE']
    );
    
    // Crea membership con nuovo ruolo standardizzato
    await query(
      'INSERT INTO org_memberships (org_id, user_id, role, is_active) VALUES ($1, $2, $3, $4)',
      [orgId, userId, initialRole, true]
    );

    // Genera codice verifica
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minuti da ora
    await query(
      'INSERT INTO verification_codes (user_id, email, code, purpose, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [userId, email, code, 'EMAIL_VERIFICATION', expiresAt.toISOString()]
    );

    // Invia email verifica
    await sendVerificationCodeEmail(email, code, 10);

    // Determina capabilities secondo il nuovo modello
    // Importa funzione per derivare capabilities
    const { deriveCapabilities } = await import('../utils/role-mapping');
    const capabilities = deriveCapabilities(orgTypeLower, initialRole);

    // Genera JWT con nuovo modello
    const token = generateJWT({
      userId,
      orgId,
      role: initialRole,
      isAdmin: true, // Admin è grado gerarchico, tutti iniziano così
      emailVerified: false
    });

    return c.json({
      message: 'Registrazione completata',
      token,
      user: { id: userId, email, first_name: firstName, last_name: lastName, email_verified: false, role: initialRole },
      organization: { 
        id: orgId, 
        name: organizationName || `${firstName} ${lastName}`, 
        type: orgTypeLower,
        ...capabilities
      }
    }, 201);

  } catch (error: any) {
    console.error('❌ Errore registrazione:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    return c.json({ 
      error: 'Errore interno',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, 500);
  }
});

// ============================================================================
// VERIFICA EMAIL
// ============================================================================

app.post('/verify-email', async (c) => {
  try {
    const { code } = await c.req.json();

    if (!code) {
      return c.json({ error: 'Codice obbligatorio' }, 400);
    }

    // Verifica che utente sia autenticato (token JWT)
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Autenticazione richiesta' }, 401);
    }

    const token = authHeader.substring(7);
    const payload = verifyJWT(token);
    if (!payload || !payload.userId) {
      return c.json({ error: 'Token non valido' }, 401);
    }

    const userId = payload.userId;

    // Trova codice verifica valido
    const codeResult = await query(`
      SELECT id, email, expires_at, used
      FROM verification_codes
      WHERE user_id = $1 AND code = $2 AND purpose = 'EMAIL_VERIFICATION' AND used = false
      ORDER BY created_at DESC LIMIT 1
    `, [userId, code]);

    if (codeResult.rows.length === 0) {
      return c.json({ error: 'Codice non valido' }, 400);
    }

    const verificationCode = codeResult.rows[0];

    // Verifica scadenza
    if (new Date() > new Date(verificationCode.expires_at)) {
      return c.json({ error: 'Codice scaduto' }, 400);
    }

    // Aggiorna utente come verificato
    await query('UPDATE users SET email_verified = true, email_verified_at = NOW() WHERE id = $1', [userId]);

    // Marca codice come usato
    await query('UPDATE verification_codes SET used = true, used_at = NOW() WHERE id = $1', [verificationCode.id]);

    // Cancella altri codici non usati per questo utente
    await query('DELETE FROM verification_codes WHERE user_id = $1 AND purpose = $2 AND used = false', [userId, 'EMAIL_VERIFICATION']);

    return c.json({ message: 'Email verificata con successo' });

  } catch (error: any) {
    console.error('Errore verifica email:', error);
    return c.json({ error: 'Errore interno' }, 500);
  }
});

// ============================================================================
// REINVIA CODICE VERIFICA
// ============================================================================

app.post('/resend-verification', async (c) => {
  try {
    // Verifica che utente sia autenticato
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Autenticazione richiesta' }, 401);
    }

    const token = authHeader.substring(7);
    const payload = verifyJWT(token);
    if (!payload || !payload.userId) {
      return c.json({ error: 'Token non valido' }, 401);
    }

    const userId = payload.userId;

    // Rate limiting per reinvio
    const rateLimit = rateLimiter.check(`resend_verification_${userId}`, 3, 60 * 60 * 1000); // 3 tentativi per ora
    if (!rateLimit.allowed) {
      return c.json({ error: 'Troppe richieste di reinvio' }, 429);
    }

    // Ottieni dati utente
    const userResult = await query('SELECT email, email_verified FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return c.json({ error: 'Utente non trovato' }, 404);
    }

    const user = userResult.rows[0];

    // Se già verificato, non serve reinvio
    if (user.email_verified) {
      return c.json({ error: 'Email già verificata' }, 400);
    }

    // Genera nuovo codice
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minuti da ora

    // Salva nuovo codice (cancella precedenti non usati)
    await query('DELETE FROM verification_codes WHERE user_id = $1 AND purpose = $2 AND used = false', [userId, 'EMAIL_VERIFICATION']);
    await query(
      'INSERT INTO verification_codes (user_id, email, code, purpose, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [userId, user.email, code, 'EMAIL_VERIFICATION', expiresAt.toISOString()]
    );

    // Invia email
    await sendVerificationCodeEmail(user.email, code, 10);

    return c.json({ message: 'Codice inviato' });

  } catch (error: any) {
    console.error('Errore reinvio codice:', error);
    return c.json({ error: 'Errore interno' }, 500);
  }
});

// ============================================================================
// LOGIN SEMPLIFICATO
// ============================================================================

app.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    console.log('🔐 [AUTH LOGIN] Login attempt:', { 
      email, 
      hasPassword: !!password, 
      passwordLength: password?.length,
      bodyKeys: Object.keys(body)
    });
    console.log('🔐 [AUTH LOGIN] Environment check:', {
      hasPGHOST: !!process.env.PGHOST,
      hasPGUSER: !!process.env.PGUSER,
      hasPGPASSWORD: !!process.env.PGPASSWORD,
      hasJWT_SECRET: !!process.env.JWT_SECRET,
      isNetlify: !!(process.env.NETLIFY || process.env.NETLIFY_BUILD)
    });

    if (!email || !password) {
      console.log('❌ Missing email or password:', { hasEmail: !!email, hasPassword: !!password });
      return c.json({ error: 'Email e password obbligatorie' }, 400);
    }

    // Rate limiting disabilitato per ora - implementare con Redis/Upstash per produzione

    // Trova utente con tipo organizzazione (usa COALESCE per gestire type vs org_type)
    // Nota: u.role potrebbe non esistere, quindi usiamo NULL se non presente
    // Seleziona esplicitamente tutte le colonne per evitare problemi con u.* su PostgreSQL
    let userResult;
    try {
      userResult = await query(`
        SELECT u.id, u.email, u.phone, u.first_name, u.last_name, u.password_salt, u.password_hash,
               u.email_verified, u.email_verified_at, u.oauth_provider, u.oauth_id,
               u.reset_token, u.reset_token_expires, u.status, u.created_at, u.updated_at,
               NULL as user_role, om.role as membership_role, o.id as org_id, o.legal_name, 
               COALESCE(o.type::text, o.org_type::text, 'buyer') as org_type
        FROM users u
        LEFT JOIN org_memberships om ON u.id = om.user_id AND om.is_active = true
        LEFT JOIN organizations o ON om.org_id = o.id
        WHERE u.email = $1 AND u.status = 'ACTIVE'
      `, [email]);
    } catch (queryError: any) {
      console.error('❌ [AUTH LOGIN] Errore query database:', queryError);
      console.error('❌ [AUTH LOGIN] Error message:', queryError.message);
      console.error('❌ [AUTH LOGIN] Error code:', queryError.code);
      // Prova query semplificata senza u.role se fallisce
      try {
        userResult = await query(`
          SELECT u.id, u.email, u.phone, u.first_name, u.last_name, u.password_salt, u.password_hash,
                 u.email_verified, u.email_verified_at, u.oauth_provider, u.oauth_id,
                 u.reset_token, u.reset_token_expires, u.status, u.created_at, u.updated_at,
                 om.role as membership_role, o.id as org_id, o.legal_name, 
                 COALESCE(o.type::text, o.org_type::text, 'buyer') as org_type
          FROM users u
          LEFT JOIN org_memberships om ON u.id = om.user_id AND om.is_active = true
          LEFT JOIN organizations o ON om.org_id = o.id
          WHERE u.email = $1 AND u.status = 'ACTIVE'
        `, [email]);
        // Aggiungi user_role come NULL per tutte le righe
        userResult.rows = userResult.rows.map((row: any) => ({ ...row, user_role: null }));
      } catch (fallbackError: any) {
        console.error('❌ [AUTH LOGIN] Errore anche nella query fallback:', fallbackError);
        throw queryError; // Lancia l'errore originale
      }
    }

    console.log('🔍 [AUTH LOGIN] Query result:', {
      rowsFound: userResult.rows.length,
      email: email
    });

    if (userResult.rows.length === 0) {
      console.log('❌ [AUTH LOGIN] Utente non trovato o non attivo');
      return c.json({ error: 'Credenziali invalide' }, 401);
    }

    const user = userResult.rows[0];
    console.log('👤 [AUTH LOGIN] Utente trovato:', {
      id: user.id,
      email: user.email,
      hasPasswordHash: !!user.password_hash,
      hasPasswordSalt: !!user.password_salt,
      passwordHashLength: user.password_hash?.length,
      passwordSaltLength: user.password_salt?.length,
      status: user.status,
      user_role: user.user_role,
      membership_role: user.membership_role,
      org_id: user.org_id,
      org_type: user.org_type,
      legal_name: user.legal_name
    });

    // Verifica password (supporta sia PBKDF2 che bcrypt)
    let passwordValid = false;
    if (user.password_salt && user.password_hash) {
      // Nuovo sistema PBKDF2
      console.log('🔐 [AUTH LOGIN] Verifica password con PBKDF2...');
      passwordValid = verifyPassword(password, user.password_hash, user.password_salt);
      console.log('🔐 [AUTH LOGIN] Risultato verifica PBKDF2:', passwordValid);
    } else if (user.password_hash) {
      // Legacy bcrypt
      console.log('🔐 [AUTH LOGIN] Verifica password con bcrypt...');
      passwordValid = await bcrypt.compare(password, user.password_hash);
      console.log('🔐 [AUTH LOGIN] Risultato verifica bcrypt:', passwordValid);
    } else {
      console.log('❌ [AUTH LOGIN] Nessun hash password trovato');
    }

    if (!passwordValid) {
      console.log('❌ [AUTH LOGIN] Password non valida');
      return c.json({ error: 'Credenziali invalide' }, 401);
    }

    console.log('✅ [AUTH LOGIN] Password verificata con successo');

    // Determina ruolo: mappa ruoli legacy ai nuovi ruoli standardizzati
    // user_role potrebbe non esistere nella query, quindi usiamo membership_role come fallback
    const rawUserRole = user.user_role || user.membership_role || null;
    const orgType = user.org_type ? String(user.org_type).toLowerCase() : 'buyer'; // Normalizza anche org_type
    
    // Importa funzione di mappatura ruoli legacy
    const { mapLegacyRoleToNewRole, isAdminRole, deriveCapabilities } = await import('../utils/role-mapping');
    
    const userRole = mapLegacyRoleToNewRole(rawUserRole, orgType);
    const orgId = user.org_id || null;
    const orgName = user.legal_name || null;
    const isAdmin = isAdminRole(userRole);

    console.log('🎭 Ruoli determinati:', {
      rawUserRole,
      userRole,
      orgType,
      orgId,
      orgName,
      isAdmin
    });

    // Genera JWT
    let token;
    try {
      token = generateJWT({
        userId: user.id,
        orgId,
        role: userRole,
        isAdmin,
        emailVerified: user.email_verified || false
      });
      console.log('✅ JWT generato con successo');
    } catch (jwtError: any) {
      console.error('❌ Errore generazione JWT:', jwtError);
      throw jwtError;
    }

    // Capabilities derivate dal tipo organizzazione e ruolo utente
    const capabilities = deriveCapabilities(orgType, userRole);

    console.log('🔧 Building response object...');
    const response = {
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        email_verified: user.email_verified || false,
        role: userRole
      },
      organization: orgId ? {
        id: orgId,
        name: orgName,
        type: orgType,
        ...capabilities
      } : null
    };

    console.log('📤 Response login:', {
      hasToken: !!response.token,
      userId: response.user.id,
      orgId: response.organization?.id,
      orgName: response.organization?.name
    });

    try {
      console.log('📤 Returning JSON response...');
      return c.json(response);
    } catch (jsonError: any) {
      console.error('❌ Errore serializzazione JSON:', jsonError);
      throw jsonError;
    }

  } catch (error: any) {
    console.error('❌ Errore login:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    return c.json({ 
      error: 'Errore interno',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, 500);
  }
});

// ============================================================================
// GET PROFILE (ME)
// ============================================================================

app.get('/me', async (c) => {
  try {
    // Estrai token dall'header Authorization
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Token mancante' }, 401);
    }

    const token = authHeader.substring(7);
    const payload = verifyJWT(token);

    if (!payload) {
      return c.json({ error: 'Token invalido o scaduto' }, 401);
    }

    // Trova utente e organizzazione dal database (usa COALESCE per gestire type vs org_type)
    // Nota: u.role potrebbe non esistere, quindi usiamo NULL se non presente
    // Seleziona esplicitamente tutte le colonne per evitare problemi con u.* su PostgreSQL
    let userResult;
    try {
      userResult = await query(`
        SELECT u.id, u.email, u.phone, u.first_name, u.last_name, u.password_salt, u.password_hash,
               u.email_verified, u.email_verified_at, u.oauth_provider, u.oauth_id,
               u.reset_token, u.reset_token_expires, u.status, u.created_at, u.updated_at,
               NULL as user_role, om.role as membership_role, o.id as org_id, o.legal_name, 
               COALESCE(o.type::text, o.org_type::text, 'buyer') as org_type
        FROM users u
        LEFT JOIN org_memberships om ON u.id = om.user_id AND om.is_active = true
        LEFT JOIN organizations o ON om.org_id = o.id
        WHERE u.id = $1 AND u.status = 'ACTIVE'
      `, [payload.userId]);
    } catch (queryError: any) {
      console.error('❌ [AUTH ME] Errore query database:', queryError);
      // Prova query semplificata senza u.role se fallisce
      try {
        userResult = await query(`
          SELECT u.id, u.email, u.phone, u.first_name, u.last_name, u.password_salt, u.password_hash,
                 u.email_verified, u.email_verified_at, u.oauth_provider, u.oauth_id,
                 u.reset_token, u.reset_token_expires, u.status, u.created_at, u.updated_at,
                 om.role as membership_role, o.id as org_id, o.legal_name, 
                 COALESCE(o.type::text, o.org_type::text, 'buyer') as org_type
          FROM users u
          LEFT JOIN org_memberships om ON u.id = om.user_id AND om.is_active = true
          LEFT JOIN organizations o ON om.org_id = o.id
          WHERE u.id = $1 AND u.status = 'ACTIVE'
        `, [payload.userId]);
        // Aggiungi user_role come NULL per tutte le righe
        userResult.rows = userResult.rows.map((row: any) => ({ ...row, user_role: null }));
      } catch (fallbackError: any) {
        console.error('❌ [AUTH ME] Errore anche nella query fallback:', fallbackError);
        throw queryError; // Lancia l'errore originale
      }
    }

    if (userResult.rows.length === 0) {
      return c.json({ error: 'Utente non trovato' }, 404);
    }

    const user = userResult.rows[0];
    const rawUserRole = user.user_role || user.membership_role;
    const orgType = user.org_type ? String(user.org_type).toLowerCase() : 'buyer'; // Normalizza anche org_type
    
    // Importa funzione di mappatura ruoli legacy
    const { mapLegacyRoleToNewRole, isAdminRole, deriveCapabilities } = await import('../utils/role-mapping');
    
    const userRole = mapLegacyRoleToNewRole(rawUserRole, orgType);
    const orgId = user.org_id || null;
    const orgName = user.legal_name || null;
    const isAdmin = isAdminRole(userRole);
    
    console.log('🔍 [AUTH ME] User data:', {
      userId: user.id,
      email: user.email,
      rawUserRole,
      userRole,
      orgType,
      orgId,
      orgName,
      isAdmin
    });

    // Capabilities derivate dal tipo organizzazione e ruolo utente
    const capabilities = deriveCapabilities(orgType, userRole);

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        email_verified: user.email_verified || false,
        role: userRole
      },
      organization: orgId ? {
        id: orgId,
        name: orgName,
        type: orgType,
        ...capabilities
      } : null
    });

  } catch (error: any) {
    console.error('Errore get profile:', error);
    return c.json({ error: 'Errore interno' }, 500);
  }
});

// ============================================================================
// RICHIESTA RESET PASSWORD
// ============================================================================

app.post('/request-password-reset', async (c) => {
  try {
    const { email } = await c.req.json();

    if (!email) {
      return c.json({ error: 'Email obbligatoria' }, 400);
    }

    // Rate limiting
    const rateLimit = rateLimiter.check(`reset_${email}`, 3, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return c.json({ error: 'Troppe richieste' }, 429);
    }

    // Trova utente
    console.log('🔍 Cerca utente con email:', email);
    let userResult;
    try {
      userResult = await query('SELECT id, email, first_name FROM users WHERE email = $1 AND status = $2', [email, 'ACTIVE']);
      console.log('✅ Query eseguita, risultati:', userResult.rows.length);
    } catch (queryError: any) {
      console.error('❌ Errore query database:', queryError);
      throw queryError;
    }
    
    if (userResult.rows.length === 0) {
      // Per sicurezza, non rivelare se l'email esiste
      console.log('⚠️  Utente non trovato o non attivo');
      return c.json({ message: 'Se l\'email esiste, riceverai un link per resettare la password' });
    }

    const user = userResult.rows[0];
    console.log('✅ Utente trovato:', user.id);

    // Genera token reset
    const resetToken = generateResetToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 ore

    // Salva token nel database (converti Date in ISO string per SQLite)
    await query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetToken, expiresAt.toISOString(), user.id]
    );

    // Invia email con link reset
    const frontendUrl = process.env.FRONTEND_URL || 'https://agrifly.it';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
    
    console.log('🔐 Generato reset token per:', email);
    console.log('🔗 Reset URL:', resetUrl);
    console.log('📧 FRONTEND_URL configurato:', frontendUrl);
    console.log('📧 RESEND_API_KEY configurato:', !!process.env.RESEND_API_KEY);
    
    try {
      const emailResult = await sendPasswordResetEmail(email, resetUrl);

      // Log dell'esito invio email (senza esporre link)
      if (!emailResult.sent) {
        console.error('❌ Email reset password non inviata:', emailResult.error);
      } else {
        console.log('✅ Email reset password inviata');
      }

    return c.json({
        message: 'Se l\'email esiste, riceverai un link per resettare la password' 
      });
    } catch (emailError: any) {
      console.error('❌ Errore invio email reset password:', emailError);
      // Non restituiamo mai il link - sicurezza prima di tutto
    }

    // Sempre restituisci messaggio generico
    return c.json({ message: 'Se l\'email esiste, riceverai un link per resettare la password' });

  } catch (error: any) {
    console.error('Errore richiesta reset password:', error);
    console.error('Stack:', error.stack);
    return c.json({ 
      error: 'Errore interno',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, 500);
  }
});

// ============================================================================
// RESET PASSWORD CON TOKEN
// ============================================================================

app.post('/reset-password', async (c) => {
  try {
    const { token, newPassword } = await c.req.json();

    if (!token || !newPassword) {
      return c.json({ error: 'Token e nuova password obbligatori' }, 400);
    }

    if (newPassword.length < 8) {
      return c.json({ error: 'La password deve essere di almeno 8 caratteri' }, 400);
    }

    console.log('🔐 Reset password - token ricevuto:', token.substring(0, 10) + '...');
    
    // Trova utente con token valido
    let userResult;
    try {
      userResult = await query(
        'SELECT id, email FROM users WHERE reset_token = $1 AND reset_token_expires > NOW() AND status = $2',
        [token, 'ACTIVE']
      );
      console.log('✅ Query reset password eseguita, risultati:', userResult.rows.length);
    } catch (queryError: any) {
      console.error('❌ Errore query reset password:', queryError.message);
      console.error('❌ Error code:', queryError.code);
      throw queryError;
    }

    if (userResult.rows.length === 0) {
      return c.json({ error: 'Token invalido o scaduto' }, 400);
    }

    const user = userResult.rows[0];

    // Genera nuovo hash password con salt
    const { salt, hash } = hashPassword(newPassword);

    // Aggiorna password e cancella token
    await query(
      'UPDATE users SET password_hash = $1, password_salt = $2, reset_token = NULL, reset_token_expires = NULL WHERE id = $3',
      [hash, salt, user.id]
    );

    return c.json({
      message: 'Password resettata con successo. Puoi ora accedere con la nuova password.' 
    });

  } catch (error: any) {
    console.error('Errore reset password:', error);
    return c.json({ error: 'Errore interno' }, 500);
  }
});

// ============================================================================
// DEBUG: CHECK LENZI CATALOG
// ============================================================================

app.get('/debug/lenzi-catalog', async (c) => {
  try {
    console.log('🔍 Debug Lenzi catalog - inizio query...');
    
    // Trova organizzazione Lenzi
    const lenziOrg = await query(`
      SELECT id, legal_name, org_type, status
      FROM organizations
      WHERE legal_name ILIKE '%lenzi%'
      LIMIT 1
    `);

    console.log('📋 Organizzazioni Lenzi trovate:', lenziOrg.rows.length);

    if (lenziOrg.rows.length === 0) {
      // Prova a cercare tutte le organizzazioni vendor
      const allVendors = await query(`
        SELECT id, legal_name, org_type
        FROM organizations
        WHERE org_type = 'VENDOR'
        LIMIT 10
      `);
      return c.json({ 
        error: 'Organizzazione Lenzi non trovata',
        availableVendors: allVendors.rows
      }, 404);
    }

    const lenziId = lenziOrg.rows[0].id;
    console.log('✅ Lenzi ID trovato:', lenziId);

    // Catalog items con prezzi
    const catalogItems = await query(`
      SELECT 
        vci.id,
        vci.sku_id,
        vci.is_for_sale,
        vci.is_for_rent,
        s.sku_code,
        p.name as product_name,
        p.brand,
        p.model,
        (
          SELECT pli.price_cents / 100.0
          FROM price_list_items pli
          JOIN price_lists pl ON pli.price_list_id = pl.id
          WHERE pli.sku_id = s.id
            AND pl.vendor_org_id = $1
            AND pl.status = 'ACTIVE'
            AND pl.valid_from <= NOW()
            AND (pl.valid_to IS NULL OR pl.valid_to >= NOW())
          ORDER BY pl.valid_from DESC
          LIMIT 1
        ) as price_euros
      FROM vendor_catalog_items vci
      JOIN skus s ON vci.sku_id = s.id
      JOIN products p ON s.product_id = p.id
      WHERE vci.vendor_org_id = $1
      LIMIT 10
    `, [lenziId]);

    // Inventari dettagliati
    const inventories = await query(`
      SELECT 
        COUNT(DISTINCT i.sku_id) as sku_count,
        SUM(i.qty_on_hand) as total_stock
      FROM inventories i
      WHERE i.vendor_org_id = $1
    `, [lenziId]);

    // Inventari per SKU
    const inventoryDetails = await query(`
      SELECT 
        i.sku_id,
        s.sku_code,
        p.name as product_name,
        SUM(i.qty_on_hand) as qty_on_hand,
        SUM(i.qty_reserved) as qty_reserved,
        SUM(i.qty_on_hand) - SUM(i.qty_reserved) as qty_available
      FROM inventories i
      JOIN skus s ON i.sku_id = s.id
      JOIN products p ON s.product_id = p.id
      WHERE i.vendor_org_id = $1
      GROUP BY i.sku_id, s.sku_code, p.name
      ORDER BY p.name
    `, [lenziId]);

    // Utente Giacomo
    const giacomo = await query(`
      SELECT 
        u.email,
        om.org_id,
        om.role,
        o.legal_name
      FROM users u
      JOIN org_memberships om ON u.id = om.user_id AND om.is_active = true
      JOIN organizations o ON om.org_id = o.id
      WHERE u.email = 'giacomo.cavalcabo14@gmail.com'
    `);

    return c.json({
      lenziOrg: {
        id: lenziOrg.rows[0].id,
        name: lenziOrg.rows[0].legal_name,
        type: lenziOrg.rows[0].org_type
      },
      catalogItems: catalogItems.rows.length,
      catalogItemsSample: catalogItems.rows.slice(0, 5).map(row => ({
        skuCode: row.sku_code,
        productName: row.product_name,
        isForSale: row.is_for_sale,
        price: row.price_euros || null,
        hasPrice: !!row.price_euros
      })),
      inventories: {
        skuCount: parseInt(inventories.rows[0].sku_count) || 0,
        totalStock: parseInt(inventories.rows[0].total_stock) || 0,
        details: inventoryDetails.rows.map(row => ({
          skuCode: row.sku_code,
          productName: row.product_name,
          onHand: parseInt(row.qty_on_hand) || 0,
          reserved: parseInt(row.qty_reserved) || 0,
          available: parseInt(row.qty_available) || 0
        }))
      },
      giacomoMemberships: giacomo.rows
    });

  } catch (error: any) {
    console.error('Errore debug lenzi catalog:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Endpoint debug rimosso per sicurezza - non esporre in produzione

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

// Endpoint debug rimosso per sicurezza - non esporre in produzione

// ============================================================================
// INVITATION ACCEPTANCE
// ============================================================================

// POST /api/auth/accept-invite - Accept organization invitation
app.post('/accept-invite', async (c) => {
  try {
    console.log('🎫 [ACCEPT INVITE] ===========================================');
    console.log('🎫 [ACCEPT INVITE] Inizio accettazione invito');

    const { token, password, firstName, lastName } = await c.req.json();

    console.log('🎫 [ACCEPT INVITE] Token presente:', !!token);
    console.log('🎫 [ACCEPT INVITE] Password presente:', !!password);
    console.log('🎫 [ACCEPT INVITE] Nomi:', { firstName, lastName });

    if (!token) {
      console.log('❌ [ACCEPT INVITE] Token mancante');
      return c.json({ error: 'Invitation token is required' }, 400);
    }

    if (!password || !firstName || !lastName) {
      console.log('❌ [ACCEPT INVITE] Dati utente mancanti');
      return c.json({ error: 'Password, first name, and last name are required' }, 400);
    }

    // 1. Trova l'invito valido
    console.log('🔍 [ACCEPT INVITE] Ricerca invito per token...');
    const inviteResult = await query(`
      SELECT oi.*, o.legal_name as org_name, o.type as org_type
      FROM organization_invitations oi
      JOIN organizations o ON oi.organization_id = o.id
      WHERE oi.token = $1 AND oi.status = 'PENDING' AND oi.expires_at > NOW()
    `, [token]);

    console.log('📋 [ACCEPT INVITE] Inviti trovati:', inviteResult.rows.length);

    if (inviteResult.rows.length === 0) {
      console.log('❌ [ACCEPT INVITE] Invito non trovato o non valido');
      return c.json({ error: 'Invalid or expired invitation token' }, 400);
    }

    const invite = inviteResult.rows[0];
    console.log('📋 [ACCEPT INVITE] Invito valido trovato:', {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      orgId: invite.organization_id,
      orgName: invite.org_name,
      expiresAt: invite.expires_at
    });

    // 2. Verifica se l'utente esiste già
    console.log('👤 [ACCEPT INVITE] Controllo esistenza utente...');
    const existingUser = await query('SELECT id, status FROM users WHERE email = $1', [invite.email]);

    let userId;
    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
      console.log('✅ [ACCEPT INVITE] Utente esistente trovato:', userId);

      // Verifica se è già membro dell'organizzazione
      const existingMembership = await query(
        'SELECT id FROM org_memberships WHERE user_id = $1 AND org_id = $2 AND is_active = true',
        [userId, invite.organization_id]
      );

      if (existingMembership.rows.length > 0) {
        console.log('⚠️ [ACCEPT INVITE] Utente già membro dell\'organizzazione');
        return c.json({ error: 'You are already a member of this organization' }, 400);
      }
    } else {
      // 3. Crea nuovo utente
      console.log('👤 [ACCEPT INVITE] Creazione nuovo utente...');

      // Hash password
      const bcrypt = await import('bcryptjs');
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Genera salt per compatibilità con il sistema esistente
      const crypto = await import('crypto');
      const passwordSalt = crypto.randomBytes(32).toString('hex');

      const newUserResult = await query(`
        INSERT INTO users (id, email, first_name, last_name, password_hash, password_salt, status, email_verified, created_at, updated_at)
        VALUES (cuid(), $1, $2, $3, $4, $5, 'ACTIVE', true, NOW(), NOW())
        RETURNING id
      `, [invite.email, firstName, lastName, hashedPassword, passwordSalt]);

      userId = newUserResult.rows[0].id;
      console.log('✅ [ACCEPT INVITE] Nuovo utente creato:', userId);
    }

    // 4. Aggiungi membership all'organizzazione
    console.log('🏢 [ACCEPT INVITE] Aggiunta membership organizzazione...');
    const membershipResult = await query(`
      INSERT INTO org_memberships (id, user_id, org_id, role, is_active, created_at, updated_at)
      VALUES (cuid(), $1, $2, $3, true, NOW(), NOW())
      RETURNING id
    `, [userId, invite.organization_id, invite.role]);

    console.log('✅ [ACCEPT INVITE] Membership creata:', membershipResult.rows[0].id);

    // 5. Aggiorna status invito
    console.log('✅ [ACCEPT INVITE] Aggiornamento status invito...');
    await query(
      'UPDATE organization_invitations SET status = $1, accepted_at = NOW() WHERE id = $2',
      ['ACCEPTED', invite.id]
    );

    console.log('🎉 [ACCEPT INVITE] Invito accettato con successo!');
    console.log('🎫 [ACCEPT INVITE] ===========================================');

    return c.json({
      success: true,
      message: 'Invitation accepted successfully',
      user: {
        id: userId,
        email: invite.email,
        firstName,
        lastName
      },
      organization: {
        id: invite.organization_id,
        name: invite.org_name,
        type: invite.org_type
      },
      membership: {
        role: invite.role
      }
    });

  } catch (error: any) {
    console.error('❌ [ACCEPT INVITE] Errore accettazione invito:', error.message);
    console.error('❌ [ACCEPT INVITE] Stack trace:', error.stack);
    console.log('🎫 [ACCEPT INVITE] ===========================================');
    return c.json({ error: 'Internal server error', message: error.message }, 500);
  }
});

export default app;
