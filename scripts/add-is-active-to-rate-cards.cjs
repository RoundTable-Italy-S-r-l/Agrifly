const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function addIsActiveColumn() {
  try {
    console.log('🔗 Connessione a Supabase...');
    await client.connect();
    console.log('✅ Connesso a Supabase');

    // Verifica se la colonna esiste già
    const checkColumn = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'rate_cards' 
        AND column_name = 'is_active'
        AND table_schema = 'public'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ Colonna is_active già esistente in rate_cards');
      await client.end();
      return;
    }

    // Aggiungi la colonna is_active
    console.log('📋 Aggiunta colonna is_active a rate_cards...');
    await client.query(`
      ALTER TABLE rate_cards 
      ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true
    `);
    console.log('✅ Colonna is_active aggiunta con successo');

    // Imposta tutti i record esistenti come attivi
    console.log('📋 Impostazione is_active = true per tutti i record esistenti...');
    await client.query(`
      UPDATE rate_cards 
      SET is_active = true 
      WHERE is_active IS NULL
    `);
    console.log('✅ Tutti i record impostati come attivi');

    await client.end();
    console.log('✅ Migrazione completata con successo');
  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
    await client.end();
    process.exit(1);
  }
}

addIsActiveColumn();

