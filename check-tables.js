import pg from 'pg';
const { Client } = pg;

// Proviamo con le credenziali originali Supabase
const client = new Client({
  host: 'db.fzowfkfwriajohjjboed.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Agrifly2024!',
  ssl: { rejectUnauthorized: false }
});

async function checkDatabase() {
  try {
    await client.connect();
    console.log('✅ Connesso al database');

    // Lista delle tabelle
    const tablesResult = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );

    console.log('\n📋 Tabelle esistenti:');
    tablesResult.rows.forEach(row => console.log('  - ' + row.table_name));

    // Controlla se esiste la tabella assets
    const assetsExists = tablesResult.rows.some(row => row.table_name === 'assets');
    if (assetsExists) {
      console.log('\n✅ La tabella "assets" esiste!');

      // Mostra struttura della tabella assets
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'assets' AND table_schema = 'public'
        ORDER BY ordinal_position
      `);

      console.log('📊 Struttura tabella assets:');
      columnsResult.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });

      // Mostra alcuni record dalla tabella assets
      const assetsResult = await client.query('SELECT * FROM assets LIMIT 5');
      console.log('\n📈 Primi 5 record dalla tabella assets:');
      assetsResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${JSON.stringify(row)}`);
      });

    } else {
      console.log('\n❌ La tabella "assets" NON esiste');
    }

  } catch (err) {
    console.error('❌ Errore:', err.message);
  } finally {
    await client.end();
  }
}

checkDatabase();
