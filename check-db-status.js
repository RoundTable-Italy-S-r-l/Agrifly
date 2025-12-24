import { Client } from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carica .env dalla root del progetto
dotenv.config({ path: join(__dirname, '.env') });

const client = new Client({
  host: process.env.PGHOST || process.env.DATABASE_URL?.match(/@([^:]+)/)?.[1],
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER || process.env.DATABASE_URL?.match(/:\/\/([^:]+):/)?.[1],
  password: process.env.PGPASSWORD || process.env.DATABASE_URL?.match(/:\/\/[^:]+:([^@]+)@/)?.[1]?.replace(/%5/g, '%'),
  ssl: { rejectUnauthorized: false }
});

async function checkDatabase() {
  try {
    await client.connect();
    console.log('✅ Database connesso');

    // Controlla se le tabelle necessarie esistono
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'organizations', 'org_memberships', 'verification_codes')
      ORDER BY table_name
    `);
    console.log('📋 Tabelle presenti:', tables.rows.map(r => r.table_name));

    // Controlla struttura tabella users
    const userColumns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('👤 Colonne tabella users:');
    userColumns.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : ''} default=${col.column_default}`);
    });

    // Controlla dati utente Giacomo
    const userData = await client.query('SELECT id, email, password_hash, password_salt, status, email_verified, email_verified_at, first_name, last_name FROM users WHERE email = $1', ['giacomo.cavalcabo14@gmail.com']);
    if (userData.rows.length > 0) {
      const user = userData.rows[0];
      console.log('👤 Dati Giacomo:', {
        id: user.id,
        email: user.email,
        hasPasswordHash: !!user.password_hash,
        hasPasswordSalt: !!user.password_salt,
        passwordHashLength: user.password_hash ? user.password_hash.length : 0,
        passwordSaltLength: user.password_salt ? user.password_salt.length : 0,
        status: user.status,
        emailVerified: user.email_verified,
        emailVerifiedAt: user.email_verified_at,
        firstName: user.first_name,
        lastName: user.last_name
      });
    } else {
      console.log('❌ Utente Giacomo non trovato');
    }

    // Controlla se ci sono organizzazioni
    const orgs = await client.query('SELECT COUNT(*) as count FROM organizations');
    console.log('🏢 Numero organizzazioni:', orgs.rows[0].count);

    // Controlla membership dell'utente
    if (userData.rows.length > 0) {
      const memberships = await client.query('SELECT * FROM org_memberships WHERE user_id = $1', [userData.rows[0].id]);
      console.log('🔗 Memberships Giacomo:', memberships.rows.length);
      memberships.rows.forEach(m => console.log('  - Org:', m.org_id, 'Role:', m.role));
    }

    await client.end();
  } catch (err) {
    console.log('❌ Errore:', err.message);
    console.log('Stack:', err.stack);
  }
}

checkDatabase();