const { Client } = require('pg');
const { randomBytes, pbkdf2Sync } = require('crypto');
require('dotenv').config();

const client = new Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false }
});

function hashPassword(password) {
  const saltBytes = randomBytes(16);
  const salt = saltBytes.toString('hex');
  const hash = pbkdf2Sync(password, saltBytes, 100000, 64, 'sha256').toString('hex');
  return { salt, hash };
}

async function setupUser() {
  try {
    await client.connect();
    console.log('✅ Connesso a Supabase\n');
    
    const email = 'giacomocavalcabo13@gmail.com';
    const password = 'password';
    
    // 1. Trova utente
    const userResult = await client.query('SELECT id, email FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      console.log('❌ Utente non trovato');
      await client.end();
      return;
    }
    const userId = userResult.rows[0].id;
    console.log('✅ Utente trovato:', userId);
    
    // 2. Reset password
    const { salt, hash } = hashPassword(password);
    await client.query(
      'UPDATE users SET password_hash = $1, password_salt = $2 WHERE id = $3',
      [hash, salt, userId]
    );
    console.log('✅ Password resettata:', password);
    
    // 3. Trova o crea organizzazione SSSUP
    let orgResult = await client.query('SELECT id, legal_name FROM organizations WHERE legal_name ILIKE $1', ['%SSSUP%']);
    let orgId;
    
    if (orgResult.rows.length === 0) {
      console.log('📦 Creando organizzazione SSSUP...');
      const orgIdGen = 'org_' + Date.now().toString(36);
      await client.query(
        'INSERT INTO organizations (id, legal_name, org_type, type, status, country) VALUES ($1, $2, $3, $4, $5, $6)',
        [orgIdGen, 'SSSUP', 'buyer', 'buyer', 'ACTIVE', 'IT']
      );
      orgId = orgIdGen;
      console.log('✅ Organizzazione creata:', orgId);
    } else {
      orgId = orgResult.rows[0].id;
      console.log('✅ Organizzazione trovata:', orgId, orgResult.rows[0].legal_name);
    }
    
    // 4. Verifica o crea membership come ADMIN
    const membershipCheck = await client.query(
      'SELECT id, role, is_active FROM org_memberships WHERE user_id = $1 AND org_id = $2',
      [userId, orgId]
    );
    
    if (membershipCheck.rows.length === 0) {
      console.log('📝 Creando membership come ADMIN...');
      await client.query(
        'INSERT INTO org_memberships (org_id, user_id, role, is_active) VALUES ($1, $2, $3, $4)',
        [orgId, userId, 'ADMIN', true]
      );
      console.log('✅ Membership creata come ADMIN');
    } else {
      const membership = membershipCheck.rows[0];
      if (membership.role !== 'ADMIN' || !membership.is_active) {
        console.log('🔄 Aggiornando membership a ADMIN...');
        await client.query(
          'UPDATE org_memberships SET role = $1, is_active = $2 WHERE id = $3',
          ['ADMIN', true, membership.id]
        );
        console.log('✅ Membership aggiornata a ADMIN');
      } else {
        console.log('✅ Membership già esistente come ADMIN');
      }
    }
    
    // 5. Verifica setup finale
    const finalCheck = await client.query(`
      SELECT 
        u.email, u.first_name, u.last_name,
        o.legal_name, om.role, om.is_active
      FROM users u
      JOIN org_memberships om ON u.id = om.user_id
      JOIN organizations o ON om.org_id = o.id
      WHERE u.email = $1 AND o.id = $2
    `, [email, orgId]);
    
    if (finalCheck.rows.length > 0) {
      const check = finalCheck.rows[0];
      console.log('\n✅ Setup completato:');
      console.log('  Utente:', check.email);
      console.log('  Nome:', check.first_name, check.last_name);
      console.log('  Organizzazione:', check.legal_name);
      console.log('  Ruolo:', check.role);
      console.log('  Attivo:', check.is_active);
    }
    
    await client.end();
  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

setupUser();

