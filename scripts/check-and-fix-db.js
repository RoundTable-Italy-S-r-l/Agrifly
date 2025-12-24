import { Client } from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carica .env dalla root del progetto
dotenv.config({ path: join(__dirname, '../.env') });

const client = new Client({
  host: process.env.PGHOST || 'db.fzowfkfwriajohjjboed.supabase.co',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || process.env.DATABASE_URL?.match(/postgres:([^@]+)@/)?.[1]?.replace(/%5/g, '%'),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000,
});

async function checkAndFix() {
  try {
    console.log('🔄 Connessione al database...');
    await client.connect();
    console.log('✅ Connesso al database');

    // 1. Verifica tabelle esistenti
    console.log('\n📋 Verifica tabelle...');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'organizations', 'org_memberships', 'verification_codes')
      ORDER BY table_name
    `);
    console.log('Tabelle presenti:', tables.rows.map(r => r.table_name).join(', '));

    // 2. Verifica struttura tabella users
    console.log('\n👤 Verifica struttura tabella users...');
    const userColumns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    const requiredColumns = ['id', 'email', 'first_name', 'last_name', 'password_salt', 'password_hash', 'email_verified', 'status'];
    const existingColumns = userColumns.rows.map(c => c.column_name);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      console.log('❌ Colonne mancanti:', missingColumns);
    } else {
      console.log('✅ Tutte le colonne necessarie sono presenti');
    }

    // 3. Verifica enum types
    console.log('\n🔍 Verifica enum types...');
    const enums = await client.query(`
      SELECT t.typname as enum_name, e.enumlabel as enum_value
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      WHERE t.typname IN ('userstatus', 'orgrole', 'orgtype', 'orgstatus', 'verificationpurpose')
      ORDER BY t.typname, e.enumsortorder
    `);
    
    if (enums.rows.length === 0) {
      console.log('⚠️  Nessun enum type trovato - potrebbero essere usati CHECK constraints o VARCHAR');
    } else {
      const enumGroups = {};
      enums.rows.forEach(row => {
        if (!enumGroups[row.enum_name]) enumGroups[row.enum_name] = [];
        enumGroups[row.enum_name].push(row.enum_value);
      });
      console.log('Enum types trovati:');
      Object.entries(enumGroups).forEach(([name, values]) => {
        console.log(`  - ${name}: ${values.join(', ')}`);
      });
    }

    // 4. Verifica dati utente Giacomo
    console.log('\n👤 Verifica utente Giacomo...');
    const userData = await client.query(`
      SELECT id, email, password_hash, password_salt, status, email_verified, 
             first_name, last_name, created_at
      FROM users 
      WHERE email = $1
    `, ['giacomo.cavalcabo14@gmail.com']);
    
    if (userData.rows.length > 0) {
      const user = userData.rows[0];
      console.log('✅ Utente trovato:');
      console.log(`  - ID: ${user.id}`);
      console.log(`  - Email: ${user.email}`);
      console.log(`  - Nome: ${user.first_name} ${user.last_name}`);
      console.log(`  - Password hash: ${user.password_hash ? '✅ presente' : '❌ mancante'}`);
      console.log(`  - Password salt: ${user.password_salt ? '✅ presente' : '❌ mancante'}`);
      console.log(`  - Status: ${user.status}`);
      console.log(`  - Email verified: ${user.email_verified}`);
      console.log(`  - Creato: ${user.created_at}`);

      // Verifica membership
      const memberships = await client.query(`
        SELECT om.*, o.legal_name, o.org_type
        FROM org_memberships om
        JOIN organizations o ON om.org_id = o.id
        WHERE om.user_id = $1 AND om.is_active = true
      `, [user.id]);
      
      console.log(`\n🔗 Memberships attive: ${memberships.rows.length}`);
      memberships.rows.forEach(m => {
        console.log(`  - Org: ${m.legal_name} (${m.org_type}), Role: ${m.role}`);
      });
    } else {
      console.log('❌ Utente Giacomo non trovato');
    }

    // 5. Verifica organizzazioni
    console.log('\n🏢 Verifica organizzazioni...');
    const orgs = await client.query('SELECT COUNT(*) as count FROM organizations');
    console.log(`Totale organizzazioni: ${orgs.rows[0].count}`);

    // 6. Verifica constraint e indici
    console.log('\n🔒 Verifica constraint...');
    const constraints = await client.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'users'::regclass
      ORDER BY conname
    `);
    
    if (constraints.rows.length > 0) {
      console.log('Constraint su tabella users:');
      constraints.rows.forEach(c => {
        console.log(`  - ${c.conname}: ${c.definition}`);
      });
    }

    console.log('\n✅ Verifica completata');

  } catch (err) {
    console.error('❌ Errore:', err.message);
    console.error('Stack:', err.stack);
  } finally {
    await client.end();
    console.log('\n🔌 Connessione chiusa');
  }
}

checkAndFix();
