import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_EXPIRES_IN = '7d';

// Hash password con PBKDF2 (come Agoralia)
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// Verifica password
export function verifyPassword(password: string, hash: string): boolean {
  const [salt, hashValue] = hash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hashValue === verifyHash;
}

// Genera JWT token
export function generateJWT(payload: {
  userId: string;
  orgId: string;
  role: string;
  isAdmin: boolean;
}): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Verifica JWT token
export function verifyJWT(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Genera codice verifica 6 cifre
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Genera token sicuro (per reset password, inviti)
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

