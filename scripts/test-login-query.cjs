const { Client } = require('pg');
const { pbkdf2Sync, timingSafeEqual } = require('crypto');
require('dotenv').config();

const client = new Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false }
});

function verifyPassword(password, storedHash, storedSalt) {
  try {
    const saltBytes = Buffer.from(storedSalt, 'hex');
    const computedHash = pbkdf2Sync(password, saltBytes, 100000, 64, 'sha256').toString('hex');
    return timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch (error) {
    console.error('Errore verifica password:', error.message);
    return false;
  }
}

async function testLoginQuery() {
  try {
    await client.connect();
    console.log('✅ Connesso a Supabase\n');
    
    const email = 'giacomocavalcabo13@gmail.com';
    const password = 'password';
    
    // Replica esatta della query di login
    console.log('🔍 Eseguendo query di login...');
    const userResult = await client.query(`
      SELECT u.id, u.email, u.phone, u.first_name, u.last_name, u.password_salt, u.password_hash,
             u.email_verified, u.email_verified_at, u.oauth_provider, u.oauth_id,
             u.reset_token, u.reset_token_expires, u.status, u.created_at, u.updated_at,
             u.role as user_role, om.role as membership_role, o.id as org_id, o.legal_name, 
             COALESCE(o.type, o.org_type::text, 'buyer') as org_type
      FROM users u
      LEFT JOIN org_memberships om ON u.id = om.user_id AND om.is_active = true
      LEFT JOIN organizations o ON om.org_id = o.id
      WHERE u.email = $1 AND u.status = 'ACTIVE'
    `, [email]);
    
    console.log('📊 Risultati query:');
    console.log('  - Righe trovate:', userResult.rows.length);
    
    if (userResult.rows.length === 0) {
      console.log('❌ Nessun utente trovato');
      await client.end();
      return;
    }
    
    const user = userResult.rows[0];
    console.log('  - ID:', user.id);
    console.log('  - Email:', user.email);
    console.log('  - Status:', user.status);
    console.log('  - Has password_hash:', !!user.password_hash);
    console.log('  - Has password_salt:', !!user.password_salt);
    console.log('  - password_hash type:', typeof user.password_hash);
    console.log('  - password_salt type:', typeof user.password_salt);
    console.log('  - password_hash length:', user.password_hash?.length || 0);
    console.log('  - password_salt length:', user.password_salt?.length || 0);
    
    if (!user.password_hash || !user.password_salt) {
      console.log('❌ Password hash o salt mancanti nella query!');
      await client.end();
      return;
    }
    
    // Test verifica password
    console.log('\n🔐 Test verifica password...');
    let passwordValid = false;
    
    if (user.password_salt && user.password_hash) {
      console.log('  - Usando PBKDF2...');
      passwordValid = verifyPassword(password, user.password_hash, user.password_salt);
      console.log('  - Risultato:', passwordValid ? '✅ VALIDA' : '❌ NON VALIDA');
    } else if (user.password_hash) {
      console.log('  - Salt mancante, usando bcrypt...');
      // Non testiamo bcrypt qui
    } else {
      console.log('  - ❌ Nessun hash trovato');
    }
    
    if (passwordValid) {
      console.log('\n✅ Login dovrebbe funzionare!');
      console.log('  - User role:', user.user_role);
      console.log('  - Membership role:', user.membership_role);
      console.log('  - Org ID:', user.org_id);
      console.log('  - Org name:', user.legal_name);
      console.log('  - Org type:', user.org_type);
    } else {
      console.log('\n❌ Login fallirà - password non valida');
    }
    
    await client.end();
  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error('Stack:', error.stack?.split('\n').slice(0, 10).join('\n'));
    process.exit(1);
  }
}

testLoginQuery();

