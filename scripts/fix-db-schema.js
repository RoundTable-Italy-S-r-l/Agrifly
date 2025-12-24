import { Client } from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carica .env dalla root del progetto
dotenv.config({ path: join(__dirname, '../.env') });

const client = new Client({
  host: process.env.PGHOST || process.env.DATABASE_URL?.match(/@([^:]+)/)?.[1],
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER || process.env.DATABASE_URL?.match(/:\/\/([^:]+):/)?.[1],
  password: process.env.PGPASSWORD || process.env.DATABASE_URL?.match(/:\/\/[^:]+:([^@]+)@/)?.[1]?.replace(/%5/g, '%'),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000,
});

async function fixSchema() {
  try {
    await client.connect();
    console.log('✅ Connesso al database\n');

    // 1. Verifica colonne esistenti
    console.log('📋 Verifica colonne esistenti in users...');
    const existingCols = await client.query(`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
    `);
    const existingColNames = existingCols.rows.map(r => r.column_name);
    console.log('Colonne esistenti:', existingColNames.join(', '));

    // 2. Colonne richieste dallo schema Prisma
    const requiredCols = {
      password_salt: { type: 'text', nullable: true },
    };

    // 3. Aggiungi colonne mancanti
    console.log('\n🔧 Aggiunta colonne mancanti...');
    for (const [colName, colDef] of Object.entries(requiredCols)) {
      if (!existingColNames.includes(colName)) {
        console.log(`  Aggiungo colonna: ${colName} (${colDef.type})`);
        await client.query(`
          ALTER TABLE users 
          ADD COLUMN ${colName} ${colDef.type}${colDef.nullable ? '' : ' NOT NULL'}
        `);
        console.log(`  ✅ Colonna ${colName} aggiunta`);
      } else {
        console.log(`  ✅ Colonna ${colName} già presente`);
      }
    }

    // 4. Verifica enum types
    console.log('\n🔍 Verifica enum types...');
    const enumCheck = await client.query(`
      SELECT t.typname
      FROM pg_type t 
      WHERE t.typname = 'userstatus'
    `);
    
    if (enumCheck.rows.length === 0) {
      console.log('  ⚠️  Enum UserStatus non trovato - verifico se è necessario crearlo');
      // Controlla se status è già un enum o è text
      const statusType = await client.query(`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'status'
      `);
      console.log(`  Tipo colonna status: ${statusType.rows[0].data_type}`);
      
      if (statusType.rows[0].data_type === 'USER-DEFINED') {
        console.log('  ✅ Status è già un enum type');
      } else {
        console.log('  ⚠️  Status non è un enum - potrebbe essere text con constraint');
      }
    } else {
      console.log('  ✅ Enum UserStatus trovato');
    }

    // 5. Verifica finale
    console.log('\n✅ Verifica finale struttura users...');
    const finalCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('Colonne finali:');
    finalCols.rows.forEach(col => {
      console.log(`  ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    console.log('\n✅ Schema aggiornato con successo!');

  } catch (err) {
    console.error('❌ Errore:', err.message);
    console.error('Stack:', err.stack);
  } finally {
    await client.end();
  }
}

fixSchema();
