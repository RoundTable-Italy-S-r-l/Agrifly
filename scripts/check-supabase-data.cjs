/**
 * Script per controllare e aggiornare i dati in Supabase
 * Verifica che tutti i valori siano migrati al nuovo sistema italiano
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

async function checkAndUpdateSupabaseData() {
  try {
    await client.connect();
    console.log('✅ Connesso a Supabase PostgreSQL');

    // 1. Verifica dati nelle tabelle esistenti
    console.log('\n🔍 Verifica dati esistenti...');

    // Jobs
    const jobsQuery = await client.query(`
      SELECT id, service_type, tipo_intervento_new
      FROM jobs
      WHERE service_type IS NOT NULL
      LIMIT 10
    `);
    console.log('📊 Jobs sample:', jobsQuery.rows);

    // Job offers
    const offersQuery = await client.query(`
      SELECT id, status
      FROM job_offers
      WHERE status IS NOT NULL
      LIMIT 10
    `);
    console.log('📊 Job offers sample:', offersQuery.rows);

    // 2. Verifica che la colonna tipo_intervento_new sia popolata
    console.log('\n🔄 Verifica migrazione colonne...');

    const migrationCheck = await client.query(`
      SELECT
        COUNT(*) as total_jobs,
        COUNT(tipo_intervento_new) as migrated_jobs,
        COUNT(*) - COUNT(tipo_intervento_new) as pending_migration
      FROM jobs
      WHERE service_type IS NOT NULL
    `);
    console.log('📊 Stato migrazione jobs:', migrationCheck.rows[0]);

    // 3. Se ci sono dati da migrare, fallo
    if (migrationCheck.rows[0].pending_migration > 0) {
      console.log('🔄 Migrazione dati pendenti...');

      const updateResult = await client.query(`
        UPDATE jobs
        SET tipo_intervento_new = CASE service_type::text
          WHEN 'SPRAY' THEN 'IRRORAZIONE'::tipo_intervento
          WHEN 'SPREAD' THEN 'SPANDIMENTO'::tipo_intervento
          WHEN 'MAPPING' THEN 'RILIEVO_AEREO'::tipo_intervento
          ELSE 'RILIEVO_AEREO'::tipo_intervento
        END
        WHERE tipo_intervento_new IS NULL AND service_type IS NOT NULL
      `);

      console.log(`✅ Migrati ${updateResult.rowCount} record aggiuntivi`);
    }

    // 4. Verifica consistenza dati
    console.log('\n🔍 Verifica consistenza dati...');

    const consistencyCheck = await client.query(`
      SELECT
        service_type,
        tipo_intervento_new,
        COUNT(*) as count
      FROM jobs
      WHERE service_type IS NOT NULL
      GROUP BY service_type, tipo_intervento_new
      ORDER BY service_type
    `);
    console.log('📊 Mappatura service_type → tipo_intervento_new:', consistencyCheck.rows);

    // 5. Verifica tabelle nuove
    console.log('\n🏗️ Verifica tabelle nuove...');

    const tables = [
      'coltura', 'appezzamento', 'drone', 'capacita_drone',
      'intervento', 'prodotto', 'prodotto_categoria',
      'principio_attivo', 'prodotto_principio_attivo',
      'intervento_materiale', 'rilievo_aereo', 'rilievo_indice'
    ];

    for (const table of tables) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`✅ Tabella ${table}: ${countResult.rows[0].count} record`);
      } catch (error) {
        console.log(`❌ Tabella ${table}: non trovata o errore`);
      }
    }

    // 6. Verifica enum
    console.log('\n📋 Verifica enum creati...');

    const enumQueries = [
      "SELECT enum_range(null::tipo_intervento) as tipo_intervento",
      "SELECT enum_range(null::classe_materiale) as classe_materiale",
      "SELECT enum_range(null::categoria_tecnica) as categoria_tecnica",
      "SELECT enum_range(null::tipo_rilievo) as tipo_rilievo",
      "SELECT enum_range(null::indice_vegetazione) as indice_vegetazione",
      "SELECT enum_range(null::forma_materiale) as forma_materiale",
      "SELECT enum_range(null::metodo_applicazione) as metodo_applicazione"
    ];

    for (const query of enumQueries) {
      try {
        const result = await client.query(query);
        const enumName = Object.keys(result.rows[0])[0];
        console.log(`✅ Enum ${enumName}: ${result.rows[0][enumName]}`);
      } catch (error) {
        console.log(`❌ Errore verifica enum: ${error.message}`);
      }
    }

    console.log('\n🎉 Verifica Supabase completata!');

  } catch (error) {
    console.error('❌ Errore controllo Supabase:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Esegui lo script
checkAndUpdateSupabaseData()
  .then(() => {
    console.log('✅ Script completato con successo');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script fallito:', error);
    process.exit(1);
  });
