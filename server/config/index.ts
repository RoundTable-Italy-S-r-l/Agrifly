/**
 * Configurazioni centralizzate per l'applicazione
 * Supporta sia ambiente locale che produzione (Netlify + Supabase)
 */

// JWT Secret - centrale per tutto il backend
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';

// Database configuration
export const DATABASE_URL = process.env.DATABASE_URL || 'file:./prisma/dev.db';

// Frontend URL (per email e redirect)
export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8082';

// API Base URL (per client-side)
export const API_BASE = process.env.API_BASE || '/api';

// Environment detection
export const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
export const isProduction = process.env.NODE_ENV === 'production';

// Database type detection
export const isUsingSQLite = DATABASE_URL.startsWith('file:') || isDevelopment;
export const isUsingPostgreSQL = DATABASE_URL.startsWith('postgresql://') || DATABASE_URL.startsWith('postgres://');

// Resend API Key (per email)
export const RESEND_API_KEY = process.env.RESEND_API_KEY || null;
export const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'DJI Agriculture <noreply@dji-agriculture.com>';

// GraphHopper API Key (per routing)
export const GRAPHHOPPER_API_KEY = process.env.GRAPHHOPPER_API_KEY || null;

// Supabase (se usato)
export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null;
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || null;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || null;

// Log configurazione (solo in dev, senza valori sensibili)
if (isDevelopment) {
  console.log('🔧 Configuration loaded:');
  console.log('  Environment:', isDevelopment ? 'development' : 'production');
  console.log('  Database:', isUsingSQLite ? 'SQLite' : isUsingPostgreSQL ? 'PostgreSQL' : 'Unknown');
  console.log('  Frontend URL:', FRONTEND_URL);
  console.log('  API Base:', API_BASE);
  console.log('  Resend configured:', !!RESEND_API_KEY);
  console.log('  GraphHopper configured:', !!GRAPHHOPPER_API_KEY);
}

