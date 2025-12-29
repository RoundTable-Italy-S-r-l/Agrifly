const { Client } = require('pg');

const client = new Client({
  host: process.env.PGHOST || 'aws-1-eu-central-2.pooler.supabase.com',
  port: parseInt(process.env.PGPORT || '6543'),
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER || 'postgres.fzowfkfwriajohjjboed',
  password: process.env.PGPASSWORD || '_Mszqe_%uF_82%@',
  ssl: { rejectUnauthorized: false }
});

async function checkSupabaseSchema() {
  try {
    await client.connect();
    console.log('✅ Connesso a Supabase PostgreSQL\n');

    // Lista tutte le tabelle
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log('📋 Tabelle in Supabase (totale: ' + tablesResult.rows.length + '):');
    tablesResult.rows.forEach(row => console.log('  - ' + row.table_name));

    // Verifica colonne della tabella organizations
    console.log('\n🔍 Colonne nella tabella organizations in Supabase:');
    const orgColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'organizations' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);

    orgColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });

    const hasIsCertified = orgColumns.rows.some(col => col.column_name === 'is_certified');
    console.log('\n✅ Colonna is_certified presente:', hasIsCertified ? 'SÌ ✅' : 'NO ❌');

    // Verifica alcune tabelle chiave
    console.log('\n📊 Verifica tabelle chiave:');
    const keyTables = ['organizations', 'users', 'jobs', 'job_offers', 'rate_cards', 'service_configurations'];
    for (const tableName of keyTables) {
      const exists = tablesResult.rows.some(row => row.table_name === tableName);
      console.log(`  ${exists ? '✅' : '❌'} ${tableName}`);
    }

    await client.end();
  } catch (err) {
    console.error('❌ Errore:', err.message);
    process.exit(1);
  }
}

checkSupabaseSchema();

