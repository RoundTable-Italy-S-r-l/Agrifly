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

async function verifyAllTables() {
  try {
    await client.connect();
    console.log('✅ Connesso al database\n');

    // Schema Prisma richiesto
    const schemaRequirements = {
      users: {
        required: ['id', 'email', 'first_name', 'last_name', 'password_salt', 'password_hash', 'email_verified', 'status', 'created_at', 'updated_at'],
        optional: ['phone', 'oauth_provider', 'oauth_id', 'reset_token', 'reset_token_expires', 'email_verified_at']
      },
      organizations: {
        required: ['id', 'legal_name', 'org_type', 'address_line', 'city', 'province', 'region', 'country', 'status', 'created_at'],
        optional: ['vat_number', 'tax_code']
      },
      org_memberships: {
        required: ['id', 'org_id', 'user_id', 'role', 'is_active', 'created_at'],
        optional: []
      },
      verification_codes: {
        required: ['id', 'email', 'code', 'purpose', 'expires_at', 'used', 'created_at'],
        optional: ['user_id', 'used_at']
      }
    };

    for (const [tableName, requirements] of Object.entries(schemaRequirements)) {
      console.log(`\n📋 Verifica tabella: ${tableName}`);
      
      // Verifica se la tabella esiste
      const tableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [tableName]);
      
      if (!tableExists.rows[0].exists) {
        console.log(`  ❌ Tabella ${tableName} NON ESISTE!`);
        continue;
      }
      
      // Ottieni colonne esistenti
      const columns = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = $1 AND table_schema = 'public'
        ORDER BY ordinal_position
      `, [tableName]);
      
      const existingCols = columns.rows.map(c => c.column_name);
      
      // Verifica colonne richieste
      const missingRequired = requirements.required.filter(col => !existingCols.includes(col));
      const missingOptional = requirements.optional.filter(col => !existingCols.includes(col));
      
      if (missingRequired.length > 0) {
        console.log(`  ❌ Colonne richieste mancanti: ${missingRequired.join(', ')}`);
        
        // Aggiungi colonne mancanti
        for (const colName of missingRequired) {
          console.log(`  🔧 Aggiungo colonna: ${colName}`);
          try {
            // Determina tipo e nullable in base alla tabella
            let colDef = 'text';
            let nullable = '';
            
            if (colName.includes('_at') || colName === 'created_at' || colName === 'updated_at') {
              colDef = 'timestamp without time zone';
              nullable = colName === 'updated_at' ? ' NOT NULL' : '';
            } else if (colName === 'email_verified' || colName === 'is_active' || colName === 'used') {
              colDef = 'boolean';
              nullable = ' NOT NULL DEFAULT false';
            } else if (colName === 'country') {
              colDef = 'text';
              nullable = " NOT NULL DEFAULT 'IT'";
            } else if (colName === 'status') {
              // Status potrebbe essere enum, lascia come è
              colDef = 'text';
              nullable = " NOT NULL DEFAULT 'ACTIVE'";
            } else if (colName.includes('id') && colName !== 'user_id' && colName !== 'org_id') {
              colDef = 'text';
              nullable = ' NOT NULL';
            } else {
              colDef = 'text';
              nullable = colName.includes('_id') ? ' NOT NULL' : '';
            }
            
            await client.query(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colDef}${nullable}`);
            console.log(`  ✅ Colonna ${colName} aggiunta`);
          } catch (err) {
            console.log(`  ⚠️  Errore aggiunta ${colName}: ${err.message}`);
          }
        }
      } else {
        console.log(`  ✅ Tutte le colonne richieste sono presenti`);
      }
      
      if (missingOptional.length > 0) {
        console.log(`  ⚠️  Colonne opzionali mancanti: ${missingOptional.join(', ')} (non critico)`);
      }
      
      // Mostra struttura finale
      const finalCols = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = $1 AND table_schema = 'public'
        ORDER BY ordinal_position
      `, [tableName]);
      
      console.log(`  📊 Colonne finali (${finalCols.rows.length}):`);
      finalCols.rows.forEach(col => {
        const marker = requirements.required.includes(col.column_name) ? '✅' : 
                      requirements.optional.includes(col.column_name) ? '⚪' : '➕';
        console.log(`    ${marker} ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
    }

    console.log('\n✅ Verifica completata!');

  } catch (err) {
    console.error('❌ Errore:', err.message);
    console.error('Stack:', err.stack);
  } finally {
    await client.end();
  }
}

verifyAllTables();
