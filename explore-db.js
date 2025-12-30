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

async function exploreDatabase() {
  try {
    await client.connect();
    console.log('🔍 Esplorando il database Supabase...\n');

    // Tutte le tabelle con conteggio righe
    const tablesResult = await client.query(`
      SELECT table_name,
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as columns_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📋 Tutte le tabelle nel database:');
    for (const table of tablesResult.rows) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) as count FROM "${table.table_name}"`);
        const count = countResult.rows[0].count;
        console.log(`  - ${table.table_name} (${table.columns_count} colonne, ${count} righe)`);
      } catch (err) {
        console.log(`  - ${table.table_name} (${table.columns_count} colonne, errore lettura)`);
      }
    }

    console.log('\n🔍 Esplorando tabelle con dati...\n');

    // Trova tabelle con dati
    const tablesWithData = [];
    for (const table of tablesResult.rows.slice(0, 20)) { // Prima 20 tabelle
      try {
        const countResult = await client.query(`SELECT COUNT(*) as count FROM "${table.table_name}"`);
        const count = parseInt(countResult.rows[0].count);
        if (count > 0) {
          tablesWithData.push({ name: table.table_name, count, columns: table.columns_count });
        }
      } catch (err) {
        // Ignora errori
      }
    }

    if (tablesWithData.length === 0) {
      console.log('⚠️  Nessuna tabella contiene dati al momento.');
      return;
    }

    console.log(`📊 Tabelle con dati (${tablesWithData.length} trovate):`);
    tablesWithData.forEach(table => {
      console.log(`  - ${table.name}: ${table.count} righe, ${table.columns} colonne`);
    });

    // Mostra struttura e sample data della prima tabella con dati
    const firstTable = tablesWithData[0];
    console.log(`\n🔬 Analisi dettagliata di "${firstTable.name}":`);

    try {
      // Struttura tabella
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public'
        ORDER BY ordinal_position
      `, [firstTable.name]);

      console.log('  📏 Colonne:');
      columnsResult.rows.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`    - ${col.column_name} (${col.data_type}) ${nullable}${defaultVal}`);
      });

      // Sample data
      const sampleResult = await client.query(`SELECT * FROM "${firstTable.name}" LIMIT 2`);
      console.log(`\n  📝 Sample data (${sampleResult.rows.length} righe):`);
      if (sampleResult.rows.length > 0) {
        sampleResult.rows.forEach((row, index) => {
          console.log(`    Riga ${index + 1}:`, JSON.stringify(row, null, 2));
        });
      }

    } catch (err) {
      console.log(`  ❌ Errore nell'analisi di ${firstTable.name}:`, err.message);
    }

  } catch (err) {
    console.error('❌ Errore di connessione:', err.message);
  } finally {
    await client.end();
  }
}

exploreDatabase();
