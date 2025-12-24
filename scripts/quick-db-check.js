import { Client } from 'pg';

// Usa le credenziali dal pooler Supabase
const client = new Client({
  host: 'aws-1-eu-central-2.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.fzowfkfwriajohjjboed',
  password: '66tY3_C_%5iAR8c',
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
