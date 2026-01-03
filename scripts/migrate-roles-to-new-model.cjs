/**
 * Script per migrare i ruoli legacy nel database Supabase ai nuovi ruoli standardizzati
 *
 * MODELLO NUOVO:
 * - admin: grado gerarchico (tutti iniziano così)
 * - vendor: ruolo funzionale (solo per org vendor)
 * - operator: ruolo funzionale (solo per org vendor/operator)
 * - dispatcher: ruolo funzionale (solo per org vendor/operator)
 *
 * MAPPATURA:
 * - VENDOR_ADMIN → admin
 * - BUYER_ADMIN → admin
 * - ADMIN → admin
 * - PILOT → operator
 * - DISPATCHER → dispatcher
 * - SALES → vendor (se org vendor) o admin (altrimenti)
 */

const { Client } = require("pg");
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const PGHOST = process.env.PGHOST;
const PGPORT = process.env.PGPORT || "6543";
const PGDATABASE = process.env.PGDATABASE || "postgres";
const PGUSER = process.env.PGUSER;
const PGPASSWORD = process.env.PGPASSWORD;

if (!PGHOST || !PGUSER || !PGPASSWORD) {
  console.error("❌ Variabili d'ambiente PostgreSQL mancanti");
  console.error("   Richieste: PGHOST, PGUSER, PGPASSWORD");
  process.exit(1);
}

const client = new Client({
  host: PGHOST,
  port: parseInt(PGPORT),
  database: PGDATABASE,
  user: PGUSER,
  password: PGPASSWORD,
  ssl: { rejectUnauthorized: false },
});

/**
 * Mappa ruolo legacy al nuovo ruolo
 */
function mapLegacyRole(legacyRole, orgType) {
  if (!legacyRole) return "admin";

  const roleUpper = String(legacyRole).toUpperCase().trim();
  const orgTypeLower = orgType ? String(orgType).toLowerCase() : null;

  // Mappatura diretta
  const mapping = {
    VENDOR_ADMIN: "admin",
    BUYER_ADMIN: "admin",
    ADMIN: "admin",
    PILOT: "operator",
    DISPATCHER: "dispatcher",
    OPERATOR: "operator",
    VENDOR: "vendor",
  };

  if (mapping[roleUpper]) {
    return mapping[roleUpper];
  }

  // SALES → vendor (se org vendor) o admin (altrimenti)
  if (roleUpper === "SALES") {
    return orgTypeLower === "vendor" ? "vendor" : "admin";
  }

  // Se già nel formato nuovo, normalizza
  const roleLower = String(legacyRole).toLowerCase().trim();
  if (["admin", "vendor", "operator", "dispatcher"].includes(roleLower)) {
    return roleLower;
  }

  // Se contiene "admin", mappa a admin
  if (roleLower.includes("admin")) {
    return "admin";
  }

  // Default
  console.warn(
    `⚠️  Ruolo non mappato: "${legacyRole}", usando default "admin"`,
  );
  return "admin";
}

