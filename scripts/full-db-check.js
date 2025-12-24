import { Client } from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carica .env dalla root del progetto
dotenv.config({ path: join(__dirname, '../.env') });

const client = new Client({
  host: process.env.PGHOST || process.env.DATABASE_URL?.match(/@([^:]+)/)?.[1],
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER || process.env.DATABASE_URL?.match(/:\/\/([^:]+):/)?.[1],
  password: process.env.PGPASSWORD || process.env.DATABASE_URL?.match(/:\/\/[^:]+:([^@]+)@/)?.[1]?.replace(/%5/g, '%'),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000,
});

async function fullCheck() {
  try {
    await client.connect();
    console.log('✅ Connesso al database\n');

    // 1. Verifica colonne tabella users
    console.log('📋 STRUTTURA TABELLA USERS:');
    const userCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    userCols.rows.forEach(col => {
      console.log(`  ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${col.column_default ? `default: ${col.column_default}` : ''}`);
    });

    // 2. Verifica constraint su users
    console.log('\n🔒 CONSTRAINT SU USERS:');
    const constraints = await client.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'users'::regclass
      ORDER BY conname
    `);
    if (constraints.rows.length > 0) {
      constraints.rows.forEach(c => {
        console.log(`  ${c.conname}: ${c.definition}`);
      });
    } else {
      console.log('  Nessun constraint trovato');
    }

    // 3. Verifica enum types
    console.log('\n🔍 ENUM TYPES NEL DATABASE:');
    const enums = await client.query(`
      SELECT DISTINCT t.typname as enum_name
      FROM pg_type t 
      WHERE t.typname IN ('userstatus', 'orgrole', 'orgtype', 'orgstatus', 'verificationpurpose')
      ORDER BY t.typname
    `);
    if (enums.rows.length > 0) {
      for (const enumRow of enums.rows) {
        const values = await client.query(`
          SELECT e.enumlabel as value
          FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = $1
          ORDER BY e.enumsortorder
        `, [enumRow.enum_name]);
        console.log(`  ${enumRow.enum_name}: ${values.rows.map(v => v.value).join(', ')}`);
      }
    } else {
      console.log('  ⚠️  Nessun enum type trovato - probabilmente usano VARCHAR con CHECK constraints');
    }

    // 4. Verifica CHECK constraints su colonne enum
    console.log('\n🔍 CHECK CONSTRAINTS SU COLONNE ENUM:');
    const checks = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE contype = 'c' 
      AND conrelid = 'users'::regclass
      ORDER BY conname
    `);
    if (checks.rows.length > 0) {
      checks.rows.forEach(c => {
        console.log(`  ${c.conname}: ${c.definition}`);
      });
    } else {
      console.log('  Nessun CHECK constraint trovato su users');
    }

    // 5. Verifica dati utente Giacomo completo
    console.log('\n👤 DATI UTENTE GIACOMO:');
    const giacomo = await client.query(`
      SELECT id, email, first_name, last_name, phone, 
             password_hash, password_salt, 
             email_verified, email_verified_at,
             status, oauth_provider, oauth_id,
             reset_token, reset_token_expires,
             created_at, updated_at
      FROM users 
      WHERE email = $1
    `, ['giacomo.cavalcabo14@gmail.com']);
    
    if (giacomo.rows.length > 0) {
      const u = giacomo.rows[0];
      console.log(`  ID: ${u.id}`);
      console.log(`  Email: ${u.email}`);
      console.log(`  Nome: ${u.first_name} ${u.last_name}`);
      console.log(`  Phone: ${u.phone || 'NULL'}`);
      console.log(`  Password hash: ${u.password_hash ? `✅ (${u.password_hash.length} chars)` : '❌ NULL'}`);
      console.log(`  Password salt: ${u.password_salt ? `✅ (${u.password_salt.length} chars)` : '❌ NULL'}`);
      console.log(`  Email verified: ${u.email_verified}`);
      console.log(`  Email verified at: ${u.email_verified_at || 'NULL'}`);
      console.log(`  Status: ${u.status}`);
      console.log(`  OAuth: ${u.oauth_provider || 'NULL'}`);
      console.log(`  Created: ${u.created_at}`);
      console.log(`  Updated: ${u.updated_at}`);
    }

    // 6. Verifica membership di Giacomo
    console.log('\n🔗 MEMBERSHIPS DI GIACOMO:');
    const memberships = await client.query(`
      SELECT om.id, om.org_id, om.role, om.is_active, om.created_at,
             o.legal_name, o.org_type, o.status as org_status
      FROM org_memberships om
      JOIN organizations o ON om.org_id = o.id
      WHERE om.user_id = $1
      ORDER BY om.created_at
    `, [giacomo.rows[0]?.id]);
    
    if (memberships.rows.length > 0) {
      memberships.rows.forEach(m => {
        console.log(`  ✅ ${m.legal_name} (${m.org_type}) - Role: ${m.role} - Active: ${m.is_active}`);
      });
    } else {
      console.log('  ⚠️  Nessuna membership trovata');
    }

    // 7. Verifica organizzazioni
    console.log('\n🏢 ORGANIZZAZIONI:');
    const orgs = await client.query(`
      SELECT id, legal_name, org_type, status, created_at
      FROM organizations
      ORDER BY created_at
    `);
    console.log(`  Totale: ${orgs.rows.length}`);
    orgs.rows.forEach(o => {
      console.log(`  - ${o.legal_name} (${o.org_type}) - ${o.status}`);
    });

    // 8. Verifica verification_codes
    console.log('\n📧 VERIFICATION CODES (ultimi 5):');
    const codes = await client.query(`
      SELECT id, email, code, purpose, used, expires_at, created_at
      FROM verification_codes
      ORDER BY created_at DESC
      LIMIT 5
    `);
    codes.rows.forEach(c => {
      console.log(`  ${c.email} - ${c.purpose} - Code: ${c.code} - Used: ${c.used} - Expires: ${c.expires_at}`);
    });

    console.log('\n✅ Verifica completata');

  } catch (err) {
    console.error('❌ Errore:', err.message);
    console.error('Stack:', err.stack);
  } finally {
    await client.end();
  }
}

fullCheck();
