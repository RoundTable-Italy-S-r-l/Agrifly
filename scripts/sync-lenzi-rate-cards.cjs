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

async function syncLenziRateCards() {
  try {
    // Connessione a Supabase
    await pgClient.connect();
    console.log('✅ Connesso a Supabase PostgreSQL\n');

    const lenziOrgId = 'lenzi-org-id';

    // Ottieni tutte le rate cards di Lenzi da SQLite
    console.log('🔍 Recuperando rate cards da SQLite...');
    const sqliteRateCards = sqliteDb.prepare(`
      SELECT * FROM rate_cards 
      WHERE seller_org_id = ?
    `).all(lenziOrgId);

    console.log(`Trovate ${sqliteRateCards.length} rate cards in SQLite\n`);

    // Verifica quali colonne esistono in Supabase
    const pgColumns = await pgClient.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'rate_cards' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    const pgColumnNames = pgColumns.rows.map(c => c.column_name);
    console.log(`Colonne disponibili in Supabase: ${pgColumnNames.length}\n`);

    // Sincronizza ogni rate card
    // Nota: c'è un constraint UNIQUE su (seller_org_id, service_type)
    // Quindi usiamo ON CONFLICT per aggiornare quelle esistenti
    for (const card of sqliteRateCards) {
      console.log(`\n📋 Sincronizzando rate card: ${card.id} (${card.service_type})`);
      
      // Costruisci colonne e valori solo con colonne esistenti
      const columns = [];
      const placeholders = [];
      const values = [];
      let paramIndex = 1;

      for (const key in card) {
        if (!pgColumnNames.includes(key)) {
          continue; // Salta colonne che non esistono
        }
        
        columns.push(key);
        placeholders.push(`$${paramIndex}`);
        values.push(card[key]);
        paramIndex++;
      }

      // Costruisci UPDATE per ON CONFLICT (escludi ID e seller_org_id e service_type dal SET)
      const updateColumns = columns.filter(c => !['id', 'seller_org_id', 'service_type'].includes(c));
      const updateSet = updateColumns.map((col, idx) => {
        const valueIdx = columns.indexOf(col) + 1;
        return `${col} = $${valueIdx}`;
      });

      try {
        await pgClient.query(`
          INSERT INTO rate_cards (${columns.join(', ')})
          VALUES (${placeholders.join(', ')})
          ON CONFLICT (seller_org_id, service_type) 
          DO UPDATE SET ${updateSet.join(', ')}
        `, values);
        
        console.log(`  ✅ Sincronizzata (inserita o aggiornata)`);
      } catch (err) {
        console.log(`  ⚠️  Errore: ${err.message}`);
      }
    }

    // Verifica finale
    console.log(`\n\n📊 Verifica finale...`);
    const finalCheck = await pgClient.query(`
      SELECT COUNT(*) as count FROM rate_cards WHERE seller_org_id = $1
    `, [lenziOrgId]);
    
    console.log(`✅ Rate cards di Lenzi in Supabase: ${finalCheck.rows[0].count}`);
    console.log(`✅ Rate cards di Lenzi in SQLite: ${sqliteRateCards.length}`);

  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    sqliteDb.close();
    await pgClient.end();
  }
}

syncLenziRateCards();

