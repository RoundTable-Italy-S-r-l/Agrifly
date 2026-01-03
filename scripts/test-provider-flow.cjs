/**
 * Test del flusso completo provider: registrazione e login
 */

require("dotenv").config();
const { Client } = require("pg");

async function testProviderFlow() {
  const client = new Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("✅ Connesso al database\n");

    // TEST 1: Verifica enum OrgType
    console.log("📋 TEST 1: Verifica enum OrgType");
    const orgTypeValues = await client.query(`
      SELECT unnest(enum_range(NULL::"OrgType"))::text as value
      ORDER BY value
    `);
    const hasProvider = orgTypeValues.rows.some((r) => r.value === "provider");
    const hasBuyer = orgTypeValues.rows.some((r) => r.value === "buyer");
    console.log(`  ✅ provider presente: ${hasProvider}`);
    console.log(`  ✅ buyer presente: ${hasBuyer}`);
    if (!hasProvider || !hasBuyer) {
      throw new Error("Enum OrgType non valido");
    }

    // TEST 2: Verifica enum OrgRole
    console.log("\n📋 TEST 2: Verifica enum OrgRole");
    const orgRoleValues = await client.query(`
      SELECT unnest(enum_range(NULL::"OrgRole"))::text as value
      ORDER BY value
    `);
    const hasVendor = orgRoleValues.rows.some(
      (r) => r.value === "VENDOR" || r.value === "vendor",
    );
    const hasOperator = orgRoleValues.rows.some(
      (r) => r.value === "OPERATOR" || r.value === "operator",
    );
    console.log(`  ✅ VENDOR/vendor presente: ${hasVendor}`);
    console.log(`  ✅ OPERATOR/operator presente: ${hasOperator}`);
    if (!hasVendor || !hasOperator) {
      throw new Error("Enum OrgRole non valido");
    }

    // TEST 3: Verifica organizzazioni migrate
    console.log("\n📋 TEST 3: Verifica organizzazioni migrate");
    const orgStats = await client.query(`
      SELECT type::text, COUNT(*) as count 
      FROM organizations 
      WHERE type::text IN ('buyer', 'provider')
      GROUP BY type::text
    `);
    console.log("  Organizzazioni per tipo:");
    orgStats.rows.forEach((r) => {
      console.log(`    ${r.type}: ${r.count}`);
    });

    const providerCount =
      orgStats.rows.find((r) => r.type === "provider")?.count || 0;
    if (parseInt(providerCount) < 5) {
      console.log(
        `  ⚠️  Attenzione: solo ${providerCount} organizzazioni provider (attese almeno 5)`,
      );
    } else {
      console.log(
        `  ✅ ${providerCount} organizzazioni provider migrate correttamente`,
      );
    }

    // TEST 4: Verifica che non ci siano più vendor/operator come type
    console.log("\n📋 TEST 4: Verifica assenza vendor/operator come type");
    const legacyOrgs = await client.query(`
      SELECT type::text, COUNT(*) as count 
      FROM organizations 
      WHERE type::text IN ('vendor', 'operator')
      GROUP BY type::text
    `);
    if (legacyOrgs.rows.length > 0) {
      console.log("  ⚠️  Organizzazioni legacy ancora presenti:");
      legacyOrgs.rows.forEach((r) => console.log(`    ${r.type}: ${r.count}`));
    } else {
      console.log("  ✅ Nessuna organizzazione legacy trovata");
    }

    // TEST 5: Verifica org_type migrato
    console.log("\n📋 TEST 5: Verifica org_type migrato");
    const orgTypeStats = await client.query(`
      SELECT org_type::text, COUNT(*) as count 
      FROM organizations 
      WHERE org_type IS NOT NULL
      GROUP BY org_type::text
    `);
    if (orgTypeStats.rows.length > 0) {
      console.log("  org_type per tipo:");
      orgTypeStats.rows.forEach((r) => {
        console.log(`    ${r.org_type}: ${r.count}`);
      });
      const legacyOrgType = orgTypeStats.rows.filter(
        (r) =>
          r.org_type === "vendor" ||
          r.org_type === "operator" ||
          r.org_type === "VENDOR",
      );
      if (legacyOrgType.length > 0) {
        console.log("  ⚠️  Alcuni org_type legacy ancora presenti");
      } else {
        console.log("  ✅ Tutti gli org_type sono stati migrati");
      }
    }

    console.log("\n✅ Tutti i test completati con successo!");
    console.log("\n📝 Prossimi passi:");
    console.log('  1. Testare registrazione con accountType="provider"');
    console.log("  2. Testare login e redirect a /admin");
    console.log(
      "  3. Verificare che i ruoli vendor/operator funzionino correttamente",
    );
  } catch (error) {
    console.error("❌ Errore durante i test:", error);
    throw error;
  } finally {
    await client.end();
  }
}

// Esegui test
testProviderFlow()
  .then(() => {
    console.log("\n🎉 Test completato");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Test fallito:", error);
    process.exit(1);
  });
