import { Client } from 'pg';

const client = new Client({
  host: 'aws-1-eu-central-2.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.fzowfkfwriajohjjboed',
  password: '66tY3_C_%5iAR8c',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000,
});

async function checkDataConsistency() {
  try {
    await client.connect();
    console.log('✅ Connesso al database\n');

    // 1. Utenti con password_hash ma senza password_salt
    console.log('🔍 Verifica coerenza password...');
    const passwordIssues = await client.query(`
      SELECT id, email, 
             CASE WHEN password_hash IS NOT NULL AND password_salt IS NULL THEN 'hash senza salt' 
                  WHEN password_hash IS NULL AND password_salt IS NOT NULL THEN 'salt senza hash'
                  WHEN password_hash IS NOT NULL AND password_salt IS NOT NULL THEN 'OK'
                  ELSE 'nessuna password' END as status
      FROM users
      WHERE (password_hash IS NOT NULL AND password_salt IS NULL)
         OR (password_hash IS NULL AND password_salt IS NOT NULL)
    `);
    
    if (passwordIssues.rows.length > 0) {
      console.log(`  ⚠️  Trovati ${passwordIssues.rows.length} utenti con problemi password:`);
      passwordIssues.rows.forEach(u => {
        console.log(`    - ${u.email}: ${u.status}`);
      });
    } else {
      console.log('  ✅ Tutti gli utenti hanno password coerenti');
    }

    // 2. Utenti senza membership
    console.log('\n🔍 Verifica utenti senza membership...');
    const usersWithoutMembership = await client.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.created_at
      FROM users u
      LEFT JOIN org_memberships om ON u.id = om.user_id AND om.is_active = true
      WHERE om.id IS NULL
    `);
    
    if (usersWithoutMembership.rows.length > 0) {
      console.log(`  ⚠️  Trovati ${usersWithoutMembership.rows.length} utenti senza membership attiva:`);
      usersWithoutMembership.rows.forEach(u => {
        console.log(`    - ${u.email} (${u.first_name} ${u.last_name}) - Creato: ${u.created_at}`);
      });
    } else {
      console.log('  ✅ Tutti gli utenti hanno almeno una membership attiva');
    }

    // 3. Memberships senza organizzazione valida
    console.log('\n🔍 Verifica memberships orfane...');
    const orphanMemberships = await client.query(`
      SELECT om.id, om.user_id, om.org_id, om.role
      FROM org_memberships om
      LEFT JOIN organizations o ON om.org_id = o.id
      WHERE o.id IS NULL
    `);
    
    if (orphanMemberships.rows.length > 0) {
      console.log(`  ❌ Trovate ${orphanMemberships.rows.length} memberships orfane (org non esiste):`);
      orphanMemberships.rows.forEach(m => {
        console.log(`    - Membership ${m.id} per org ${m.org_id} (non esiste)`);
      });
    } else {
      console.log('  ✅ Tutte le memberships hanno organizzazioni valide');
    }

    // 4. Verification codes scaduti e non usati
    console.log('\n🔍 Verifica verification codes scaduti...');
    const expiredCodes = await client.query(`
      SELECT COUNT(*) as count
      FROM verification_codes
      WHERE expires_at < NOW() AND used = false
    `);
    console.log(`  📧 Verification codes scaduti e non usati: ${expiredCodes.rows[0].count}`);

    // 5. Statistiche generali
    console.log('\n📊 STATISTICHE GENERALI:');
    const stats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE email_verified = true) as verified_users,
        (SELECT COUNT(*) FROM users WHERE password_hash IS NOT NULL) as users_with_password,
        (SELECT COUNT(*) FROM organizations) as total_orgs,
        (SELECT COUNT(*) FROM org_memberships WHERE is_active = true) as active_memberships,
        (SELECT COUNT(*) FROM verification_codes WHERE used = false AND expires_at > NOW()) as active_codes
    `);
    
    const s = stats.rows[0];
    console.log(`  Utenti totali: ${s.total_users}`);
    console.log(`  Utenti verificati: ${s.verified_users}`);
    console.log(`  Utenti con password: ${s.users_with_password}`);
    console.log(`  Organizzazioni: ${s.total_orgs}`);
    console.log(`  Memberships attive: ${s.active_memberships}`);
    console.log(`  Verification codes attivi: ${s.active_codes}`);

    // 6. Dettaglio utente Giacomo
    console.log('\n👤 DETTAGLIO UTENTE GIACOMO:');
    const giacomo = await client.query(`
      SELECT u.*, 
             COUNT(DISTINCT om.id) as membership_count,
             COUNT(DISTINCT vc.id) FILTER (WHERE vc.used = false AND vc.expires_at > NOW()) as active_codes
      FROM users u
      LEFT JOIN org_memberships om ON u.id = om.user_id
      LEFT JOIN verification_codes vc ON u.id = vc.user_id
      WHERE u.email = 'giacomo.cavalcabo14@gmail.com'
      GROUP BY u.id
    `);
    
    if (giacomo.rows.length > 0) {
      const g = giacomo.rows[0];
      console.log(`  Email: ${g.email}`);
      console.log(`  Nome: ${g.first_name} ${g.last_name}`);
      console.log(`  Status: ${g.status}`);
      console.log(`  Email verified: ${g.email_verified}`);
      console.log(`  Password: ${g.password_hash ? '✅ presente' : '❌ mancante'}`);
      console.log(`  Password salt: ${g.password_salt ? '✅ presente' : '❌ mancante'}`);
      console.log(`  Memberships: ${g.membership_count}`);
      console.log(`  Verification codes attivi: ${g.active_codes}`);
    }

    console.log('\n✅ Verifica coerenza completata!');

  } catch (err) {
    console.error('❌ Errore:', err.message);
    console.error('Stack:', err.stack);
  } finally {
    await client.end();
  }
}

checkDataConsistency();
