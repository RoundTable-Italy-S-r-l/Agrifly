/**
 * Script per migrare le tabelle rimanenti che usano ancora ServiceType_EN
 * Tabelle: bookings, org_service_policies, service_area_rules
 */

const { Client } = require('pg');
require('dotenv').config();

// Configurazione connessione Supabase
const client = new Client({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function migrateRemainingTables() {
  try {
    await client.connect();
    console.log('✅ Connesso a Supabase PostgreSQL');

    const tables = ['bookings', 'org_service_policies', 'service_area_rules'];

    for (const table of tables) {
      console.log(`\n🔄 Migrando tabella: ${table}`);

      // 1. Verifica dati attuali
      const currentData = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`📊 ${table} ha ${currentData.rows[0].count} record`);

      if (currentData.rows[0].count > 0) {
        const serviceTypeData = await client.query(`SELECT service_type, COUNT(*) as count FROM ${table} GROUP BY service_type`);
        console.log(`  Valori attuali:`, serviceTypeData.rows);
      }

      // 2. Aggiungi colonna temporanea
      console.log(`🔄 Aggiunta colonna temporanea a ${table}...`);
      await client.query(`ALTER TABLE ${table} ADD COLUMN service_type_new tipo_intervento`);
      console.log('✅ Colonna temporanea aggiunta');

      // 3. Popola colonna temporanea con valori mappati
      console.log(`🔄 Migrazione valori in ${table}...`);
      const updateResult = await client.query(`
        UPDATE ${table}
        SET service_type_new = CASE service_type::text
          WHEN 'SPRAY' THEN 'IRRORAZIONE'::tipo_intervento
          WHEN 'SPREAD' THEN 'SPANDIMENTO'::tipo_intervento
          WHEN 'MAPPING' THEN 'RILIEVO_AEREO'::tipo_intervento
          ELSE 'IRRORAZIONE'::tipo_intervento
        END
      `);
      console.log(`✅ Migrati ${updateResult.rowCount} record in ${table}`);

      // 4. Sostituisci colonne
      console.log(`🔄 Sostituzione colonne in ${table}...`);
      await client.query(`ALTER TABLE ${table} DROP COLUMN service_type`);
      await client.query(`ALTER TABLE ${table} RENAME COLUMN service_type_new TO service_type`);
      console.log('✅ Colonne sostituite');

      // 5. Verifica colonna
      const columnInfo = await client.query(`
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_name = '${table}' AND column_name = 'service_type'
      `);
      console.log(`📋 Tipo colonna finale:`, columnInfo.rows[0]);
    }

    // Verifica finale
    console.log('\n🔍 Verifica finale - Colonne che usano ancora ServiceType_EN:');
    const remainingOldEnum = await client.query(`
      SELECT t.table_name, c.column_name
      FROM information_schema.columns c
      JOIN information_schema.tables t ON c.table_name = t.table_name
      WHERE c.table_schema = 'public'
        AND t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        AND c.udt_name = 'ServiceType_EN'
      ORDER BY t.table_name, c.column_name;
    `);

    if (remainingOldEnum.rows.length === 0) {
      console.log('✅ Nessuna colonna usa più ServiceType_EN!');
    } else {
      console.log('❌ Colonne ancora da migrare:', remainingOldEnum.rows);
    }

    console.log('\n🎉 Migrazione tabelle rimanenti completata!');

  } catch (error) {
    console.error('❌ Errore nella migrazione:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Esegui lo script
migrateRemainingTables()
  .then(() => {
    console.log('✅ Script completato con successo');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script fallito:', error);
    process.exit(1);
  });
