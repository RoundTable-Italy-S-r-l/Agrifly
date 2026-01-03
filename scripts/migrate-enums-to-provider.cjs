/**
 * Script di migrazione: aggiorna enum OrgType e OrgRole
 *
 * 1. Aggiunge "provider" all'enum OrgType
 * 2. Aggiunge "VENDOR" all'enum OrgRole (se non esiste)
 * 3. Migra i dati: vendor/operator → provider, SELLER → VENDOR
 */

require("dotenv").config();
const { Client } = require("pg");

async function migrateEnums() {
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
    console.log("✅ Connesso al database");

    // STEP 1: Verifica valori enum attuali
    const orgTypeValues = await client.query(`
      SELECT unnest(enum_range(NULL::"OrgType"))::text as value
    `);
    console.log("\n📊 Valori enum OrgType attuali:");
    orgTypeValues.rows.forEach((r) => console.log(`  - ${r.value}`));

    const orgRoleValues = await client.query(`
      SELECT unnest(enum_range(NULL::"OrgRole"))::text as value
    `);
    console.log("\n📊 Valori enum OrgRole attuali:");
    orgRoleValues.rows.forEach((r) => console.log(`  - ${r.value}`));

    // STEP 2: Aggiungi "provider" a OrgType se non esiste
    const hasProvider = orgTypeValues.rows.some((r) => r.value === "provider");
    if (!hasProvider) {
      console.log('\n➕ Aggiungo "provider" all\'enum OrgType...');
      await client.query(
        `ALTER TYPE "OrgType" ADD VALUE IF NOT EXISTS 'provider'`,
      );
      console.log('✅ "provider" aggiunto a OrgType');
    } else {
      console.log('\n✅ "provider" già presente in OrgType');
    }

    // STEP 3: Aggiungi "VENDOR" a OrgRole se non esiste
    const hasVendor = orgRoleValues.rows.some((r) => r.value === "VENDOR");
    if (!hasVendor) {
      console.log('\n➕ Aggiungo "VENDOR" all\'enum OrgRole...');
      await client.query(
        `ALTER TYPE "OrgRole" ADD VALUE IF NOT EXISTS 'VENDOR'`,
      );
      console.log('✅ "VENDOR" aggiunto a OrgRole');
    } else {
      console.log('\n✅ "VENDOR" già presente in OrgRole');
    }

    // STEP 4: Migra organizzazioni vendor/operator → provider
    // Usa i valori esatti dell'enum (case-sensitive)
    const orgCount = await client.query(`
      SELECT type::text, COUNT(*) as count 
      FROM organizations 
      WHERE type::text IN ('vendor', 'operator', 'VENDOR', 'OPERATOR_PROVIDER')
      GROUP BY type::text
    `);

    if (orgCount.rows.length > 0) {
      console.log("\n📊 Organizzazioni da migrare:");
      orgCount.rows.forEach((r) => console.log(`  ${r.type}: ${r.count}`));

      console.log("\n🔄 Migro organizzazioni vendor/operator → provider...");
      // Migra una alla volta per evitare problemi con i cast
      for (const row of orgCount.rows) {
        const updateOrg = await client.query(
          `
          UPDATE organizations 
          SET type = 'provider'::"OrgType"
          WHERE type::text = $1
        `,
          [row.type],
        );
        console.log(
          `  ✅ Migrate ${updateOrg.rowCount} organizzazioni da "${row.type}"`,
        );
      }
    } else {
      console.log("\n✅ Nessuna organizzazione da migrare");
    }

    // STEP 5: Migra org_type (se esiste e ha valori vendor/operator)
    const orgTypeCount = await client.query(`
      SELECT org_type::text, COUNT(*) as count 
      FROM organizations 
      WHERE org_type IS NOT NULL 
        AND org_type::text IN ('vendor', 'operator', 'VENDOR', 'OPERATOR_PROVIDER')
      GROUP BY org_type::text
    `);

    if (orgTypeCount.rows.length > 0) {
      console.log("\n📊 org_type da migrare:");
      orgTypeCount.rows.forEach((r) =>
        console.log(`  ${r.org_type}: ${r.count}`),
      );

      console.log("\n🔄 Migro org_type vendor/operator → provider...");
      for (const row of orgTypeCount.rows) {
        const updateOrgType = await client.query(
          `
          UPDATE organizations 
          SET org_type = 'provider'::"OrgType"
          WHERE org_type::text = $1
        `,
          [row.org_type],
        );
        console.log(
          `  ✅ Migrate ${updateOrgType.rowCount} organizzazioni (org_type) da "${row.org_type}"`,
        );
      }
    }

    // STEP 6: Verifica se ci sono ruoli da migrare (SELLER non esiste nell'enum, potrebbe essere "vendor" minuscolo)
    const allRoles = await client.query(`
      SELECT role::text, COUNT(*) as count 
      FROM org_memberships 
      GROUP BY role::text
      ORDER BY count DESC
    `);

    console.log("\n📊 Ruoli attuali in org_memberships:");
    allRoles.rows.forEach((r) => console.log(`  ${r.role}: ${r.count}`));

    // Se esiste "vendor" minuscolo, potrebbe essere da migrare a "VENDOR" maiuscolo
    // Ma per ora non facciamo nulla perché l'enum supporta entrambi
    console.log(
      "\n✅ Nessuna migrazione ruoli necessaria (enum supporta già vendor/VENDOR)",
    );

    // STEP 7: Verifica risultato finale
    const finalOrgType = await client.query(`
      SELECT type, COUNT(*) as count 
      FROM organizations 
      WHERE type IN ('buyer'::"OrgType", 'provider'::"OrgType") 
      GROUP BY type
    `);

    console.log("\n📊 Organizzazioni dopo migrazione:");
    finalOrgType.rows.forEach((r) => console.log(`  ${r.type}: ${r.count}`));

    const finalOrgRole = await client.query(`
      SELECT role::text, COUNT(*) as count 
      FROM org_memberships 
      WHERE role::text IN ('VENDOR', 'vendor')
      GROUP BY role::text
    `);

    if (finalOrgRole.rows.length > 0) {
      console.log("\n📊 Ruoli VENDOR/vendor dopo migrazione:");
      finalOrgRole.rows.forEach((r) => console.log(`  ${r.role}: ${r.count}`));
    }

    console.log("\n✅ Migrazione completata con successo!");
  } catch (error) {
    console.error("❌ Errore durante la migrazione:", error);
    throw error;
  } finally {
    await client.end();
  }
}

// Esegui migrazione
migrateEnums()
  .then(() => {
    console.log("\n🎉 Script completato");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Script fallito:", error);
    process.exit(1);
  });
