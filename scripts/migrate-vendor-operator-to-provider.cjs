/**
 * Script di migrazione: vendor/operator → provider
 *
 * Migra le organizzazioni con type='vendor' o type='operator' a type='provider'
 * Aggiorna anche org_type per retrocompatibilità
 */

require("dotenv").config();
const { Client } = require("pg");

async function migrateOrgTypes() {
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

    // Conta organizzazioni da migrare
    const countResult = await client.query(`
      SELECT type, COUNT(*) as count 
      FROM organizations 
      WHERE type IN ('vendor', 'operator') 
      GROUP BY type
    `);

    console.log("\n📊 Organizzazioni da migrare:");
    countResult.rows.forEach((r) => {
      console.log(`  ${r.type}: ${r.count}`);
    });

    const totalCount = countResult.rows.reduce(
      (sum, r) => sum + parseInt(r.count),
      0,
    );

    if (totalCount === 0) {
      console.log("\n✅ Nessuna organizzazione da migrare");
      return;
    }

    // Migra type
    const updateTypeResult = await client.query(`
      UPDATE organizations 
      SET type = 'provider' 
      WHERE type IN ('vendor', 'operator')
    `);

    console.log(
      `\n✅ Migrate ${updateTypeResult.rowCount} organizzazioni: type → 'provider'`,
    );

    // Migra org_type (se esiste)
    const updateOrgTypeResult = await client.query(`
      UPDATE organizations 
      SET org_type = 'provider' 
      WHERE org_type IN ('vendor', 'operator', 'VENDOR', 'OPERATOR')
    `);

    console.log(
      `✅ Migrate ${updateOrgTypeResult.rowCount} organizzazioni: org_type → 'provider'`,
    );

    // Verifica risultato
    const verifyResult = await client.query(`
      SELECT type, COUNT(*) as count 
      FROM organizations 
      WHERE type IN ('buyer', 'provider') 
      GROUP BY type
    `);

    console.log("\n📊 Organizzazioni dopo migrazione:");
    verifyResult.rows.forEach((r) => {
      console.log(`  ${r.type}: ${r.count}`);
    });

    console.log("\n✅ Migrazione completata con successo!");
  } catch (error) {
    console.error("❌ Errore durante la migrazione:", error);
    throw error;
  } finally {
    await client.end();
  }
}

// Esegui migrazione
migrateOrgTypes()
  .then(() => {
    console.log("\n🎉 Script completato");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Script fallito:", error);
    process.exit(1);
  });
