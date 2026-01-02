require('dotenv').config();
const { Client } = require('pg');

(async () => {
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
    
    // Aggiungi colonna purpose se non esiste
    console.log('📋 Aggiungo colonna purpose...');
    try {
      await client.query(`
        ALTER TABLE products 
        ADD COLUMN IF NOT EXISTS purpose TEXT
      `);
      console.log('✅ Colonna purpose aggiunta');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️  Colonna purpose già esistente');
      } else {
        throw error;
      }
    }
    
    // Aggiorna prodotti: tutti SPRAY e SPREAD tranne Mavic 3M che è MAPPING
    console.log('📋 Aggiorno purpose dei prodotti...');
    
    // Prodotti con SPRAY e SPREAD
    const spraySpreadProducts = ['prd_t100', 'prd_t25', 'prd_t25p', 'prd_t50', 'prd_t70p'];
    const spraySpreadPurpose = JSON.stringify(['SPRAY', 'SPREAD']);
    
    for (const productId of spraySpreadProducts) {
      const result = await client.query(
        'UPDATE products SET purpose = $1 WHERE id = $2',
        [spraySpreadPurpose, productId]
      );
      if (result.rowCount > 0) {
        console.log(`  ✅ ${productId}: SPRAY, SPREAD`);
      } else {
        console.log(`  ⚠️  ${productId}: prodotto non trovato`);
      }
    }
    
    // Mavic 3M con MAPPING
    const mavicPurpose = JSON.stringify(['MAPPING']);
    const mavicResult = await client.query(
      'UPDATE products SET purpose = $1 WHERE id = $2',
      [mavicPurpose, 'prd_mavic3m']
    );
    if (mavicResult.rowCount > 0) {
      console.log(`  ✅ prd_mavic3m: MAPPING`);
    } else {
      console.log(`  ⚠️  prd_mavic3m: prodotto non trovato`);
    }
    
    // Verifica risultati
    console.log('\n📋 Verifica purpose prodotti:');
    const verifyResult = await client.query(
      'SELECT id, name, purpose FROM products WHERE id IN ($1, $2, $3, $4, $5, $6)',
      ['prd_t100', 'prd_t25', 'prd_t25p', 'prd_t50', 'prd_t70p', 'prd_mavic3m']
    );
    verifyResult.rows.forEach(row => {
      console.log(`  ${row.name}: ${row.purpose || 'NULL'}`);
    });
    
    await client.end();
    console.log('\n✅ Completato!');
  } catch (error) {
    console.error('❌ Errore:', error.message);
    process.exit(1);
  }
})();

