/**
 * Script per migrare la tabella rate_cards dai vecchi enum ai nuovi
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

async function migrateRateCards() {
  try {
    await client.connect();
    console.log('✅ Connesso a Supabase PostgreSQL');

    // 1. Verifica dati attuali
    console.log('\n🔍 Verifica dati attuali rate_cards...');
    const currentData = await client.query('SELECT id, service_type FROM rate_cards');
    console.log('📊 Rate cards attuali:', currentData.rows);

    // 2. Aggiungi colonna temporanea
    console.log('\n🔄 Aggiunta colonna temporanea...');
    await client.query('ALTER TABLE rate_cards ADD COLUMN service_type_new tipo_intervento');
    console.log('✅ Colonna temporanea aggiunta');

    // 3. Popola colonna temporanea con valori mappati
    console.log('\n🔄 Migrazione valori nella colonna temporanea...');
    const updateResult = await client.query(`
      UPDATE rate_cards
      SET service_type_new = CASE service_type::text
        WHEN 'SPRAY' THEN 'IRRORAZIONE'::tipo_intervento
        WHEN 'SPREAD' THEN 'SPANDIMENTO'::tipo_intervento
        WHEN 'MAPPING' THEN 'RILIEVO_AEREO'::tipo_intervento
        ELSE 'IRRORAZIONE'::tipo_intervento
      END
    `);
    console.log(`✅ Migrati ${updateResult.rowCount} record nella colonna temporanea`);

    // 4. Elimina colonna vecchia e rinomina quella nuova
    console.log('\n🔄 Sostituzione colonne...');
    await client.query('ALTER TABLE rate_cards DROP COLUMN service_type');
    await client.query('ALTER TABLE rate_cards RENAME COLUMN service_type_new TO service_type');
    console.log('✅ Colonne sostituite');

    // 5. Verifica migrazione
    console.log('\n🔍 Verifica migrazione completata...');
    const migratedData = await client.query('SELECT service_type, COUNT(*) FROM rate_cards GROUP BY service_type');
    console.log('📊 Rate cards dopo migrazione:', migratedData.rows);

    // 6. Verifica che la colonna abbia il tipo corretto
    const columnInfo = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'rate_cards' AND column_name = 'service_type'
    `);
    console.log('📋 Tipo colonna service_type:', columnInfo.rows[0]);

    console.log('\n🎉 Migrazione rate_cards completata!');

  } catch (error) {
    console.error('❌ Errore nella migrazione rate_cards:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Esegui lo script
migrateRateCards()
  .then(() => {
    console.log('✅ Script completato con successo');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script fallito:', error);
    process.exit(1);
  });
