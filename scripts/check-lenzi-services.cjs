const Database = require('better-sqlite3');
const { Client } = require('pg');
require('dotenv/config');

// SQLite locale
const sqliteDb = new Database('./prisma/dev.db');

// PostgreSQL Supabase
const pgClient = new Client({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '6543'),
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function checkLenziServices() {
  try {
    // Connessione a Supabase
    await pgClient.connect();
    console.log('✅ Connesso a Supabase PostgreSQL\n');

    // Trova org_id di Lenzi in SQLite
    console.log('🔍 Cercando organizzazione Lenzi in SQLite...');
    const lenziOrg = sqliteDb.prepare(`
      SELECT id, legal_name FROM organizations 
      WHERE legal_name LIKE '%Lenzi%' OR id LIKE '%lenzi%'
    `).all();

    if (lenziOrg.length === 0) {
      console.log('❌ Organizzazione Lenzi non trovata in SQLite');
      return;
    }

    console.log('📋 Organizzazioni Lenzi trovate in SQLite:');
    lenziOrg.forEach(org => {
      console.log(`  - ${org.id}: ${org.legal_name}`);
    });

    const lenziOrgId = lenziOrg[0].id;
    console.log(`\n🎯 Usando org_id: ${lenziOrgId}\n`);

    // Cerca service_configurations in SQLite
    console.log('🔍 Cercando service_configurations in SQLite...');
    const sqliteServices = sqliteDb.prepare(`
      SELECT * FROM service_configurations 
      WHERE org_id = ?
    `).all(lenziOrgId);

    console.log(`\n📊 Service configurations in SQLite: ${sqliteServices.length}`);
    if (sqliteServices.length > 0) {
      sqliteServices.forEach((service, index) => {
        console.log(`\n  ${index + 1}. Service Configuration ID: ${service.id}`);
        console.log(`     - org_id: ${service.org_id}`);
        console.log(`     - base_location_lat: ${service.base_location_lat}`);
        console.log(`     - base_location_lng: ${service.base_location_lng}`);
        console.log(`     - service_type: ${service.service_type || 'N/A'}`);
        console.log(`     - created_at: ${service.created_at}`);
        console.log(`     - updated_at: ${service.updated_at || 'N/A'}`);
        // Mostra tutte le colonne
        const columns = Object.keys(service);
        console.log(`     - Colonne totali: ${columns.length}`);
        columns.forEach(col => {
          if (!['id', 'org_id', 'created_at', 'updated_at'].includes(col)) {
            const value = service[col];
            if (value !== null && value !== undefined && value !== '') {
              console.log(`       * ${col}: ${typeof value === 'object' ? JSON.stringify(value).substring(0, 100) : value}`);
            }
          }
        });
      });
    }

    // Cerca service_configurations in Supabase
    console.log(`\n🔍 Cercando service_configurations in Supabase per org_id: ${lenziOrgId}...`);
    const pgServices = await pgClient.query(`
      SELECT * FROM service_configurations 
      WHERE org_id = $1
    `, [lenziOrgId]);

    console.log(`\n📊 Service configurations in Supabase: ${pgServices.rows.length}`);
    if (pgServices.rows.length > 0) {
      pgServices.rows.forEach((service, index) => {
        console.log(`\n  ${index + 1}. Service Configuration ID: ${service.id}`);
        console.log(`     - org_id: ${service.org_id}`);
        console.log(`     - base_location_lat: ${service.base_location_lat}`);
        console.log(`     - base_location_lng: ${service.base_location_lng}`);
      });
    }

    // Confronto
    console.log(`\n📊 RIEPILOGO:`);
    console.log(`  - SQLite: ${sqliteServices.length} servizi`);
    console.log(`  - Supabase: ${pgServices.rows.length} servizi`);
    
    if (sqliteServices.length > pgServices.rows.length) {
      console.log(`\n⚠️  Ci sono ${sqliteServices.length - pgServices.rows.length} servizi in SQLite che non ci sono in Supabase`);
      console.log(`\nVuoi sincronizzarli? (esegui lo script di sincronizzazione)`);
    } else if (sqliteServices.length === pgServices.rows.length) {
      console.log(`\n✅ Stesso numero di servizi in entrambi i database`);
    } else {
      console.log(`\n⚠️  Ci sono più servizi in Supabase che in SQLite`);
    }

    // Mostra struttura tabella per riferimento
    console.log(`\n🔍 Struttura tabella service_configurations in SQLite:`);
    const tableInfo = sqliteDb.prepare(`PRAGMA table_info(service_configurations)`).all();
    tableInfo.forEach(col => {
      console.log(`  - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : 'NULL'} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
    });

  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error(error.stack);
  } finally {
    sqliteDb.close();
    await pgClient.end();
  }
}

checkLenziServices();

