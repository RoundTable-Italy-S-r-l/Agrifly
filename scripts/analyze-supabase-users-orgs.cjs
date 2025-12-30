const { Client } = require('pg');
require('dotenv').config();

const config = {
  host: process.env.PGHOST || 'aws-1-eu-central-2.pooler.supabase.com',
  port: Number(process.env.PGPORT || 6543),
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER || 'postgres.fzowfkfwriajohjjboed',
  password: process.env.PGPASSWORD || '_Mszqe_%uF_82%@',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
};

async function analyzeSupabase() {
  const client = new Client(config);
  
  try {
    await client.connect();
    console.log('✅ Connesso a Supabase\n');
    console.log('='.repeat(100));
    console.log('📊 PANORAMICA UTENTI, RUOLI, PERMESSI E ORGANIZZAZIONI SU SUPABASE');
    console.log('='.repeat(100));
    console.log('');
    
    // 1. Organizzazioni
    console.log('🏢 ORGANIZZAZIONI');
    console.log('-'.repeat(100));
    const orgsResult = await client.query(`
      SELECT 
        id,
        legal_name,
        COALESCE(type::text, org_type::text, 'buyer') as org_type,
        status,
        is_certified,
        created_at
      FROM organizations
      ORDER BY created_at DESC
    `);
    
    console.log(`\nTotale organizzazioni: ${orgsResult.rows.length}\n`);
    
    for (const org of orgsResult.rows) {
      console.log(`  📋 ${org.legal_name} (${org.id})`);
      console.log(`     Type: ${org.org_type}`);
      console.log(`     Status: ${org.status || 'N/A'}`);
      console.log(`     Certificata: ${org.is_certified ? 'Sì' : 'No'}`);
      console.log(`     Creata: ${org.created_at}`);
      console.log('');
    }
    
    // 2. Utenti con membri
    console.log('\n👥 UTENTI E MEMBRI DELLE ORGANIZZAZIONI');
    console.log('-'.repeat(100));
    
    const usersMembersResult = await client.query(`
      SELECT 
        u.id as user_id,
        u.email,
        u.first_name,
        u.last_name,
        u.role as user_role,
        u.email_verified,
        u.created_at as user_created_at,
        om.id as membership_id,
        om.org_id,
        om.role as membership_role,
        om.is_active,
        o.legal_name as org_name,
        COALESCE(o.type::text, o.org_type::text, 'buyer') as org_type
      FROM users u
      LEFT JOIN org_memberships om ON u.id = om.user_id
      LEFT JOIN organizations o ON om.org_id = o.id
      ORDER BY u.created_at DESC, o.legal_name
    `);
    
    console.log(`\nTotale utenti: ${new Set(usersMembersResult.rows.map(r => r.user_id)).size}\n`);
    
    // Raggruppa per utente
    const usersMap = new Map();
    for (const row of usersMembersResult.rows) {
      if (!usersMap.has(row.user_id)) {
        usersMap.set(row.user_id, {
          id: row.user_id,
          email: row.email,
          first_name: row.first_name,
          last_name: row.last_name,
          user_role: row.user_role,
          email_verified: row.email_verified,
          created_at: row.user_created_at,
          memberships: []
        });
      }
      
      if (row.membership_id) {
        usersMap.get(row.user_id).memberships.push({
          membership_id: row.membership_id,
          org_id: row.org_id,
          org_name: row.org_name,
          org_type: row.org_type,
          role: row.membership_role,
          is_active: row.is_active
        });
      }
    }
    
    for (const [userId, user] of usersMap) {
      console.log(`  👤 ${user.first_name || ''} ${user.last_name || ''} (${user.email})`);
      console.log(`     User ID: ${user.id}`);
      console.log(`     User Role (u.role): ${user.user_role || 'NULL'}`);
      console.log(`     Email verificata: ${user.email_verified ? 'Sì' : 'No'}`);
      console.log(`     Creato: ${user.created_at}`);
      
      if (user.memberships.length === 0) {
        console.log(`     ⚠️  Nessuna organizzazione associata`);
      } else {
        console.log(`     Membri di ${user.memberships.length} organizzazione/i:`);
        for (const mem of user.memberships) {
          console.log(`       - ${mem.org_name} (${mem.org_id})`);
          console.log(`         Tipo org: ${mem.org_type}`);
          console.log(`         Ruolo membro (om.role): ${mem.role || 'NULL'}`);
          console.log(`         Attivo: ${mem.is_active ? 'Sì' : 'No'}`);
        }
      }
      console.log('');
    }
    
    // 3. Riepilogo ruoli
    console.log('\n📋 RIEPILOGO RUOLI');
    console.log('-'.repeat(100));
    
    // Ruoli utente (u.role)
    const userRolesResult = await client.query(`
      SELECT 
        COALESCE(role, 'NULL') as role,
        COUNT(*) as count
      FROM users
      GROUP BY role
      ORDER BY count DESC
    `);
    
    console.log('\n  🔹 Ruoli utente (users.role):');
    for (const row of userRolesResult.rows) {
      console.log(`     ${row.role}: ${row.count} utenti`);
    }
    
    // Ruoli membri (om.role)
    const memberRolesResult = await client.query(`
      SELECT 
        om.role::text as role,
        COALESCE(o.type::text, o.org_type::text, 'buyer') as org_type,
        COUNT(*) as count
      FROM org_memberships om
      JOIN organizations o ON om.org_id = o.id
      GROUP BY om.role, COALESCE(o.type::text, o.org_type::text, 'buyer')
      ORDER BY org_type, count DESC
    `);
    
    console.log('\n  🔹 Ruoli membri (org_memberships.role) per tipo organizzazione:');
    const rolesByOrgType = {};
    for (const row of memberRolesResult.rows) {
      if (!rolesByOrgType[row.org_type]) {
        rolesByOrgType[row.org_type] = [];
      }
      rolesByOrgType[row.org_type].push(`${row.role}: ${row.count}`);
    }
    
    for (const [orgType, roles] of Object.entries(rolesByOrgType)) {
      console.log(`     Tipo org: ${orgType}`);
      for (const roleInfo of roles) {
        console.log(`       - ${roleInfo}`);
      }
    }
    
    // 4. Tipi organizzazione
    console.log('\n  🔹 Tipi organizzazione:');
    const orgTypesResult = await client.query(`
      SELECT 
        COALESCE(type::text, org_type::text, 'buyer') as org_type,
        COUNT(*) as count
      FROM organizations
      GROUP BY COALESCE(type::text, org_type::text, 'buyer')
      ORDER BY count DESC
    `);
    
    for (const row of orgTypesResult.rows) {
      console.log(`     ${row.org_type}: ${row.count} organizzazioni`);
    }
    
    // 5. Problemi/Inconsistenze
    console.log('\n⚠️  INCONSISTENZE E PROBLEMI');
    console.log('-'.repeat(100));
    
    // Utenti senza organizzazioni
    const usersWithoutOrgs = await client.query(`
      SELECT u.id, u.email
      FROM users u
      LEFT JOIN org_memberships om ON u.id = om.user_id
      WHERE om.id IS NULL
    `);
    
    if (usersWithoutOrgs.rows.length > 0) {
      console.log(`\n  ⚠️  Utenti senza organizzazioni: ${usersWithoutOrgs.rows.length}`);
      for (const user of usersWithoutOrgs.rows) {
        console.log(`     - ${user.email} (${user.id})`);
      }
    }
    
    // Organizzazioni senza membri
    const orgsWithoutMembers = await client.query(`
      SELECT o.id, o.legal_name
      FROM organizations o
      LEFT JOIN org_memberships om ON o.id = om.org_id
      WHERE om.id IS NULL
    `);
    
    if (orgsWithoutMembers.rows.length > 0) {
      console.log(`\n  ⚠️  Organizzazioni senza membri: ${orgsWithoutMembers.rows.length}`);
      for (const org of orgsWithoutMembers.rows) {
        console.log(`     - ${org.legal_name} (${org.id})`);
      }
    }
    
    // Membri inattivi
    const inactiveMembers = await client.query(`
      SELECT om.id, u.email, o.legal_name, om.role
      FROM org_memberships om
      JOIN users u ON om.user_id = u.id
      JOIN organizations o ON om.org_id = o.id
      WHERE om.is_active = false
    `);
    
    if (inactiveMembers.rows.length > 0) {
      console.log(`\n  ⚠️  Membri inattivi: ${inactiveMembers.rows.length}`);
      for (const mem of inactiveMembers.rows) {
        console.log(`     - ${mem.email} in ${mem.legal_name} (ruolo: ${mem.role})`);
      }
    }
    
    await client.end();
    
    console.log('\n' + '='.repeat(100));
    console.log('✅ Analisi completata');
    console.log('='.repeat(100));
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error(error.stack);
    if (client) await client.end();
    process.exit(1);
  }
}

analyzeSupabase();

