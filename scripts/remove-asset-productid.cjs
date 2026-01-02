/**
 * Script di migrazione: rimuove colonna productId da assets
 * 
 * Asset ora usa solo sku_id per riferirsi a Product (via SKU)
 */

require('dotenv').config();
const { Client } = require('pg');

async function removeAssetProductId() {
  const client = new Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connesso al database');

    // Verifica se la colonna esiste
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'assets' AND column_name = 'productId'
    `);

    if (columnCheck.rows.length === 0) {
      console.log('✅ Colonna productId già rimossa da assets');
      return;
    }

    // Verifica se ci sono foreign key constraints
    const fkCheck = await client.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'assets' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%product%'
    `);

    if (fkCheck.rows.length > 0) {
      console.log('🔧 Rimuovo foreign key constraints...');
      for (const fk of fkCheck.rows) {
        await client.query(`ALTER TABLE assets DROP CONSTRAINT IF EXISTS "${fk.constraint_name}"`);
        console.log(`  ✅ Rimosso constraint: ${fk.constraint_name}`);
      }
    }

    // Rimuovi la colonna
    console.log('🔧 Rimuovo colonna productId da assets...');
    await client.query(`ALTER TABLE assets DROP COLUMN IF EXISTS "productId"`);
    console.log('✅ Colonna productId rimossa con successo');

    console.log('\n✅ Migrazione completata!');
    console.log('📝 Asset ora usa solo sku_id per riferirsi a Product (via SKU → Product)');

  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Esegui migrazione
removeAssetProductId()
  .then(() => {
    console.log('\n🎉 Script completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script fallito:', error);
    process.exit(1);
  });

