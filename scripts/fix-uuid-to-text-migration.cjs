const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false }
});

// Tabelle che usano CUID invece di UUID
const tablesToFix = [
  'jobs',
  'job_offers',
  'organizations',
  'users',
  'org_memberships',
  'products',
  'skus',
  'rate_cards',
  'bookings',
  'orders',
  'order_lines',
  'shopping_carts',
  'cart_items',
  'saved_fields',
  'service_configurations',
  'conversations',
  'conversation_participants',
  'messages',
  'job_offer_messages',
  'order_messages',
  'assets',
  'vendor_catalog_items',
  'inventories',
  'price_lists',
  'price_list_items',
  'wishlist_items',
  'operator_profiles',
  'external_calendar_connections',
  'verification_codes',
  'organization_invitations',
  'notification_preferences',
  'service_area_sets',
  'service_area_set_items'
];

async function fixTableIdColumn(tableName) {
  try {
    // Verifica il tipo attuale della colonna id
    const columnInfo = await client.query(`
      SELECT 
        column_name,
        data_type,
        udt_name
      FROM information_schema.columns
      WHERE table_name = $1 
        AND column_name = 'id'
        AND table_schema = 'public'
    `, [tableName]);

    if (columnInfo.rows.length === 0) {
      console.log(`   ⚠️  Tabella ${tableName} non trovata o colonna id non esiste`);
      return false;
    }

    const currentType = columnInfo.rows[0].udt_name; // uuid, varchar, text, etc.

    if (currentType === 'uuid') {
      console.log(`   🔄 Modifica colonna id da UUID a VARCHAR(255) in ${tableName}...`);
      
      // Prima, verifica se ci sono foreign key che referenziano questa colonna
      const fkCheck = await client.query(`
        SELECT 
          tc.constraint_name,
          kcu.table_name as referencing_table,
          kcu.column_name as referencing_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND ccu.table_name = $1
          AND ccu.column_name = 'id'
      `, [tableName]);

      // Rimuovi temporaneamente le foreign key se esistono
      for (const fk of fkCheck.rows) {
        console.log(`      🔓 Rimozione FK ${fk.constraint_name} da ${fk.referencing_table}...`);
        try {
          await client.query(`ALTER TABLE ${fk.referencing_table} DROP CONSTRAINT IF EXISTS ${fk.constraint_name}`);
        } catch (e) {
          console.log(`      ⚠️  Errore rimozione FK ${fk.constraint_name}:`, e.message);
        }
      }

      // Modifica il tipo della colonna
      await client.query(`
        ALTER TABLE ${tableName} 
        ALTER COLUMN id TYPE VARCHAR(255) USING id::text
      `);

      // Ricrea le foreign key se esistevano
      for (const fk of fkCheck.rows) {
        console.log(`      🔒 Ricreazione FK ${fk.constraint_name} su ${fk.referencing_table}...`);
        try {
          await client.query(`
            ALTER TABLE ${fk.referencing_table}
            ADD CONSTRAINT ${fk.constraint_name}
            FOREIGN KEY (${fk.referencing_column})
            REFERENCES ${tableName}(id)
          `);
        } catch (e) {
          console.log(`      ⚠️  Errore ricreazione FK ${fk.constraint_name}:`, e.message);
        }
      }

      console.log(`   ✅ Colonna id modificata in ${tableName}`);
      return true;
    } else if (currentType === 'varchar' || currentType === 'text' || currentType === 'character varying') {
      console.log(`   ✅ Colonna id già di tipo TEXT/VARCHAR in ${tableName}`);
      return false;
    } else {
      console.log(`   ⚠️  Tipo colonna id sconosciuto in ${tableName}: ${currentType}`);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Errore durante modifica ${tableName}:`, error.message);
    return false;
  }
}

async function runMigration() {
  try {
    console.log('🔗 Connessione a Supabase...');
    await client.connect();
    console.log('✅ Connesso a Supabase\n');

    console.log(`📋 Verifica e correzione colonne id da UUID a VARCHAR(255)...\n`);
    console.log(`   Verificando ${tablesToFix.length} tabelle...\n`);

    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const table of tablesToFix) {
      const result = await fixTableIdColumn(table);
      if (result === true) {
        fixed++;
      } else if (result === false) {
        skipped++;
      } else {
        errors++;
      }
    }

    console.log(`\n✅ Migrazione completata:`);
    console.log(`   🔄 Modificate: ${fixed} tabelle`);
    console.log(`   ⏭️  Saltate: ${skipped} tabelle`);
    console.log(`   ❌ Errori: ${errors} tabelle`);

    await client.end();
  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
    await client.end();
    process.exit(1);
  }
}

runMigration();

