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

async function checkLenziRateCards() {
  try {
    // Connessione a Supabase
    await pgClient.connect();
    console.log('✅ Connesso a Supabase PostgreSQL\n');

    const lenziOrgId = 'lenzi-org-id';

    // Prima verifica la struttura della tabella
    console.log('🔍 Verificando struttura tabella rate_cards in SQLite...');
    const tableInfo = sqliteDb.prepare(`PRAGMA table_info(rate_cards)`).all();
    const columnNames = tableInfo.map(col => col.name);
    console.log('Colonne disponibili:', columnNames.join(', '));
    
    // Determina quale colonna usare
    const orgColumn = columnNames.includes('seller_org_id') ? 'seller_org_id' : 
                     columnNames.includes('org_id') ? 'org_id' : null;
    
    if (!orgColumn) {
      console.log('❌ Nessuna colonna org_id o seller_org_id trovata in rate_cards');
      return;
    }
    
    console.log(`Usando colonna: ${orgColumn}\n`);
    
    // Cerca rate_cards in SQLite
    console.log('🔍 Cercando rate_cards in SQLite per Lenzi...');
    const sqliteRateCards = sqliteDb.prepare(`
      SELECT * FROM rate_cards 
      WHERE ${orgColumn} = ?
    `).all(lenziOrgId);

    console.log(`\n📊 Rate cards in SQLite: ${sqliteRateCards.length}`);
    if (sqliteRateCards.length > 0) {
      sqliteRateCards.forEach((card, index) => {
        console.log(`\n  ${index + 1}. Rate Card ID: ${card.id}`);
        console.log(`     - ${orgColumn}: ${card[orgColumn]}`);
        console.log(`     - service_type: ${card.service_type || 'N/A'}`);
        console.log(`     - crop_type: ${card.crop_type || 'N/A'}`);
        console.log(`     - treatment_type: ${card.treatment_type || 'N/A'}`);
        console.log(`     - base_rate_per_ha_cents: ${card.base_rate_per_ha_cents || 'N/A'}`);
        console.log(`     - is_active: ${card.is_active || 'N/A'}`);
        console.log(`     - created_at: ${card.created_at || 'N/A'}`);
      });
    }

    // Cerca rate_cards in Supabase (usa seller_org_id)
    console.log(`\n🔍 Cercando rate_cards in Supabase per seller_org_id: ${lenziOrgId}...`);
    const pgRateCards = await pgClient.query(`
      SELECT * FROM rate_cards 
      WHERE seller_org_id = $1
    `, [lenziOrgId]);

    console.log(`\n📊 Rate cards in Supabase: ${pgRateCards.rows.length}`);
    if (pgRateCards.rows.length > 0) {
      pgRateCards.rows.forEach((card, index) => {
        console.log(`\n  ${index + 1}. Rate Card ID: ${card.id}`);
        console.log(`     - org_id/seller_org_id: ${card.org_id || card.seller_org_id}`);
        console.log(`     - service_type: ${card.service_type || 'N/A'}`);
        console.log(`     - crop_type: ${card.crop_type || 'N/A'}`);
        console.log(`     - treatment_type: ${card.treatment_type || 'N/A'}`);
        console.log(`     - base_rate_per_ha_cents: ${card.base_rate_per_ha_cents || 'N/A'}`);
      });
    }

    // Confronto
    console.log(`\n📊 RIEPILOGO:`);
    console.log(`  - SQLite: ${sqliteRateCards.length} rate cards`);
    console.log(`  - Supabase: ${pgRateCards.rows.length} rate cards`);
    
    if (sqliteRateCards.length > pgRateCards.rows.length) {
      console.log(`\n⚠️  Ci sono ${sqliteRateCards.length - pgRateCards.rows.length} rate cards in SQLite che non ci sono in Supabase`);
      console.log(`\nVuoi sincronizzarli?`);
      
      // Mostra quali mancano
      const sqliteIds = new Set(sqliteRateCards.map(c => c.id));
      const pgIds = new Set(pgRateCards.rows.map(c => c.id));
      const missingIds = sqliteRateCards.filter(c => !pgIds.has(c.id));
      
      if (missingIds.length > 0) {
        console.log(`\nRate cards da sincronizzare:`);
        missingIds.forEach(card => {
          console.log(`  - ${card.id}: ${card.service_type || 'N/A'}`);
        });
      }
    } else if (sqliteRateCards.length === pgRateCards.rows.length) {
      console.log(`\n✅ Stesso numero di rate cards in entrambi i database`);
    } else {
      console.log(`\n⚠️  Ci sono più rate cards in Supabase che in SQLite`);
    }

  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error(error.stack);
  } finally {
    sqliteDb.close();
    await pgClient.end();
  }
}

checkLenziRateCards();

