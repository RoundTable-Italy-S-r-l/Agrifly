const { Client } = require('pg');
require('dotenv/config');

const client = new Client({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '6543'),
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function checkWishlistSchema() {
  try {
    await client.connect();
    console.log('✅ Connesso a Supabase PostgreSQL\n');

    // Verifica colonne della tabella wishlist_items
    console.log('🔍 Colonne nella tabella wishlist_items:');
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'wishlist_items' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);

    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable === 'YES' ? 'YES' : 'NO'}) ${col.column_default ? `default: ${col.column_default}` : ''}`);
    });

    const hasSkuId = columns.rows.some(col => col.column_name === 'sku_id');
    const hasProductId = columns.rows.some(col => col.column_name === 'product_id');
    const skuIdNullable = columns.rows.find(col => col.column_name === 'sku_id')?.is_nullable === 'YES';

    console.log('\n📊 Riepilogo:');
    console.log(`  - sku_id presente: ${hasSkuId ? '✅' : '❌'}`);
    console.log(`  - sku_id nullable: ${skuIdNullable ? '✅' : '❌'}`);
    console.log(`  - product_id presente: ${hasProductId ? '✅' : '❌'}`);

    if (hasSkuId && !skuIdNullable) {
      console.log('\n⚠️  sku_id è NOT NULL, deve essere resa nullable');
    }

    if (!hasProductId) {
      console.log('\n⚠️  product_id mancante, deve essere aggiunta');
    }

    // Conta i record
    const countResult = await client.query('SELECT COUNT(*) as count FROM wishlist_items');
    console.log(`\n📈 Record totali in wishlist_items: ${countResult.rows[0].count}`);

  } catch (error) {
    console.error('❌ Errore:', error.message);
  } finally {
    await client.end();
  }
}

checkWishlistSchema();

