import { Client } from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carica .env dalla root del progetto
dotenv.config({ path: join(__dirname, '../.env') });

// Usa le credenziali dalle variabili d'ambiente
const client = new Client({
  host: process.env.PGHOST || process.env.DATABASE_URL?.match(/@([^:]+)/)?.[1],
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER || process.env.DATABASE_URL?.match(/:\/\/([^:]+):/)?.[1],
  password: process.env.PGPASSWORD || process.env.DATABASE_URL?.match(/:\/\/[^:]+:([^@]+)@/)?.[1]?.replace(/%5/g, '%'),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 3000,
});

async function quickCheck() {
  try {
    console.log('Connessione...');
    await client.connect();
    console.log('✅ Connesso!');

    // Test semplice
    const result = await client.query('SELECT NOW() as now, version() as version');
    console.log('Database time:', result.rows[0].now);
    console.log('PostgreSQL version:', result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1]);

    // Verifica tabella users
    const users = await client.query('SELECT COUNT(*) as count FROM users');
    console.log('Utenti totali:', users.rows[0].count);

    // Verifica Giacomo
    const giacomo = await client.query('SELECT id, email, status, email_verified FROM users WHERE email = $1', ['giacomo.cavalcabo14@gmail.com']);
    if (giacomo.rows.length > 0) {
      console.log('✅ Giacomo trovato:', giacomo.rows[0]);
    } else {
      console.log('❌ Giacomo non trovato');
    }

    await client.end();
    console.log('✅ Check completato');
  } catch (err) {
    console.error('❌ Errore:', err.message);
    process.exit(1);
  }
}

quickCheck();
