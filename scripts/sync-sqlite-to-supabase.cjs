const { Client } = require("pg");
const Database = require("better-sqlite3");
const path = require("path");
require("dotenv").config();

const supabaseConfig = {
  host: process.env.PGHOST || "aws-1-eu-central-2.pooler.supabase.com",
  port: Number(process.env.PGPORT || 6543),
  database: process.env.PGDATABASE || "postgres",
  user: process.env.PGUSER || "postgres.fzowfkfwriajohjjboed",
  password: process.env.PGPASSWORD || "_Mszqe_%uF_82%@",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
};

const sqlitePath = path.join(__dirname, "../prisma/dev.db");

async function syncSQLiteToSupabase() {
  const pgClient = new Client(supabaseConfig);
  let sqliteDb;

  try {
    await pgClient.connect();
    console.log("✅ Connesso a Supabase\n");

    sqliteDb = new Database(sqlitePath);
    console.log("✅ Connesso a SQLite\n");

    console.log("=".repeat(100));
    console.log("🔄 SINCRONIZZAZIONE SQLite → Supabase");
    console.log("=".repeat(100));
    console.log("");

    let deletedUsers = 0;
    let updatedUsers = 0;
    let updatedOrgs = 0;

    // 1. Elimina utenti senza organizzazioni
    console.log("🗑️  STEP 1: Eliminazione utenti senza organizzazioni");
    console.log("-".repeat(100));

    const usersWithoutOrgs = await pgClient.query(`
      SELECT u.id, u.email
      FROM users u
      LEFT JOIN org_memberships om ON u.id = om.user_id
      WHERE om.id IS NULL
    `);

    if (usersWithoutOrgs.rows.length > 0) {
      console.log(
        `\n  Trovati ${usersWithoutOrgs.rows.length} utenti senza organizzazioni:`,
      );
      for (const user of usersWithoutOrgs.rows) {
        console.log(`    - ${user.email} (${user.id})`);
      }

      // Elimina prima le membership orfane (se ci sono)
      for (const user of usersWithoutOrgs.rows) {
        await pgClient.query("DELETE FROM org_memberships WHERE user_id = $1", [
          user.id,
        ]);
      }

      // Poi elimina gli utenti
      for (const user of usersWithoutOrgs.rows) {
        await pgClient.query("DELETE FROM users WHERE id = $1", [user.id]);
        deletedUsers++;
        console.log(`  ✅ Eliminato: ${user.email}`);
      }
    } else {
      console.log("  ✅ Nessun utente senza organizzazioni da eliminare");
    }
    console.log("");

    // 2. Sincronizza users (SQLite → Supabase)
    console.log("👥 STEP 2: Sincronizzazione Users");
    console.log("-".repeat(100));

    const sqliteUsers = sqliteDb
      .prepare(
        "SELECT id, email, first_name, last_name, role, email_verified, password_hash, password_salt FROM users",
      )
      .all();
    const pgUsers = await pgClient.query(
      "SELECT id, email, first_name, last_name, role, email_verified FROM users",
    );
    const pgUserMap = new Map(pgUsers.rows.map((u) => [u.id, u]));

    for (const sqliteUser of sqliteUsers) {
      const pgUser = pgUserMap.get(sqliteUser.id);
      if (!pgUser) {
        console.log(
          `  ⚠️  Utente ${sqliteUser.email} non trovato in Supabase (verrà aggiunto solo se necessario)`,
        );
        continue;
      }

      // Confronta e aggiorna se necessario
      const needsUpdate =
        pgUser.email !== sqliteUser.email ||
        pgUser.first_name !== sqliteUser.first_name ||
        pgUser.last_name !== sqliteUser.last_name ||
        pgUser.role !== sqliteUser.role ||
        (pgUser.email_verified ? 1 : 0) !== (sqliteUser.email_verified ? 1 : 0);

      if (needsUpdate) {
        // Converti email_verified da boolean a 0/1
        const emailVerified = sqliteUser.email_verified ? 1 : 0;

        await pgClient.query(
          `
          UPDATE users 
          SET email = $1, first_name = $2, last_name = $3, role = $4, email_verified = $5
          WHERE id = $6
        `,
          [
            sqliteUser.email,
            sqliteUser.first_name || null,
            sqliteUser.last_name || null,
            sqliteUser.role || null,
            emailVerified,
            sqliteUser.id,
          ],
        );

        updatedUsers++;
        console.log(`  ✅ Aggiornato: ${sqliteUser.email}`);
        console.log(`     Role: ${pgUser.role} → ${sqliteUser.role || "NULL"}`);
      }
    }

    if (updatedUsers === 0) {
      console.log("  ✅ Nessun utente da aggiornare");
    }
    console.log("");

    // 3. Sincronizza organizations (SQLite → Supabase)
    console.log("🏢 STEP 3: Sincronizzazione Organizations");
    console.log("-".repeat(100));

    const sqliteOrgs = sqliteDb
      .prepare(
        `
      SELECT id, legal_name, COALESCE(type, org_type, 'buyer') as org_type, status, is_certified
      FROM organizations
    `,
      )
      .all();

    const pgOrgs = await pgClient.query(`
      SELECT id, legal_name, COALESCE(type::text, org_type::text, 'buyer') as org_type, status, is_certified
      FROM organizations
    `);
    const pgOrgMap = new Map(pgOrgs.rows.map((o) => [o.id, o]));

    for (const sqliteOrg of sqliteOrgs) {
      const pgOrg = pgOrgMap.get(sqliteOrg.id);
      if (!pgOrg) {
        console.log(
          `  ⚠️  Organizzazione ${sqliteOrg.legal_name} non trovata in Supabase (verrà aggiunta solo se necessario)`,
        );
        continue;
      }

      // Normalizza org_type: converti a lowercase per confronto
      const sqliteType = (sqliteOrg.org_type || "buyer").toLowerCase();
      const pgType = (pgOrg.org_type || "buyer").toLowerCase();

      // Confronta e aggiorna se necessario
      const sqliteCertified = sqliteOrg.is_certified ? true : false;
      const pgCertified = pgOrg.is_certified ? true : false;

      const needsUpdate =
        pgOrg.legal_name !== sqliteOrg.legal_name ||
        pgType !== sqliteType ||
        pgOrg.status !== sqliteOrg.status ||
        pgCertified !== sqliteCertified;

      if (needsUpdate) {
        // Usa il tipo di SQLite (lowercase: buyer/vendor/operator)
        await pgClient.query(
          `
          UPDATE organizations 
          SET legal_name = $1, type = $2, status = $3, is_certified = $4
          WHERE id = $5
        `,
          [
            sqliteOrg.legal_name,
            sqliteType, // Usa il tipo di SQLite
            sqliteOrg.status || "ACTIVE",
            sqliteCertified,
            sqliteOrg.id,
          ],
        );

        updatedOrgs++;
        console.log(`  ✅ Aggiornato: ${sqliteOrg.legal_name}`);
        if (pgType !== sqliteType) {
          console.log(`     Type: ${pgOrg.org_type} → ${sqliteOrg.org_type}`);
        }
        if (pgCertified !== sqliteCertified) {
          console.log(`     is_certified: ${pgCertified} → ${sqliteCertified}`);
        }
      }
    }

    if (updatedOrgs === 0) {
      console.log("  ✅ Nessuna organizzazione da aggiornare");
    }
    console.log("");

    // 4. Riepilogo finale
    console.log("=".repeat(100));
    console.log("📊 RIEPILOGO FINALE");
    console.log("=".repeat(100));
    console.log(`\n🗑️  Utenti eliminati: ${deletedUsers}`);
    console.log(`👥 Utenti aggiornati: ${updatedUsers}`);
    console.log(`🏢 Organizzazioni aggiornate: ${updatedOrgs}`);
    console.log("");

    // Verifica stato finale
    console.log("📋 VERIFICA STATO FINALE");
    console.log("-".repeat(100));

    const finalUsersWithoutOrgs = await pgClient.query(`
      SELECT COUNT(*) as count
      FROM users u
      LEFT JOIN org_memberships om ON u.id = om.user_id
      WHERE om.id IS NULL
    `);

    const finalUsersCount = await pgClient.query(
      "SELECT COUNT(*) as count FROM users",
    );
    const finalOrgsCount = await pgClient.query(
      "SELECT COUNT(*) as count FROM organizations",
    );

    console.log(`\n  Utenti totali: ${finalUsersCount.rows[0].count}`);
    console.log(
      `  Utenti senza organizzazioni: ${finalUsersWithoutOrgs.rows[0].count}`,
    );
    console.log(`  Organizzazioni totali: ${finalOrgsCount.rows[0].count}`);

    if (finalUsersWithoutOrgs.rows[0].count === "0") {
      console.log("\n  ✅ Nessun utente orfano rimasto");
    } else {
      console.log(
        `\n  ⚠️  Ancora ${finalUsersWithoutOrgs.rows[0].count} utenti senza organizzazioni`,
      );
    }

    await pgClient.end();
    sqliteDb.close();

    console.log("\n" + "=".repeat(100));
    console.log("✅ Sincronizzazione completata");
    console.log("=".repeat(100));
  } catch (error) {
    console.error("\n❌ Errore:", error.message);
    console.error(error.stack);
    if (pgClient) await pgClient.end();
    if (sqliteDb) sqliteDb.close();
    process.exit(1);
  }
}

syncSQLiteToSupabase();
