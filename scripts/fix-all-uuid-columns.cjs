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

// Colonne che devono essere convertite da UUID a VARCHAR
// Formato: { table: 'table_name', column: 'column_name' }
const columnsToFix = [
  { table: 'cart_items', column: 'cart_id' },
  { table: 'cart_items', column: 'sku_id' },
  { table: 'order_lines', column: 'order_id' },
  { table: 'order_lines', column: 'sku_id' },
  { table: 'job_offers', column: 'job_id' },
  { table: 'job_offers', column: 'seller_org_id' },
  { table: 'bookings', column: 'accepted_offer_id' },
  { table: 'org_memberships', column: 'user_id' },
  { table: 'org_memberships', column: 'org_id' },
  { table: 'skus', column: 'product_id' },
  { table: 'assets', column: 'sku_id' },
  { table: 'vendor_catalog_items', column: 'sku_id' },
  { table: 'vendor_catalog_items', column: 'vendor_org_id' },
  { table: 'inventories', column: 'sku_id' },
  { table: 'inventories', column: 'vendor_org_id' },
  { table: 'price_list_items', column: 'price_list_id' },
  { table: 'price_list_items', column: 'sku_id' },
  { table: 'price_lists', column: 'vendor_org_id' },
  { table: 'wishlist_items', column: 'org_id' },
  { table: 'wishlist_items', column: 'sku_id' },
  { table: 'rate_cards', column: 'seller_org_id' },
  { table: 'saved_fields', column: 'organization_id' },
  { table: 'service_configurations', column: 'org_id' },
  { table: 'conversation_participants', column: 'conversation_id' },
  { table: 'conversation_participants', column: 'user_id' },
  { table: 'messages', column: 'conversation_id' },
  { table: 'messages', column: 'sender_id' },
  { table: 'job_offer_messages', column: 'offer_id' },
  { table: 'job_offer_messages', column: 'sender_id' },
  { table: 'order_messages', column: 'order_id' },
  { table: 'order_messages', column: 'sender_id' },
  { table: 'operator_profiles', column: 'user_id' },
  { table: 'operator_profiles', column: 'org_id' },
  { table: 'external_calendar_connections', column: 'user_id' },
  { table: 'verification_codes', column: 'user_id' },
  { table: 'organization_invitations', column: 'org_id' },
  { table: 'service_area_set_items', column: 'service_area_set_id' },
];

async function fixColumn(tableName, columnName) {
  try {
    // Verifica il tipo attuale della colonna
    const columnInfo = await client.query(`
      SELECT 
        column_name,
        data_type,
        udt_name
      FROM information_schema.columns
      WHERE table_name = $1 
        AND column_name = $2
        AND table_schema = 'public'
    `, [tableName, columnName]);

    if (columnInfo.rows.length === 0) {
      console.log(`   ⚠️  Colonna ${tableName}.${columnName} non trovata`);
      return false;
    }

    const currentType = columnInfo.rows[0].udt_name;

    if (currentType === 'uuid') {
      console.log(`   🔄 Modifica ${tableName}.${columnName} da UUID a VARCHAR(255)...`);
      
      await client.query(`
        ALTER TABLE ${tableName} 
        ALTER COLUMN ${columnName} TYPE VARCHAR(255) USING ${columnName}::text
      `);

      console.log(`   ✅ Colonna ${tableName}.${columnName} modificata`);
      return true;
    } else if (currentType === 'varchar' || currentType === 'text' || currentType === 'character varying') {
      console.log(`   ✅ Colonna ${tableName}.${columnName} già di tipo TEXT/VARCHAR`);
      return false;
    } else {
      console.log(`   ⚠️  Tipo colonna ${tableName}.${columnName} sconosciuto: ${currentType}`);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Errore durante modifica ${tableName}.${columnName}:`, error.message);
    return false;
  }
}

async function runMigration() {
  try {
    console.log('🔗 Connessione a Supabase...');
    await client.connect();
    console.log('✅ Connesso a Supabase\n');

    console.log(`📋 Verifica e correzione colonne UUID a VARCHAR(255)...\n`);
    console.log(`   Verificando ${columnsToFix.length} colonne...\n`);

    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const { table, column } of columnsToFix) {
      const result = await fixColumn(table, column);
      if (result === true) {
        fixed++;
      } else if (result === false) {
        skipped++;
      } else {
        errors++;
      }
    }

    // Ricrea la foreign key per cart_items
    console.log(`\n📋 Ricreazione foreign key cart_items_cart_id_fkey...`);
    try {
      await client.query(`
        ALTER TABLE cart_items 
        ADD CONSTRAINT cart_items_cart_id_fkey 
        FOREIGN KEY (cart_id) 
        REFERENCES shopping_carts(id)
      `);
      console.log(`   ✅ Foreign key ricreata`);
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log(`   ✅ Foreign key già esistente`);
      } else {
        console.log(`   ⚠️  Errore ricreazione FK:`, e.message);
      }
    }

    console.log(`\n✅ Migrazione completata:`);
    console.log(`   🔄 Modificate: ${fixed} colonne`);
    console.log(`   ⏭️  Saltate: ${skipped} colonne`);
    console.log(`   ❌ Errori: ${errors} colonne`);

    await client.end();
  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
    await client.end();
    process.exit(1);
  }
}

runMigration();

