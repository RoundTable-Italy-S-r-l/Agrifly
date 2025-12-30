const { Client } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

// Configurazione Supabase
const supabaseConfig = {
  host: process.env.PGHOST || 'aws-1-eu-central-2.pooler.supabase.com',
  port: Number(process.env.PGPORT || 6543),
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER || 'postgres.fzowfkfwriajohjjboed',
  password: process.env.PGPASSWORD || '_Mszqe_%uF_82%@',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
};

// Path database SQLite locale
const sqlitePath = path.join(__dirname, '../prisma/dev.db');

// Tabelle da confrontare (quelle che contengono dati importanti)
const tablesToCompare = [
  'users',
  'organizations',
  'org_memberships',
  'jobs',
  'job_offers',
  'bookings',
  'saved_fields',
  'rate_cards',
  'service_configurations',
  'products',
  'skus',
  'vendor_catalog_items',
  'price_lists',
  'price_list_items',
  'shopping_carts',
  'cart_items',
  'wishlist_items',
  'orders',
  'order_lines',
  'addresses',
  'operator_profiles',
  'service_area_sets',
  'verification_codes',
  'organization_invitations',
];

async function compareTableData(pgClient, sqliteDb, tableName) {
  try {
    // Verifica che la tabella esista in entrambi i database
    const pgTableExists = await pgClient.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_name = $1 AND table_schema = 'public'
    `, [tableName]);
    
    if (pgTableExists.rows[0].count === '0') {
      return { exists: false, reason: 'Non esiste in Supabase' };
    }
    
    // Verifica esistenza in SQLite
    try {
      const sqliteTableInfo = sqliteDb.prepare(`PRAGMA table_info(${tableName})`).all();
      if (sqliteTableInfo.length === 0) {
        return { exists: false, reason: 'Non esiste in SQLite' };
      }
    } catch (e) {
      return { exists: false, reason: 'Non esiste in SQLite' };
    }
    
    // Ottieni tutti i record da PostgreSQL
    const pgResult = await pgClient.query(`SELECT * FROM ${tableName} ORDER BY id`);
    const pgRows = pgResult.rows;
    
    // Ottieni tutti i record da SQLite
    const sqliteResult = sqliteDb.prepare(`SELECT * FROM ${tableName} ORDER BY id`).all();
    const sqliteRows = sqliteResult;
    
    // Crea set di ID
    const pgIds = new Set(pgRows.map(r => r.id));
    const sqliteIds = new Set(sqliteRows.map(r => r.id));
    
    // Record solo in PostgreSQL
    const onlyInPG = pgRows.filter(r => !sqliteIds.has(r.id));
    
    // Record solo in SQLite
    const onlyInSQLite = sqliteRows.filter(r => !pgIds.has(r.id));
    
    // Record comuni (confronta valori)
    const commonIds = new Set([...pgIds].filter(id => sqliteIds.has(id)));
    const differentValues = [];
    
    for (const id of commonIds) {
      const pgRow = pgRows.find(r => r.id === id);
      const sqliteRow = sqliteRows.find(r => r.id === id);
      
      // Converte entrambi in oggetti JSON per confronto
      const pgJson = JSON.stringify(sortObject(pgRow));
      const sqliteJson = JSON.stringify(sortObject(sqliteRow));
      
      if (pgJson !== sqliteJson) {
        // Trova le differenze nei campi
        const differences = [];
        const allKeys = new Set([...Object.keys(pgRow || {}), ...Object.keys(sqliteRow || {})]);
        
        for (const key of allKeys) {
          const pgVal = pgRow?.[key];
          const sqliteVal = sqliteRow?.[key];
          
          // Normalizza per confronto (date, boolean, null)
          const pgNormalized = normalizeValue(pgVal);
          const sqliteNormalized = normalizeValue(sqliteVal);
          
          if (pgNormalized !== sqliteNormalized) {
            differences.push({
              field: key,
              supabase: pgVal,
              sqlite: sqliteVal
            });
          }
        }
        
        if (differences.length > 0) {
          differentValues.push({ id, differences });
        }
      }
    }
    
    return {
      exists: true,
      supabaseCount: pgRows.length,
      sqliteCount: sqliteRows.length,
      onlyInSupabase: onlyInPG.length,
      onlyInSQLite: onlyInSQLite.length,
      commonCount: commonIds.size,
      differentCount: differentValues.length,
      onlyInSupabaseIds: onlyInPG.slice(0, 10).map(r => r.id), // Limita a 10 per output
      onlyInSQLiteIds: onlyInSQLite.slice(0, 10).map(r => r.id), // Limita a 10 per output
      differentValues: differentValues.slice(0, 5), // Limita a 5 per output
    };
    
  } catch (error) {
    return { error: error.message };
  }
}

function normalizeValue(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'boolean') return val ? 1 : 0; // Normalizza boolean
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string') return val.trim();
  return val;
}

function sortObject(obj) {
  return Object.keys(obj).sort().reduce((result, key) => {
    result[key] = obj[key];
    return result;
  }, {});
}

async function compareAllTables() {
  const pgClient = new Client(supabaseConfig);
  let sqliteDb;
  
  try {
    console.log('🔗 Connessione a Supabase...');
    await pgClient.connect();
    console.log('✅ Connesso a Supabase\n');
    
    console.log(`💾 Connessione a SQLite: ${sqlitePath}...`);
    sqliteDb = new Database(sqlitePath);
    console.log('✅ Connesso a SQLite\n');
    
    console.log('📊 Confronto contenuto database...\n');
    console.log('='.repeat(80));
    
    const results = {};
    let tablesWithDifferences = 0;
    
    for (const tableName of tablesToCompare) {
      console.log(`\n📋 Tabella: ${tableName}`);
      console.log('-'.repeat(80));
      
      const result = await compareTableData(pgClient, sqliteDb, tableName);
      
      if (result.exists === false) {
        console.log(`  ⚠️  ${result.reason}`);
        results[tableName] = result;
        continue;
      }
      
      if (result.error) {
        console.log(`  ❌ Errore: ${result.error}`);
        results[tableName] = result;
        continue;
      }
      
      // Mostra risultati
      console.log(`  📊 Record in Supabase: ${result.supabaseCount}`);
      console.log(`  📊 Record in SQLite: ${result.sqliteCount}`);
      
      if (result.onlyInSupabase > 0) {
        console.log(`  ⚠️  Solo in Supabase: ${result.onlyInSupabase} record`);
        if (result.onlyInSupabaseIds.length > 0) {
          console.log(`     Esempi ID: ${result.onlyInSupabaseIds.join(', ')}`);
        }
        tablesWithDifferences++;
      }
      
      if (result.onlyInSQLite > 0) {
        console.log(`  ⚠️  Solo in SQLite: ${result.onlyInSQLite} record`);
        if (result.onlyInSQLiteIds.length > 0) {
          console.log(`     Esempi ID: ${result.onlyInSQLiteIds.join(', ')}`);
        }
        tablesWithDifferences++;
      }
      
      if (result.differentCount > 0) {
        console.log(`  ⚠️  Record con valori diversi: ${result.differentCount}`);
        if (result.differentValues.length > 0) {
          const example = result.differentValues[0];
          console.log(`     Esempio ID ${example.id}:`);
          example.differences.slice(0, 3).forEach(diff => {
            console.log(`       - ${diff.field}: Supabase="${diff.supabase}" vs SQLite="${diff.sqlite}"`);
          });
        }
        tablesWithDifferences++;
      }
      
      if (result.onlyInSupabase === 0 && result.onlyInSQLite === 0 && result.differentCount === 0) {
        console.log(`  ✅ Nessuna discrepanza`);
      }
      
      results[tableName] = result;
    }
    
    // Riepilogo finale
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 RIEPILOGO FINALE\n');
    
    const tablesWithData = Object.entries(results).filter(([_, r]) => r.exists && !r.error);
    const allSame = tablesWithData.filter(([_, r]) => r.onlyInSupabase === 0 && r.onlyInSQLite === 0 && r.differentCount === 0);
    
    console.log(`✅ Tabelle identiche: ${allSame.length}/${tablesWithData.length}`);
    console.log(`⚠️  Tabelle con discrepanze: ${tablesWithDifferences}`);
    
    if (tablesWithDifferences > 0) {
      console.log('\n📋 Tabelle con discrepanze:');
      for (const [tableName, result] of Object.entries(results)) {
        if (result.exists && !result.error) {
          if (result.onlyInSupabase > 0 || result.onlyInSQLite > 0 || result.differentCount > 0) {
            console.log(`  - ${tableName}:`);
            if (result.onlyInSupabase > 0) console.log(`    Solo in Supabase: ${result.onlyInSupabase}`);
            if (result.onlyInSQLite > 0) console.log(`    Solo in SQLite: ${result.onlyInSQLite}`);
            if (result.differentCount > 0) console.log(`    Valori diversi: ${result.differentCount}`);
          }
        }
      }
    }
    
    await pgClient.end();
    sqliteDb.close();
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error(error.stack);
    if (pgClient) await pgClient.end();
    if (sqliteDb) sqliteDb.close();
    process.exit(1);
  }
}

compareAllTables();

