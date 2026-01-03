const { Client } = require("pg");
require("dotenv").config({ path: ".env.local" });

const client = new Client({
  host: process.env.PGHOST,
  port: process.env.PGPORT || 6543,
  database: process.env.PGDATABASE || "postgres",
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function checkAnomalies() {
  try {
    await client.connect();
    console.log("✅ Connesso a Supabase\n");

    // 1. Controlla utenti senza organizzazioni
    console.log("🔍 1. Utenti senza organizzazioni:");
    const orphanedUsers = await client.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.status
      FROM users u
      LEFT JOIN org_memberships om ON u.id = om.user_id AND om.is_active = true
      WHERE om.id IS NULL AND u.status = 'ACTIVE'
      ORDER BY u.email
    `);
    console.log(`   Trovati ${orphanedUsers.rows.length} utenti orfani`);
    if (orphanedUsers.rows.length > 0) {
      orphanedUsers.rows.forEach((u) => {
        console.log(`   - ${u.email} (${u.id})`);
      });
    }
    console.log("");

    // 2. Controlla utente specifico (giacomo.cavalcabo14@gmail.com)
    console.log("🔍 2. Dettagli utente giacomo.cavalcabo14@gmail.com:");
    const userCheck = await client.query(
      `
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.status,
        om.id as membership_id, om.role as membership_role, om.is_active as membership_active,
        o.id as org_id, o.legal_name, o.type as org_type, o.org_type as org_type_legacy
      FROM users u
      LEFT JOIN org_memberships om ON u.id = om.user_id
      LEFT JOIN organizations o ON om.org_id = o.id
      WHERE u.email = $1
      ORDER BY om.is_active DESC, om.created_at DESC
    `,
      ["giacomo.cavalcabo14@gmail.com"],
    );

    if (userCheck.rows.length === 0) {
      console.log("   ❌ Utente non trovato!");
    } else {
      console.log(`   ✅ Trovati ${userCheck.rows.length} record(s)`);
      userCheck.rows.forEach((row, idx) => {
        console.log(`   Record ${idx + 1}:`);
        console.log(`     User ID: ${row.id}`);
        console.log(`     Status: ${row.status}`);
        console.log(`     Membership ID: ${row.membership_id || "NULL"}`);
        console.log(`     Membership Role: ${row.membership_role || "NULL"}`);
        console.log(
          `     Membership Active: ${row.membership_active || "NULL"}`,
        );
        console.log(`     Org ID: ${row.org_id || "NULL"}`);
        console.log(`     Org Name: ${row.legal_name || "NULL"}`);
        console.log(
          `     Org Type: ${row.org_type || row.org_type_legacy || "NULL"}`,
        );
        console.log("");
      });
    }

    // 3. Controlla organizzazione lenzi-org-id
    console.log("🔍 3. Dettagli organizzazione lenzi-org-id:");
    const orgCheck = await client.query(
      `
      SELECT 
        o.id, o.legal_name, o.type, o.org_type, o.status,
        COUNT(om.id) as membership_count,
        COUNT(CASE WHEN om.is_active = true THEN 1 END) as active_membership_count
      FROM organizations o
      LEFT JOIN org_memberships om ON o.id = om.org_id
      WHERE o.id = $1
      GROUP BY o.id, o.legal_name, o.type, o.org_type, o.status
    `,
      ["lenzi-org-id"],
    );

    if (orgCheck.rows.length === 0) {
      console.log("   ❌ Organizzazione non trovata!");
    } else {
      const org = orgCheck.rows[0];
      console.log(`   ✅ Organizzazione trovata:`);
      console.log(`     ID: ${org.id}`);
      console.log(`     Name: ${org.legal_name}`);
      console.log(`     Type: ${org.type || org.org_type || "NULL"}`);
      console.log(`     Status: ${org.status || "NULL"}`);
      console.log(`     Total Memberships: ${org.membership_count}`);
      console.log(`     Active Memberships: ${org.active_membership_count}`);
      console.log("");
    }

    // 4. Controlla membership attive per lenzi-org-id
    console.log("🔍 4. Membership attive per lenzi-org-id:");
    const memberships = await client.query(
      `
      SELECT 
        om.id, om.user_id, om.role, om.is_active, om.created_at,
        u.email, u.first_name, u.last_name, u.status as user_status
      FROM org_memberships om
      JOIN users u ON om.user_id = u.id
      WHERE om.org_id = $1 AND om.is_active = true
      ORDER BY om.created_at
    `,
      ["lenzi-org-id"],
    );

    console.log(`   Trovate ${memberships.rows.length} membership attive`);
    memberships.rows.forEach((m) => {
      console.log(
        `   - ${m.email} (${m.user_id}) - Role: ${m.role || "NULL"} - User Status: ${m.user_status}`,
      );
    });
    console.log("");

    // 5. Controlla rate cards per lenzi-org-id
    console.log("🔍 5. Rate cards per lenzi-org-id:");
    const rateCards = await client.query(
      `
      SELECT 
        id, seller_org_id, service_type, is_active, 
        base_rate_per_ha_cents, min_charge_cents,
        created_at, updated_at
      FROM rate_cards
      WHERE seller_org_id = $1
      ORDER BY service_type
    `,
      ["lenzi-org-id"],
    );

    console.log(`   Trovate ${rateCards.rows.length} rate cards`);
    rateCards.rows.forEach((rc) => {
      console.log(
        `   - ${rc.service_type} (ID: ${rc.id}) - Active: ${rc.is_active} - Base Rate: ${rc.base_rate_per_ha_cents} centesimi`,
      );
    });
    console.log("");

    // 6. Controlla valori enum OrgRole
    console.log("🔍 6. Valori enum OrgRole disponibili:");
    const enumValues = await client.query(`
      SELECT 
        unnest(enum_range(NULL::"OrgRole"))::text as role_value
      ORDER BY role_value
    `);

    console.log(
      `   Valori enum trovati: ${enumValues.rows.map((r) => r.role_value).join(", ")}`,
    );
    console.log("");

    // 6b. Controlla ruoli effettivi usati
    console.log("🔍 6b. Ruoli effettivamente usati nelle membership:");
    const actualRoles = await client.query(`
      SELECT 
        om.role::text as role_value,
        COUNT(*) as count,
        STRING_AGG(DISTINCT o.type::text, ', ') as org_types
      FROM org_memberships om
      JOIN organizations o ON om.org_id = o.id
      WHERE om.is_active = true
      GROUP BY om.role
      ORDER BY count DESC
    `);

    actualRoles.rows.forEach((r) => {
      console.log(
        `   - ${r.role_value}: ${r.count} membership (org types: ${r.org_types})`,
      );
    });
    console.log("");

    // 6c. Controlla ruolo specifico per giacomo.cavalcabo14@gmail.com e lenzi-org-id
    console.log(
      "🔍 6c. Ruolo esatto per giacomo.cavalcabo14@gmail.com in lenzi-org-id:",
    );
    const userRoleCheck = await client.query(
      `
      SELECT 
        u.id, u.email,
        om.role::text as membership_role_raw,
        LOWER(om.role::text) as membership_role_lower,
        o.type as org_type
      FROM users u
      JOIN org_memberships om ON u.id = om.user_id
      JOIN organizations o ON om.org_id = o.id
      WHERE u.email = $1 AND om.org_id = $2 AND om.is_active = true
    `,
      ["giacomo.cavalcabo14@gmail.com", "lenzi-org-id"],
    );

    if (userRoleCheck.rows.length > 0) {
      const ur = userRoleCheck.rows[0];
      console.log(`   Role RAW (dal DB): "${ur.membership_role_raw}"`);
      console.log(`   Role LOWER: "${ur.membership_role_lower}"`);
      console.log(`   Org Type: "${ur.org_type}"`);
      console.log(
        `   ⚠️  PROBLEMA POTENZIALE: Il ruolo nel DB è in MAIUSCOLO, ma il codice potrebbe aspettarsi minuscolo!`,
      );
    } else {
      console.log("   ❌ Nessuna membership attiva trovata");
    }
    console.log("");

    // 7. Controlla se ci sono colonne mancanti nella tabella users (role)
    console.log('🔍 7. Controllo colonna "role" in users:');
    const userColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'role'
    `);

    if (userColumns.rows.length === 0) {
      console.log('   ⚠️  Colonna "role" NON esiste nella tabella users');
    } else {
      console.log(
        `   ✅ Colonna "role" esiste: ${userColumns.rows[0].data_type}, nullable: ${userColumns.rows[0].is_nullable}`,
      );
    }
    console.log("");

    // 8. Controlla token JWT e verifica struttura
    console.log("🔍 8. Riepilogo struttura organizzazione lenzi-org-id:");
    const summary = await client.query(
      `
      SELECT 
        o.id as org_id,
        o.legal_name,
        COALESCE(o.type::text, o.org_type::text, 'NULL') as org_type,
        COUNT(DISTINCT om.user_id) FILTER (WHERE om.is_active = true) as active_users,
        COUNT(DISTINCT rc.id) as rate_cards_count,
        COUNT(DISTINCT sc.id) as service_configs_count
      FROM organizations o
      LEFT JOIN org_memberships om ON o.id = om.org_id
      LEFT JOIN rate_cards rc ON o.id = rc.seller_org_id
      LEFT JOIN service_configurations sc ON o.id = sc.org_id
      WHERE o.id = $1
      GROUP BY o.id, o.legal_name, o.type, o.org_type
    `,
      ["lenzi-org-id"],
    );

    if (summary.rows.length > 0) {
      const s = summary.rows[0];
      console.log(`   Organizzazione: ${s.legal_name} (${s.org_id})`);
      console.log(`   Tipo: ${s.org_type}`);
      console.log(`   Utenti attivi: ${s.active_users}`);
      console.log(`   Rate cards: ${s.rate_cards_count}`);
      console.log(`   Service configs: ${s.service_configs_count}`);
    }
    console.log("");

    // 9. Controlla se ci sono problemi con le membership duplicate o inattive
    console.log(
      "🔍 9. Membership duplicate o problematiche per giacomo.cavalcabo14@gmail.com:",
    );
    const duplicateMemberships = await client.query(
      `
      SELECT 
        om.id, om.user_id, om.org_id, om.role, om.is_active, om.created_at,
        u.email,
        o.legal_name
      FROM org_memberships om
      JOIN users u ON om.user_id = u.id
      JOIN organizations o ON om.org_id = o.id
      WHERE u.email = $1
      ORDER BY om.org_id, om.is_active DESC, om.created_at DESC
    `,
      ["giacomo.cavalcabo14@gmail.com"],
    );

    console.log(
      `   Trovate ${duplicateMemberships.rows.length} membership totali`,
    );
    duplicateMemberships.rows.forEach((m, idx) => {
      console.log(
        `   ${idx + 1}. Org: ${m.legal_name} (${m.org_id}) - Role: ${m.role || "NULL"} - Active: ${m.is_active} - Created: ${m.created_at}`,
      );
    });
  } catch (error) {
    console.error("❌ Errore:", error.message);
    console.error(error.stack);
  } finally {
    await client.end();
    console.log("\n✅ Connessione chiusa");
  }
}

checkAnomalies();
