/**
 * Script per migrare i dati dagli enum inglesi a quelli italiani
 * Mantiene la compatibilità con il sistema esistente
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

async function migrateToItalianEnums() {
  try {
    await client.connect();
    console.log('✅ Connesso a Supabase PostgreSQL');

    // Verifica dati esistenti nelle tabelle attuali
    console.log('🔍 Analisi dati esistenti...');

    const jobsResult = await client.query('SELECT service_type, COUNT(*) as count FROM jobs GROUP BY service_type');
    console.log('📊 Jobs per service_type:', jobsResult.rows);

    const jobOffersResult = await client.query('SELECT status, COUNT(*) as count FROM job_offers GROUP BY status');
    console.log('📊 Job offers per status:', jobOffersResult.rows);

    // 1. Rinominare gli enum esistenti per backup
    console.log('🔄 Rinominando enum esistenti per backup...');

    try {
      await client.query('ALTER TYPE "ServiceType" RENAME TO "ServiceType_EN";');
      console.log('✅ Rinominato ServiceType → ServiceType_EN');
    } catch (error) {
      console.log('⚠️ ServiceType già rinominato o non esistente:', error.message);
    }

    // 2. Creare i nuovi enum italiani (se non esistono già)
    console.log('🏗️ Creazione nuovi enum italiani...');

    const enumQueries = [
      `DO $$ BEGIN CREATE TYPE tipo_intervento AS ENUM ('IRRORAZIONE', 'SPANDIMENTO', 'RILIEVO_AEREO', 'SOLLEVAMENTO'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
      `DO $$ BEGIN CREATE TYPE classe_materiale AS ENUM ('DIFESA_FITOSANITARIA', 'NUTRIZIONE', 'AMMENDANTE_CORRETTIVO', 'SEMENTE', 'ALTRO'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
      `DO $$ BEGIN CREATE TYPE categoria_tecnica AS ENUM ('FUNGICIDA', 'INSETTICIDA', 'ACARICIDA', 'ERBICIDA', 'BATTERICIDA', 'MOLUSCHICIDA', 'NEMATOCIDA', 'BIOSTIMOLANTE', 'MICROELEMENTI', 'COADIUVANTE', 'CONCIME_ORGANICO', 'CONCIME_MINERALE', 'CORRETTIVO_CALCAREO', 'AMMENDANTE'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
      `DO $$ BEGIN CREATE TYPE tipo_rilievo AS ENUM ('ORTOFOTO_RGB', 'MULTISPETTRALE', 'TERMICO', 'MODELLO_3D', 'DSM_DEM'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
      `DO $$ BEGIN CREATE TYPE indice_vegetazione AS ENUM ('NDVI', 'NDRE', 'GNDVI', 'RECI'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
      `DO $$ BEGIN CREATE TYPE forma_materiale AS ENUM ('LIQUIDO', 'POLVERE', 'GRANULARE'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
      `DO $$ BEGIN CREATE TYPE metodo_applicazione AS ENUM ('AEREO_DRONE_AGRAS', 'AEREO_DRONE_ALTRI', 'MANUALE', 'ALTRO'); EXCEPTION WHEN duplicate_object THEN null; END $$;`
    ];

    for (const query of enumQueries) {
      await client.query(query);
    }
    console.log('✅ Enum italiani creati/verficati');

    // 3. Creare colonne temporanee per migrazione
    console.log('🔄 Preparazione colonne temporanee per migrazione...');

    // Aggiungere colonne nuove accanto a quelle esistenti
    try {
      await client.query('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tipo_intervento_new tipo_intervento;');
      await client.query('ALTER TABLE job_offers ADD COLUMN IF NOT EXISTS status_new TEXT;');
      console.log('✅ Colonne temporanee aggiunte');
    } catch (error) {
      console.log('⚠️ Colonne temporanee già esistenti');
    }

    // 4. Migrare i dati
    console.log('🔄 Migrazione dati...');

    // Migrare service_type in jobs
    await client.query(`
      UPDATE jobs
      SET tipo_intervento_new = CASE service_type::text
        WHEN 'SPRAY' THEN 'IRRORAZIONE'::tipo_intervento
        WHEN 'SPREAD' THEN 'SPANDIMENTO'::tipo_intervento
        WHEN 'MAPPING' THEN 'RILIEVO_AEREO'::tipo_intervento
        ELSE 'RILIEVO_AEREO'::tipo_intervento
      END
      WHERE tipo_intervento_new IS NULL;
    `);
    console.log('✅ Migrati service_type in jobs');

    // Verifica migrazione jobs
    const migratedJobs = await client.query('SELECT service_type, tipo_intervento_new, COUNT(*) as count FROM jobs GROUP BY service_type, tipo_intervento_new');
    console.log('📊 Migrazione jobs:', migratedJobs.rows);

    // 5. Creare nuove tabelle per il modello esaustivo (se non esistono)
    console.log('🏗️ Creazione tabelle modello esaustivo...');

    const tableQueries = [
      `CREATE TABLE IF NOT EXISTS coltura (
        id BIGSERIAL PRIMARY KEY,
        nome TEXT NOT NULL UNIQUE
      );`,
      `CREATE TABLE IF NOT EXISTS appezzamento (
        id BIGSERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        area_ha NUMERIC(10,3),
        comune TEXT,
        note TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS drone (
        id BIGSERIAL PRIMARY KEY,
        marca TEXT NOT NULL DEFAULT 'DJI',
        modello TEXT NOT NULL,
        seriale TEXT UNIQUE,
        note TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS capacita_drone (
        drone_id BIGINT NOT NULL REFERENCES drone(id) ON DELETE CASCADE,
        tipo tipo_intervento NOT NULL,
        PRIMARY KEY (drone_id, tipo)
      );`,
      `CREATE TABLE IF NOT EXISTS intervento (
        id BIGSERIAL PRIMARY KEY,
        tipo tipo_intervento NOT NULL,
        coltura_id BIGINT REFERENCES coltura(id),
        appezzamento_id BIGINT REFERENCES appezzamento(id),
        drone_id BIGINT REFERENCES drone(id),
        finestra_da TIMESTAMPTZ,
        finestra_a TIMESTAMPTZ,
        urgenza SMALLINT DEFAULT 0,
        pendenza_classe TEXT,
        accesso_classe TEXT,
        note TEXT,
        creato_il TIMESTAMPTZ NOT NULL DEFAULT now()
      );`,
      `CREATE TABLE IF NOT EXISTS prodotto (
        id BIGSERIAL PRIMARY KEY,
        nome_commerciale TEXT NOT NULL,
        produttore TEXT,
        classe classe_materiale NOT NULL,
        forma forma_materiale,
        note TEXT
      );`
    ];

    for (const query of tableQueries) {
      await client.query(query);
    }
    console.log('✅ Tabelle modello esaustivo create/verificate');

    // 6. Popolare dati di esempio per dimostrare il funzionamento
    console.log('🌱 Popolamento dati di esempio...');

    // Colture di esempio
    await client.query(`
      INSERT INTO coltura (nome) VALUES
      ('Vite'), ('Olivo'), ('Cereali'), ('Frutteti'), ('Ortaggi')
      ON CONFLICT (nome) DO NOTHING;
    `);

    // Droni DJI di esempio
    await client.query(`
      INSERT INTO drone (marca, modello, note) VALUES
      ('DJI', 'Agras T50', 'Drone irrorazione e spandimento professionale'),
      ('DJI', 'Agras T40', 'Drone irrorazione con payload fino a 40L'),
      ('DJI', 'Mavic 3 Multispectral', 'Drone rilievo aereo con sensori multispettrali'),
      ('DJI', 'Mavic 3 Thermal', 'Drone rilievo termico avanzato')
      ON CONFLICT (seriale) DO NOTHING;
    `);

    // Capacità droni
    await client.query(`
      INSERT INTO capacita_drone (drone_id, tipo) VALUES
      ((SELECT id FROM drone WHERE modello = 'Agras T50'), 'IRRORAZIONE'),
      ((SELECT id FROM drone WHERE modello = 'Agras T50'), 'SPANDIMENTO'),
      ((SELECT id FROM drone WHERE modello = 'Agras T40'), 'IRRORAZIONE'),
      ((SELECT id FROM drone WHERE modello = 'Mavic 3 Multispectral'), 'RILIEVO_AEREO'),
      ((SELECT id FROM drone WHERE modello = 'Mavic 3 Thermal'), 'RILIEVO_AEREO')
      ON CONFLICT (drone_id, tipo) DO NOTHING;
    `);

    console.log('✅ Dati di esempio popolati');

    // 7. Verifica finale
    console.log('🔍 Verifica migrazione completata...');

    const finalJobs = await client.query('SELECT tipo_intervento_new, COUNT(*) as count FROM jobs GROUP BY tipo_intervento_new');
    console.log('📊 Stato finale jobs:', finalJobs.rows);

    const droni = await client.query('SELECT modello, COUNT(*) as capacita FROM drone d JOIN capacita_drone cd ON d.id = cd.drone_id GROUP BY modello');
    console.log('📊 Droni e capacità:', droni.rows);

    console.log('🎉 Migrazione completata con successo!');
    console.log('');
    console.log('📊 Riepilogo migrazione:');
    console.log('• Enum inglesi rinominati in *_EN per backup');
    console.log('• Nuovi enum italiani creati');
    console.log('• Dati migrati mantenendo compatibilità');
    console.log('• Modello esaustivo pronto per DJI Agras e Mavic 3');

  } catch (error) {
    console.error('❌ Errore nella migrazione:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Esegui lo script
migrateToItalianEnums()
  .then(() => {
    console.log('✅ Migrazione completata con successo');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migrazione fallita:', error);
    process.exit(1);
  });
