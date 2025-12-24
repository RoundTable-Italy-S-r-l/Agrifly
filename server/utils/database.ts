import { Pool } from 'pg';

// Connection pool semplificato per serverless
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Necessario per Supabase
  max: 1, // Una sola connessione per function
  min: 0,
  idleTimeoutMillis: 5000,
  connectionTimeoutMillis: 10000,
});

// Test connessione (solo in sviluppo)
if (!process.env.NETLIFY) {
  pool.connect()
    .then(() => console.log('✅ Database connesso localmente'))
    .catch(err => console.error('❌ Errore connessione database locale:', err.message));
}

export { pool };

// Utility per query sicure con gestione errori migliorata
export const query = async (text: string, params?: any[]) => {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } catch (error: any) {
    console.error('Database query error:', error.message);
    throw error;
  } finally {
    client.release();
  }
};
