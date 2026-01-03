/**
 * Script per creare il nuovo schema italiano in Supabase
 * con enum italiani e modello dati esaustivo per DJI Agras e Mavic 3
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

async function createItalianSchema() {
  try {
    await client.connect();
    console.log('✅ Connesso a Supabase PostgreSQL');

    // Creazione enum italiani
    console.log('🏗️ Creazione enum italiani...');

    // Macro-categorie di intervento
    await client.query(`
      CREATE TYPE tipo_intervento AS ENUM (
        'IRRORAZIONE',
        'SPANDIMENTO',
        'RILIEVO_AEREO',
        'SOLLEVAMENTO'
      );
    `);
    console.log('✅ Creato enum tipo_intervento');

    // Classi di materiale/obiettivo
    await client.query(`
      CREATE TYPE classe_materiale AS ENUM (
        'DIFESA_FITOSANITARIA',
        'NUTRIZIONE',
        'AMMENDANTE_CORRETTIVO',
        'SEMENTE',
        'ALTRO'
      );
    `);
    console.log('✅ Creato enum classe_materiale');

    // Categorie tecniche (multi-categoria)
    await client.query(`
      CREATE TYPE categoria_tecnica AS ENUM (
        'FUNGICIDA',
        'INSETTICIDA',
        'ACARICIDA',
        'ERBICIDA',
        'BATTERICIDA',
        'MOLUSCHICIDA',
        'NEMATOCIDA',
        'BIOSTIMOLANTE',
        'MICROELEMENTI',
        'COADIUVANTE',
        'CONCIME_ORGANICO',
        'CONCIME_MINERALE',
        'CORRETTIVO_CALCAREO',
        'AMMENDANTE'
      );
    `);
    console.log('✅ Creato enum categoria_tecnica');

    // Tipi di rilievo (Mavic 3 / payload sensori)
    await client.query(`
      CREATE TYPE tipo_rilievo AS ENUM (
        'ORTOFOTO_RGB',
        'MULTISPETTRALE',
        'TERMICO',
        'MODELLO_3D',
        'DSM_DEM'
      );
    `);
    console.log('✅ Creato enum tipo_rilievo');

    // Indici vegetazionali
    await client.query(`
      CREATE TYPE indice_vegetazione AS ENUM (
        'NDVI',
        'NDRE',
        'GNDVI',
        'RECI'
      );
    `);
    console.log('✅ Creato enum indice_vegetazione');

    // Forma del materiale
    await client.query(`
      CREATE TYPE forma_materiale AS ENUM (
        'LIQUIDO',
        'POLVERE',
        'GRANULARE'
      );
    `);
    console.log('✅ Creato enum forma_materiale');

    // Metodo applicazione (Agras)
    await client.query(`
      CREATE TYPE metodo_applicazione AS ENUM (
        'AEREO_DRONE_AGRAS',
        'AEREO_DRONE_ALTRI',
        'MANUALE',
        'ALTRO'
      );
    `);
    console.log('✅ Creato enum metodo_applicazione');

    // Creazione tabelle anagrafiche
    console.log('🏗️ Creazione tabelle anagrafiche...');

    await client.query(`
      CREATE TABLE coltura (
        id BIGSERIAL PRIMARY KEY,
        nome TEXT NOT NULL UNIQUE
      );
    `);
    console.log('✅ Creata tabella coltura');

    await client.query(`
      CREATE TABLE appezzamento (
        id BIGSERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        area_ha NUMERIC(10,3),
        comune TEXT,
        note TEXT
      );
    `);
    console.log('✅ Creata tabella appezzamento');

    // Droni e capacità
    await client.query(`
      CREATE TABLE drone (
        id BIGSERIAL PRIMARY KEY,
        marca TEXT NOT NULL DEFAULT 'DJI',
        modello TEXT NOT NULL,
        seriale TEXT UNIQUE,
        note TEXT
      );
    `);
    console.log('✅ Creata tabella drone');

    await client.query(`
      CREATE TABLE capacita_drone (
        drone_id BIGINT NOT NULL REFERENCES drone(id) ON DELETE CASCADE,
        tipo tipo_intervento NOT NULL,
        PRIMARY KEY (drone_id, tipo)
      );
    `);
    console.log('✅ Creata tabella capacita_drone');

    // Interventi (la "missione")
    await client.query(`
      CREATE TABLE intervento (
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
      );
    `);
    console.log('✅ Creata tabella intervento');

    await client.query(`CREATE INDEX idx_intervento_tipo ON intervento(tipo);`);
    await client.query(`CREATE INDEX idx_intervento_coltura ON intervento(coltura_id);`);
    await client.query(`CREATE INDEX idx_intervento_appezzamento ON intervento(appezzamento_id);`);

    // Materiali / Prodotti
    await client.query(`
      CREATE TABLE prodotto (
        id BIGSERIAL PRIMARY KEY,
        nome_commerciale TEXT NOT NULL,
        produttore TEXT,
        classe classe_materiale NOT NULL,
        forma forma_materiale,
        note TEXT
      );
    `);
    console.log('✅ Creata tabella prodotto');

    await client.query(`
      CREATE TABLE prodotto_categoria (
        prodotto_id BIGINT NOT NULL REFERENCES prodotto(id) ON DELETE CASCADE,
        categoria categoria_tecnica NOT NULL,
        PRIMARY KEY (prodotto_id, categoria)
      );
    `);
    console.log('✅ Creata tabella prodotto_categoria');

    await client.query(`
      CREATE TABLE principio_attivo (
        id BIGSERIAL PRIMARY KEY,
        nome TEXT NOT NULL UNIQUE
      );
    `);
    console.log('✅ Creata tabella principio_attivo');

    await client.query(`
      CREATE TABLE prodotto_principio_attivo (
        prodotto_id BIGINT NOT NULL REFERENCES prodotto(id) ON DELETE CASCADE,
        principio_attivo_id BIGINT NOT NULL REFERENCES principio_attivo(id) ON DELETE RESTRICT,
        PRIMARY KEY (prodotto_id, principio_attivo_id)
      );
    `);
    console.log('✅ Creata tabella prodotto_principio_attivo');

    await client.query(`
      CREATE TABLE intervento_materiale (
        id BIGSERIAL PRIMARY KEY,
        intervento_id BIGINT NOT NULL REFERENCES intervento(id) ON DELETE CASCADE,
        prodotto_id BIGINT NOT NULL REFERENCES prodotto(id) ON DELETE RESTRICT,
        quantita NUMERIC(12,3),
        unita TEXT,
        note TEXT
      );
    `);
    console.log('✅ Creata tabella intervento_materiale');

    await client.query(`CREATE INDEX idx_intervento_materiale_intervento ON intervento_materiale(intervento_id);`);

    // Rilievi aerei (Mavic 3 / output)
    await client.query(`
      CREATE TABLE rilievo_aereo (
        id BIGSERIAL PRIMARY KEY,
        intervento_id BIGINT NOT NULL UNIQUE REFERENCES intervento(id) ON DELETE CASCADE,
        tipo tipo_rilievo NOT NULL,
        note TEXT
      );
    `);
    console.log('✅ Creata tabella rilievo_aereo');

    await client.query(`
      CREATE TABLE rilievo_indice (
        id BIGSERIAL PRIMARY KEY,
        rilievo_id BIGINT NOT NULL REFERENCES rilievo_aereo(id) ON DELETE CASCADE,
        indice indice_vegetazione NOT NULL,
        file_uri TEXT,
        creato_il TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    console.log('✅ Creata tabella rilievo_indice');

    await client.query(`CREATE INDEX idx_rilievo_indice_rilievo ON rilievo_indice(rilievo_id);`);

    console.log('🎉 Schema italiano creato con successo!');
    console.log('');
    console.log('📊 Riepilogo:');
    console.log('• 7 enum italiani creati');
    console.log('• 10 tabelle nuove create');
    console.log('• Modello dati esaustivo per DJI Agras e Mavic 3');

  } catch (error) {
    console.error('❌ Errore nella creazione dello schema:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Esegui lo script
createItalianSchema()
  .then(() => {
    console.log('✅ Script completato con successo');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script fallito:', error);
    process.exit(1);
  });
