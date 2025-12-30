const { Client } = require('pg');
const fs = require('fs');

// Leggi le credenziali dal file .env
const envContent = fs.readFileSync('.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.replace(/"/g, '');
  }
});

const client = new Client({
  host: envVars.PGHOST,
  port: envVars.PGPORT,
  database: envVars.PGDATABASE,
  user: envVars.PGUSER,
  password: envVars.PGPASSWORD,
  ssl: { rejectUnauthorized: false }
});

console.log('🔍 Testando connessione a Supabase PostgreSQL...');
console.log('Host:', envVars.PGHOST);
console.log('Database:', envVars.PGDATABASE);
console.log('User:', envVars.PGUSER);

async function testConnection() {
  try {
    await client.connect();
    console.log('✅ Connessione riuscita!');

    // Test versione PostgreSQL
    const versionResult = await client.query('SELECT version()');
    console.log('📊 Versione PostgreSQL:', versionResult.rows[0].version);

    // Lista tabelle
    const tablesResult = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name LIMIT 10");
    console.log('📋 Prime 10 tabelle nel database:');
    tablesResult.rows.forEach(row => console.log('  -', row.table_name));

    // Conteggio totale tabelle
    const countResult = await client.query("SELECT COUNT(*) as total_tables FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('📈 Numero totale di tabelle:', countResult.rows[0].total_tables);

    // Test lettura dati se esistono tabelle
    if (tablesResult.rows.length > 0) {
      const firstTable = tablesResult.rows[0].table_name;
      try {
        const sampleData = await client.query(`SELECT * FROM "${firstTable}" LIMIT 3`);
        console.log(`📝 Sample data from ${firstTable}:`);
        if (sampleData.rows.length > 0) {
          console.log('   Record count:', sampleData.rows.length);
          console.log('   Columns:', Object.keys(sampleData.rows[0]));
        } else {
          console.log('   Tabella vuota');
        }
      } catch (err) {
        console.log(`   ⚠️  Non posso leggere ${firstTable}:`, err.message);
      }
    }

  } catch (err) {
    console.error('❌ Errore di connessione:', err.message);
    if (err.code) {
      console.error('Codice errore:', err.code);
    }
  } finally {
    await client.end();
  }
}

testConnection();
