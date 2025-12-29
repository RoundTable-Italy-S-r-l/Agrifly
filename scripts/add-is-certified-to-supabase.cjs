const { Client } = require('pg');

const client = new Client({
  host: process.env.PGHOST || 'aws-1-eu-central-2.pooler.supabase.com',
  port: parseInt(process.env.PGPORT || '6543'),
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER || 'postgres.fzowfkfwriajohjjboed',
  password: process.env.PGPASSWORD || '_Mszqe_%uF_82%@',
  ssl: { rejectUnauthorized: false }
});

async function addIsCertifiedColumn() {
  try {
    await client.connect();
    console.log('✅ Connesso a Supabase PostgreSQL\n');

    // Verifica se la colonna esiste già
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns
      WHERE table_name = 'organizations' 
        AND column_name = 'is_certified'
        AND table_schema = 'public'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ La colonna is_certified esiste già in Supabase!');
      await client.end();
      return;
    }

    console.log('📝 Aggiungendo colonna is_certified alla tabella organizations...');

    // Aggiungi la colonna
    await client.query(`
      ALTER TABLE organizations 
      ADD COLUMN is_certified BOOLEAN DEFAULT false NOT NULL
    `);

    console.log('✅ Colonna is_certified aggiunta con successo!');
    console.log('   Tipo: BOOLEAN');
    console.log('   Default: false');
    console.log('   NOT NULL: true\n');

    // Verifica l'aggiunta
    const verify = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'organizations' 
        AND column_name = 'is_certified'
        AND table_schema = 'public'
    `);

    if (verify.rows.length > 0) {
      const col = verify.rows[0];
      console.log('✅ Verifica colonna:');
      console.log(`   Nome: ${col.column_name}`);
      console.log(`   Tipo: ${col.data_type}`);
      console.log(`   Nullable: ${col.is_nullable}`);
      console.log(`   Default: ${col.column_default}`);
    }

    // Conta organizzazioni
    const count = await client.query('SELECT COUNT(*) as total FROM organizations');
    console.log(`\n📊 Totale organizzazioni in Supabase: ${count.rows[0].total}`);
    console.log('   Tutte le organizzazioni esistenti hanno is_certified = false (default)\n');

    await client.end();
  } catch (err) {
    console.error('❌ Errore:', err.message);
    if (err.message.includes('already exists')) {
      console.log('   La colonna esiste già!');
    }
    process.exit(1);
  }
}

addIsCertifiedColumn();

