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

async function compareUsersAndOrgs() {
  const pgClient = new Client(supabaseConfig);
  let sqliteDb;

  try {
    await pgClient.connect();
    console.log("✅ Connesso a Supabase\n");

    sqliteDb = new Database(sqlitePath);
    console.log("✅ Connesso a SQLite\n");

    console.log("=".repeat(100));
    console.log("📊 CONFRONTO DISCREPANZE: USERS E ORGANIZZATIONS");
    console.log("=".repeat(100));
    console.log("");

    // ========== USERS ==========
    console.log("👥 USERS");
    console.log("-".repeat(100));

    // Get users from Supabase
    const pgUsers = await pgClient.query(`
      SELECT id, email, first_name, last_name, role, email_verified, created_at
      FROM users
      ORDER BY created_at DESC
    `);

    // Get users from SQLite
    const sqliteUsers = sqliteDb
      .prepare(
        "SELECT id, email, first_name, last_name, role, email_verified, created_at FROM users ORDER BY created_at DESC",
      )
      .all();

    console.log(`\n📊 Record in Supabase: ${pgUsers.rows.length}`);
    console.log(`📊 Record in SQLite: ${sqliteUsers.length}\n`);

    const pgUserIds = new Set(pgUsers.rows.map((u) => u.id));
    const sqliteUserIds = new Set(sqliteUsers.map((u) => u.id));

    // Users only in SQLite (devono essere in Supabase)
    const onlyInSQLite = sqliteUsers.filter((u) => !pgUserIds.has(u.id));
    if (onlyInSQLite.length > 0) {
      console.log(`⚠️  Utenti solo in SQLite (${onlyInSQLite.length}):`);
      for (const user of onlyInSQLite) {
        console.log(`  - ${user.email} (${user.id})`);
        console.log(
          `    Nome: ${user.first_name || ""} ${user.last_name || ""}`,
        );
        console.log(`    Role: ${user.role || "NULL"}`);
        console.log(
          `    Email verificata: ${user.email_verified ? "Sì" : "No"}`,
        );
      }
      console.log("");
    }

    // Users only in Supabase
    const onlyInPG = pgUsers.rows.filter((u) => !sqliteUserIds.has(u.id));
    if (onlyInPG.length > 0) {
      console.log(`ℹ️  Utenti solo in Supabase (${onlyInPG.length}):`);
      for (const user of onlyInPG.slice(0, 5)) {
        console.log(`  - ${user.email} (${user.id})`);
      }
      if (onlyInPG.length > 5) {
        console.log(`  ... e altri ${onlyInPG.length - 5}`);
      }
      console.log("");
    }

    // Common users - compare values
    const commonUserIds = [...sqliteUserIds].filter((id) => pgUserIds.has(id));
    const differentUsers = [];

    for (const userId of commonUserIds) {
      const pgUser = pgUsers.rows.find((u) => u.id === userId);
      const sqliteUser = sqliteUsers.find((u) => u.id === userId);

      const differences = [];

      // Compare fields (ignore timestamp format differences)
      if (pgUser.email !== sqliteUser.email)
        differences.push({
          field: "email",
          pg: pgUser.email,
          sqlite: sqliteUser.email,
        });
      if (pgUser.first_name !== sqliteUser.first_name)
        differences.push({
          field: "first_name",
          pg: pgUser.first_name,
          sqlite: sqliteUser.first_name,
        });
      if (pgUser.last_name !== sqliteUser.last_name)
        differences.push({
          field: "last_name",
          pg: pgUser.last_name,
          sqlite: sqliteUser.last_name,
        });
      if (pgUser.role !== sqliteUser.role)
        differences.push({
          field: "role",
          pg: pgUser.role,
          sqlite: sqliteUser.role,
        });
      if (pgUser.email_verified !== sqliteUser.email_verified)
        differences.push({
          field: "email_verified",
          pg: pgUser.email_verified,
          sqlite: sqliteUser.email_verified,
        });

      if (differences.length > 0) {
        differentUsers.push({
          id: userId,
          email: sqliteUser.email,
          differences,
        });
      }
    }

    if (differentUsers.length > 0) {
      console.log(`⚠️  Utenti con valori diversi (${differentUsers.length}):`);
      for (const user of differentUsers.slice(0, 5)) {
        console.log(`  - ${user.email} (${user.id})`);
        for (const diff of user.differences) {
          console.log(
            `    ${diff.field}: Supabase="${diff.pg}" vs SQLite="${diff.sqlite}"`,
          );
        }
      }
      if (differentUsers.length > 5) {
        console.log(`  ... e altri ${differentUsers.length - 5}`);
      }
      console.log("");
    }

    // ========== ORGANIZATIONS ==========
    console.log("\n🏢 ORGANIZATIONS");
    console.log("-".repeat(100));

    // Get organizations from Supabase
    const pgOrgs = await pgClient.query(`
      SELECT id, legal_name, COALESCE(type::text, org_type::text, 'buyer') as org_type, status, is_certified, created_at
      FROM organizations
      ORDER BY created_at DESC
    `);

    // Get organizations from SQLite
    const sqliteOrgs = sqliteDb
      .prepare(
        "SELECT id, legal_name, COALESCE(type, org_type, 'buyer') as org_type, status, is_certified, created_at FROM organizations ORDER BY created_at DESC",
      )
      .all();

    console.log(`\n📊 Record in Supabase: ${pgOrgs.rows.length}`);
    console.log(`📊 Record in SQLite: ${sqliteOrgs.length}\n`);

    const pgOrgIds = new Set(pgOrgs.rows.map((o) => o.id));
    const sqliteOrgIds = new Set(sqliteOrgs.map((o) => o.id));

    // Organizations only in SQLite (devono essere in Supabase)
    const onlyInSQLiteOrgs = sqliteOrgs.filter((o) => !pgOrgIds.has(o.id));
    if (onlyInSQLiteOrgs.length > 0) {
      console.log(
        `⚠️  Organizzazioni solo in SQLite (${onlyInSQLiteOrgs.length}):`,
      );
      for (const org of onlyInSQLiteOrgs) {
        console.log(`  - ${org.legal_name} (${org.id})`);
        console.log(`    Type: ${org.org_type || "NULL"}`);
        console.log(`    Status: ${org.status || "NULL"}`);
        console.log(`    Certificata: ${org.is_certified ? "Sì" : "No"}`);
      }
      console.log("");
    }

    // Organizations only in Supabase
    const onlyInPGOrgs = pgOrgs.rows.filter((o) => !sqliteOrgIds.has(o.id));
    if (onlyInPGOrgs.length > 0) {
      console.log(
        `ℹ️  Organizzazioni solo in Supabase (${onlyInPGOrgs.length}):`,
      );
      for (const org of onlyInPGOrgs.slice(0, 5)) {
        console.log(`  - ${org.legal_name} (${org.id})`);
      }
      if (onlyInPGOrgs.length > 5) {
        console.log(`  ... e altri ${onlyInPGOrgs.length - 5}`);
      }
      console.log("");
    }

    // Common organizations - compare values
    const commonOrgIds = [...sqliteOrgIds].filter((id) => pgOrgIds.has(id));
    const differentOrgs = [];

    for (const orgId of commonOrgIds) {
      const pgOrg = pgOrgs.rows.find((o) => o.id === orgId);
      const sqliteOrg = sqliteOrgs.find((o) => o.id === orgId);

      const differences = [];

      // Compare fields
      if (pgOrg.legal_name !== sqliteOrg.legal_name)
        differences.push({
          field: "legal_name",
          pg: pgOrg.legal_name,
          sqlite: sqliteOrg.legal_name,
        });
      if (pgOrg.org_type !== sqliteOrg.org_type)
        differences.push({
          field: "org_type",
          pg: pgOrg.org_type,
          sqlite: sqliteOrg.org_type,
        });
      if (pgOrg.status !== sqliteOrg.status)
        differences.push({
          field: "status",
          pg: pgOrg.status,
          sqlite: sqliteOrg.status,
        });
      if (pgOrg.is_certified !== sqliteOrg.is_certified)
        differences.push({
          field: "is_certified",
          pg: pgOrg.is_certified,
          sqlite: sqliteOrg.is_certified,
        });

      if (differences.length > 0) {
        differentOrgs.push({
          id: orgId,
          legal_name: sqliteOrg.legal_name,
          differences,
        });
      }
    }

    if (differentOrgs.length > 0) {
      console.log(
        `⚠️  Organizzazioni con valori diversi (${differentOrgs.length}):`,
      );
      for (const org of differentOrgs) {
        console.log(`  - ${org.legal_name} (${org.id})`);
        for (const diff of org.differences) {
          console.log(
            `    ${diff.field}: Supabase="${diff.pg}" vs SQLite="${diff.sqlite}"`,
          );
        }
      }
      console.log("");
    }

    // Summary
    console.log("\n" + "=".repeat(100));
    console.log("📊 RIEPILOGO");
    console.log("=".repeat(100));
    console.log(
      `\n⚠️  Utenti da aggiungere a Supabase: ${onlyInSQLite.length}`,
    );
    console.log(
      `⚠️  Organizzazioni da aggiungere a Supabase: ${onlyInSQLiteOrgs.length}`,
    );
    console.log(`⚠️  Utenti con valori diversi: ${differentUsers.length}`);
    console.log(
      `⚠️  Organizzazioni con valori diversi: ${differentOrgs.length}`,
    );
    console.log("");

    await pgClient.end();
    sqliteDb.close();
  } catch (error) {
    console.error("❌ Errore:", error.message);
    console.error(error.stack);
    if (pgClient) await pgClient.end();
    if (sqliteDb) sqliteDb.close();
    process.exit(1);
  }
}

compareUsersAndOrgs();
