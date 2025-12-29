import { randomUUID, createHmac, pbkdf2Sync, timingSafeEqual, randomBytes } from 'crypto';
import { JWT_SECRET } from '../config';

// ============================================================================
// PASSWORD HASHING
// ============================================================================

/**
 * Hash password con PBKDF2 + salt casuale
 * @param password Password in chiaro
 * @returns {salt: string, hash: string}
 */
export function hashPassword(password: string): { salt: string; hash: string } {
  // Genera salt casuale 16 byte (32 caratteri hex)
  const saltBytes = randomBytes(16);
  const salt = saltBytes.toString('hex');

  // PBKDF2 con SHA256, 100.000 iterazioni
  const hash = pbkdf2Sync(password, saltBytes, 100000, 64, 'sha256').toString('hex');

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
  const computedHash = pbkdf2Sync(password, saltBytes, 100000, 64, 'sha256').toString('hex');

  // Usa timing-safe comparison per evitare timing attacks
  return timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(storedHash, 'hex'));
}

// ============================================================================
// JWT CUSTOM
// ============================================================================

/**
 * Genera JWT custom (formato {body}.{signature} senza header)
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

  // Codifica body in base64url (senza header)
  const body = Buffer.from(JSON.stringify(jwtPayload, null, 0)).toString('base64url');

  // Firma HMAC-SHA256 con secret (da config centralizzata)
  const signature = createHmac('sha256', JWT_SECRET).update(body).digest('base64url');

  // Formato: {body}.{signature} (senza header)
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
    const expectedSignature = createHmac('sha256', JWT_SECRET).update(body).digest('base64url');

    if (!timingSafeEqual(Buffer.from(signature, 'base64url'), Buffer.from(expectedSignature, 'base64url'))) {
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
    console.error('JWT verification error:', error);
    return null; // Token malformato
  }
}

// ============================================================================
// RESET PASSWORD TOKEN
// ============================================================================

/**
 * Genera token reset password URL-safe (32 caratteri)
 * @returns token string
 */
export function generateResetToken(): string {
  return crypto.randomBytes(24).toString('base64url'); // 32 caratteri URL-safe
}

// ============================================================================
// VERIFICATION CODE
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
// EMAIL UTILITIES
// ============================================================================
// 
// NOTA: Le funzioni email reali sono in server/utils/email.ts
// Questo file contiene solo utility per autenticazione e JWT
//