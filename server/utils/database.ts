import { Pool } from 'pg';

// Connection pool per PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Necessario per Supabase
  max: 5, // Limite connessioni per serverless
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connessione
if (process.env.NETLIFY) {
  pool.connect()
    .then(() => console.log('✅ Database connesso'))
    .catch(err => console.error('❌ Errore connessione database:', err.message));
}

export { pool };

// Utility per query sicure
export const query = async (text: string, params?: any[]) => {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
};
