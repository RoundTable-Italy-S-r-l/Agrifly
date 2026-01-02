require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = new Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connessione a Supabase PostgreSQL...');
    await client.connect();
    console.log('✅ Connesso\n');

    const migrationPath = path.join(__dirname, '../prisma/migrations/20250101120000_add_response_metrics/migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📋 Esecuzione migration...');
    await client.query(migrationSQL);
    
    console.log('✅ Migration eseguita con successo!');
    
    // Verifica che le tabelle siano state create
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('response_events', 'response_metrics')
      ORDER BY table_name
    `);
    
    console.log('\n📊 Tabelle create:');
    tablesCheck.rows.forEach(row => console.log(`  ✅ ${row.table_name}`));
    
    // Verifica enum
    const enumCheck = await client.query(`
      SELECT typname 
      FROM pg_type 
      WHERE typname = 'EntityType'
    `);
    
    if (enumCheck.rows.length > 0) {
      console.log(`  ✅ Enum EntityType creato`);
    }
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Errore durante la migration:', error.message);
    if (error.code === '42P07') {
      console.log('⚠️  Le tabelle potrebbero già esistere. Verifica manualmente.');
    }
    await client.end();
    process.exit(1);
  }
}

runMigration();