async function migrateRoles() {
  try {
    await client.connect();
    console.log("✅ Connesso al database PostgreSQL");

    // 1. Ottieni tutti i ruoli attuali con tipo organizzazione
    console.log("\n📋 Analizzo ruoli esistenti...");
    const rolesQuery = await client.query(`
      SELECT 
        om.id,
        om.user_id,
        om.org_id,
        om.role as legacy_role,
        om.is_active,
        COALESCE(o.type::text, o.org_type::text) as org_type
      FROM org_memberships om
      LEFT JOIN organizations o ON om.org_id = o.id
      ORDER BY om.id
    `);

    console.log(`   Trovati ${rolesQuery.rows.length} membri`);

    // Raggruppa per ruolo legacy
    const roleStats = {};
    rolesQuery.rows.forEach((row) => {
      const legacy = row.legacy_role || "NULL";
      if (!roleStats[legacy]) {
        roleStats[legacy] = { count: 0, newRole: null };
      }
      roleStats[legacy].count++;

      // Determina nuovo ruolo per statistica
      if (!roleStats[legacy].newRole) {
        roleStats[legacy].newRole = mapLegacyRole(
          row.legacy_role,
          row.org_type,
        );
      }
    });

    console.log("\n📊 Statistiche ruoli legacy:");
    Object.entries(roleStats).forEach(([legacy, stats]) => {
      console.log(
        `   ${legacy || "NULL"}: ${stats.count} membri → ${stats.newRole}`,
      );
    });

    // 2. Verifica che l'enum supporti i nuovi valori (PostgreSQL)
    console.log("\n🔍 Verifico enum OrgRole...");
    const enumQuery = await client.query(`
      SELECT enumlabel 
      FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE pg_type.typname = 'OrgRole'
      ORDER BY enumsortorder
    `);

    const existingEnumValues = enumQuery.rows.map((r) => r.enumlabel);
    console.log(`   Valori enum attuali: ${existingEnumValues.join(", ")}`);

    const newRoles = ["admin", "vendor", "operator", "dispatcher"];
    const missingRoles = newRoles.filter(
      (r) => !existingEnumValues.includes(r),
    );

    if (missingRoles.length > 0) {
      console.log(`\n⚠️  Valori enum mancanti: ${missingRoles.join(", ")}`);
      console.log("   Aggiungo valori mancanti all'enum...");

      for (const role of missingRoles) {
        try {
          await client.query(
            `ALTER TYPE "OrgRole" ADD VALUE IF NOT EXISTS '${role}'`,
          );
          console.log(`   ✅ Aggiunto: ${role}`);
        } catch (err) {
          // IF NOT EXISTS non è supportato in alcune versioni PostgreSQL
          if (err.message.includes("already exists")) {
            console.log(`   ℹ️  ${role} già presente`);
          } else {
            console.error(`   ❌ Errore aggiunta ${role}:`, err.message);
          }
        }
      }
    } else {
      console.log("   ✅ Tutti i valori enum necessari sono presenti");
    }

    // 3. Aggiorna i ruoli
    console.log("\n🔄 Aggiorno ruoli nel database...");
    let updated = 0;
    let skipped = 0;

    for (const row of rolesQuery.rows) {
      const legacyRole = row.legacy_role;
      const newRole = mapLegacyRole(legacyRole, row.org_type);

      // Se il ruolo è già corretto, salta
      if (legacyRole && legacyRole.toLowerCase() === newRole) {
        skipped++;
        continue;
      }

      // Aggiorna il ruolo
      try {
        await client.query(
          'UPDATE org_memberships SET role = $1::"OrgRole" WHERE id = $2',
          [newRole, row.id],
        );
        updated++;
        if (updated <= 10 || updated % 100 === 0) {
          console.log(
            `   ✅ [${updated}] ${row.id}: ${legacyRole || "NULL"} → ${newRole}`,
          );
        }
      } catch (err) {
        console.error(`   ❌ Errore aggiornamento ${row.id}:`, err.message);
      }
    }

    console.log(`\n✅ Migrazione completata:`);
    console.log(`   - Aggiornati: ${updated}`);
    console.log(`   - Saltati (già corretti): ${skipped}`);
    console.log(`   - Totali: ${rolesQuery.rows.length}`);

    // 4. Verifica risultato finale
    console.log("\n📊 Verifica ruoli finali...");
    const finalQuery = await client.query(`
      SELECT role, COUNT(*) as count
      FROM org_memberships
      GROUP BY role
      ORDER BY role
    `);

    console.log("   Ruoli finali nel database:");
    finalQuery.rows.forEach((row) => {
      console.log(`   - ${row.role}: ${row.count} membri`);
    });

    // Verifica che tutti i ruoli siano tra quelli nuovi
    const invalidRoles = finalQuery.rows
      .filter(
        (r) => !["admin", "vendor", "operator", "dispatcher"].includes(r.role),
      )
      .map((r) => r.role);

    if (invalidRoles.length > 0) {
      console.log(
        `\n⚠️  Attenzione: trovati ruoli non standard: ${invalidRoles.join(", ")}`,
      );
    } else {
      console.log("\n✅ Tutti i ruoli sono stati migrati correttamente!");
    }
  } catch (error) {
    console.error("❌ Errore durante la migrazione:", error);
    throw error;
  } finally {
    await client.end();
    console.log("\n🔌 Disconnesso dal database");
  }
}

// Esegui migrazione
migrateRoles()
  .then(() => {
    console.log("\n✅ Migrazione completata con successo");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migrazione fallita:", error);
    process.exit(1);
  });
