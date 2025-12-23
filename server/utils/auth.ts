import crypto from 'crypto';

// ============================================================================
// PASSWORD HASHING (come Agoralia: PBKDF2 + salt casuale)
// ============================================================================

/**
 * Hash password con PBKDF2 + salt casuale (come Agoralia)
 * @param password Password in chiaro
 * @returns {salt: string, hash: string}
 */
export function hashPassword(password: string): { salt: string; hash: string } {
  // Genera salt casuale 16 byte (32 caratteri hex)
  const saltBytes = crypto.randomBytes(16);
  const salt = saltBytes.toString('hex');

  // PBKDF2 con SHA256, 100.000 iterazioni (come Agoralia)
  const hash = crypto.pbkdf2Sync(password, saltBytes, 100000, 64, 'sha256').toString('hex');

  return { salt, hash };
}

/**
 * Verifica password contro hash + salt
 * @param password Password in chiaro
 * @param storedHash Hash memorizzato
 * @param storedSalt Salt memorizzato
 * @returns boolean
 */
export function verifyPassword(password: string, storedHash: string, storedSalt: string): boolean {
  const saltBytes = Buffer.from(storedSalt, 'hex');
  const computedHash = crypto.pbkdf2Sync(password, saltBytes, 100000, 64, 'sha256').toString('hex');

  // Usa timing-safe comparison per evitare timing attacks
  return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(storedHash, 'hex'));
}

// ============================================================================
// JWT CUSTOM (come Agoralia: formato non standard)
// ============================================================================

/**
 * Genera JWT custom (formato Agoralia: {body}.{signature} senza header)
 * @param payload Payload del token
 * @returns JWT string
 */
export function generateJWT(payload: any): string {
  // Crea payload con timestamp
  const jwtPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 giorni
  };

  // Codifica body in base64url (senza header, come Agoralia)
  const body = Buffer.from(JSON.stringify(jwtPayload, null, 0)).toString('base64url');

  // Firma HMAC-SHA256 con secret (da env, non hardcoded)
  const secret = process.env.JWT_SECRET || 'fallback_secret_change_in_production';
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');

  // Formato Agoralia: {body}.{signature} (senza header)
  return `${body}.${signature}`;
}

/**
 * Verifica e decodifica JWT custom
 * @param token JWT string
 * @returns payload decodificato o null se invalido
 */
export function verifyJWT(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null; // Formato invalido

    const [body, signature] = parts;

    // Verifica firma
    const secret = process.env.JWT_SECRET || 'fallback_secret_change_in_production';
    const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature, 'base64url'), Buffer.from(expectedSignature, 'base64url'))) {
      return null; // Firma invalida
    }

    // Decodifica payload
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());

    // Verifica scadenza
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Token scaduto
    }

    return payload;
  } catch (error) {
    return null; // Token malformato
  }
}

// ============================================================================
// RESET PASSWORD TOKEN (come Agoralia)
// ============================================================================

/**
 * Genera token reset password URL-safe (32 caratteri)
 * @returns token string
 */
export function generateResetToken(): string {
  return crypto.randomBytes(24).toString('base64url'); // 32 caratteri URL-safe
}

// ============================================================================
// VERIFICATION CODE (come Agoralia)
// ============================================================================

/**
 * Genera codice verifica email (6 cifre)
 * @returns string di 6 cifre
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ============================================================================
// RATE LIMITING UTILITIES
// ============================================================================

/**
 * Simple in-memory rate limiter (per development)
 * In produzione usare Redis o database
 */
class RateLimiter {
  private attempts = new Map<string, { count: number; resetTime: number }>();

  /**
   * Controlla se richiesta è permessa
   * @param key Identificatore univoco (IP, email, etc.)
   * @param maxAttempts Numero massimo tentativi
   * @param windowMs Finestra temporale in ms
   * @returns {allowed: boolean, remaining: number, resetTime: number}
   */
  check(key: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) {
    const now = Date.now();
    const record = this.attempts.get(key);

    if (!record || now > record.resetTime) {
      // Prima tentativo o finestra scaduta
      this.attempts.set(key, { count: 1, resetTime: now + windowMs });
      return { allowed: true, remaining: maxAttempts - 1, resetTime: now + windowMs };
    }

    if (record.count >= maxAttempts) {
      return { allowed: false, remaining: 0, resetTime: record.resetTime };
    }

    record.count++;
    return { allowed: true, remaining: maxAttempts - record.count, resetTime: record.resetTime };
  }

  /**
   * Resetta contatore per chiave
   */
  reset(key: string) {
    this.attempts.delete(key);
  }
}

// Singleton rate limiter
export const rateLimiter = new RateLimiter();

// ============================================================================
// EMAIL UTILITIES (Resend come Agoralia)
// ============================================================================

/**
 * Invia email con Resend (come Agoralia)
 * Nota: Implementazione placeholder, serve API key
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  // Placeholder per implementazione Resend
  // In produzione:
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({ from, to, subject, html });

  console.log(`📧 EMAIL TO: ${to}`);
  console.log(`📧 SUBJECT: ${subject}`);
  console.log(`📧 HTML: ${html.substring(0, 200)}...`);

  // Per ora simula invio riuscito
  return true;
}