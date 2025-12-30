const { Client } = require('pg');
require('dotenv').config();

// Configurazione database (usa env vars se disponibili, altrimenti fallback)
const config = {
  host: process.env.PGHOST || 'aws-1-eu-central-2.pooler.supabase.com',
  port: Number(process.env.PGPORT || 6543),
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER || 'postgres.fzowfkfwriajohjjboed',
  password: process.env.PGPASSWORD || '_Mszqe_%uF_82%@',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
};

// Tabella delle tabelle e colonne che il codice si aspetta (basato su analisi codice)
// Questo è un set minimo - in produzione si dovrebbe estrarre automaticamente dal codice
const expectedSchema = {
  // Auth & Users
  users: ['id', 'email', 'phone', 'first_name', 'last_name', 'password_hash', 'password_salt', 
          'email_verified', 'email_verified_at', 'oauth_provider', 'oauth_id', 'reset_token', 
          'reset_token_expires', 'status', 'created_at', 'updated_at', 'role'],
  organizations: ['id', 'legal_name', 'org_type', 'type', 'status', 'logo_url', 'support_email',
                  'is_certified', 'can_buy', 'can_sell', 'can_operate', 'can_dispatch', 'kind'],
  org_memberships: ['id', 'user_id', 'org_id', 'role', 'is_active', 'created_at'],
  verification_codes: ['id', 'user_id', 'code', 'purpose', 'expires_at', 'used', 'used_at', 'created_at'],
  
  // Products & Catalog
  products: ['id', 'name', 'brand', 'model', 'product_type', 'status', 'specs_json', 
             'specs_core_json', 'specs_extra_json', 'images_json', 'glb_files_json', 'manuals_pdf_json'],
  skus: ['id', 'product_id', 'sku_code', 'variant_name', 'status'],
  vendor_catalog_items: ['id', 'vendor_org_id', 'sku_id', 'is_for_sale', 'is_for_rent', 
                         'lead_time_days', 'notes'],
  price_lists: ['id', 'vendor_org_id', 'name', 'status', 'currency', 'valid_from', 'valid_to'],
  price_list_items: ['id', 'price_list_id', 'sku_id', 'price_cents', 'currency'],
  inventories: ['id', 'vendor_org_id', 'location_id', 'sku_id', 'qty_on_hand', 'qty_reserved'],
  assets: ['id', 'owning_org_id', 'managed_by_org_id', 'sku_id', 'serial_number', 
           'asset_status', 'home_location_id', 'hours_total', 'battery_cycles', 
           'capabilities_json', 'notes', 'productid'],
  locations: ['id', 'org_id', 'name', 'address_line', 'city', 'province', 'postal_code', 
              'country', 'latitude', 'longitude', 'is_default'],
  
  // Jobs & Offers
  jobs: ['id', 'buyer_org_id', 'field_name', 'service_type', 'area_ha', 'location_json',
         'target_date_start', 'target_date_end', 'notes', 'status', 'created_at', 'updated_at'],
  job_offers: ['id', 'job_id', 'operator_org_id', 'status', 'pricing_snapshot_json',
               'total_cents', 'currency', 'proposed_start', 'proposed_end', 'provider_note',
               'created_at', 'updated_at'],
  job_offer_messages: ['id', 'offer_id', 'sender_org_id', 'sender_user_id', 'message_text',
                       'is_read', 'created_at'],
  bookings: ['id', 'job_id', 'accepted_offer_id', 'buyer_org_id', 'executor_org_id',
             'service_type', 'site_snapshot_json', 'status', 'payment_status', 'paid_at',
             'created_at', 'updated_at'],
  saved_fields: ['id', 'organization_id', 'name', 'polygon', 'area_ha', 'location_json',
                 'created_at', 'updated_at'],
  
  // Services & Rate Cards
  rate_cards: ['id', 'seller_org_id', 'service_type', 'base_rate_per_ha_cents', 'min_charge_cents',
               'travel_fixed_cents', 'travel_rate_per_km_cents', 'hilly_terrain_multiplier',
               'hilly_terrain_surcharge_cents', 'custom_multipliers_json', 'custom_surcharges_json',
               'hourly_operator_rate_cents', 'seasonal_multipliers_json', 'risk_multipliers_json',
               'show_company_only', 'assigned_operator_ids', 'supported_model_codes',
               'operator_assignment_mode', 'service_area_set_id', 'crop_types', 'is_active',
               'created_at', 'updated_at'],
  
  // Operators
  operator_profiles: ['id', 'user_id', 'org_id', 'home_location_id', 'max_hours_per_day',
                     'max_ha_per_day', 'service_tags', 'default_service_area_set_id',
                     'service_area_mode', 'status'],
  service_configurations: ['id', 'org_id', 'base_location_lat', 'base_location_lng'],
  service_area_sets: ['id', 'org_id', 'name'],
  
  // E-commerce
  shopping_carts: ['id', 'user_id', 'session_id', 'org_id', 'created_at', 'updated_at'],
  cart_items: ['id', 'cart_id', 'sku_id', 'quantity', 'unit_price_cents', 'created_at'],
  wishlist_items: ['id', 'buyer_org_id', 'sku_id', 'note', 'created_at'],
  addresses: ['id', 'org_id', 'type', 'name', 'company', 'address_line', 'city', 'province',
              'postal_code', 'country', 'phone', 'is_default', 'created_at', 'updated_at'],
  orders: ['id', 'order_number', 'buyer_org_id', 'vendor_org_id', 'status', 'total_cents',
           'currency', 'shipping_address_id', 'billing_address_id', 'created_at', 'updated_at',
           'shipped_at', 'delivered_at'],
  order_items: ['id', 'order_id', 'sku_id', 'quantity', 'unit_price_cents', 'total_cents'],
  order_messages: ['id', 'order_id', 'sender_org_id', 'sender_user_id', 'message_text',
                   'is_read', 'created_at'],
  
  // Geo
  geo_admin_units: ['code', 'name', 'level', 'region_code', 'province_code'],
  
  // Settings
  organization_settings: ['id', 'org_id', 'setting_key', 'setting_value', 'created_at', 'updated_at'],
  organization_invitations: ['id', 'org_id', 'email', 'role', 'token', 'status', 'expires_at',
                            'invited_by_user_id', 'created_at'],
};

async function compareSchemas() {
  const client = new Client(config);
  
  try {
    await client.connect();
    console.log('✅ Connesso a Supabase\n');
    
    // Ottieni tutte le tabelle dal database
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const dbTables = tablesResult.rows.map(r => r.table_name);
    const codeTables = Object.keys(expectedSchema);
    
    console.log('📊 CONFRONTO TABELLE\n');
    console.log(`Tabelle nel database: ${dbTables.length}`);
    console.log(`Tabelle attese dal codice: ${codeTables.length}\n`);
    
    // Tabelle nel DB ma non nel codice
    const tablesOnlyInDb = dbTables.filter(t => !codeTables.includes(t));
    if (tablesOnlyInDb.length > 0) {
      console.log('⚠️  Tabelle nel DB ma non referenziate nel codice:');
      tablesOnlyInDb.forEach(t => console.log(`   - ${t}`));
      console.log('');
    }
    
    // Tabelle nel codice ma non nel DB
    const tablesOnlyInCode = codeTables.filter(t => !dbTables.includes(t));
    if (tablesOnlyInCode.length > 0) {
      console.log('❌ Tabelle attese dal codice ma NON nel database:');
      tablesOnlyInCode.forEach(t => console.log(`   - ${t}`));
      console.log('');
    }
    
    // Confronto colonne per ogni tabella comune
    console.log('\n📋 CONFRONTO COLONNE PER TABELLA\n');
    
    const allDiscrepancies = {
      missingTables: tablesOnlyInCode,
      extraTables: tablesOnlyInDb,
      missingColumns: {},
      extraColumns: {},
    };
    
    for (const tableName of codeTables) {
      if (!dbTables.includes(tableName)) continue; // Skip se tabella non esiste
      
      // Ottieni colonne dal database
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public'
        ORDER BY ordinal_position
      `, [tableName]);
      
      const dbColumns = columnsResult.rows.map(r => r.column_name);
      const codeColumns = expectedSchema[tableName];
      
      const missingColumns = codeColumns.filter(c => !dbColumns.includes(c));
      const extraColumns = dbColumns.filter(c => !codeColumns.includes(c));
      
      if (missingColumns.length > 0 || extraColumns.length > 0) {
        console.log(`\n📌 ${tableName}:`);
        
        if (missingColumns.length > 0) {
          console.log(`   ❌ Colonne mancanti (${missingColumns.length}):`);
          missingColumns.forEach(col => {
            const colInfo = columnsResult.rows.find(r => r.column_name === col);
            console.log(`      - ${col}`);
          });
          allDiscrepancies.missingColumns[tableName] = missingColumns;
        }
        
        if (extraColumns.length > 0) {
          console.log(`   ⚠️  Colonne extra nel DB (${extraColumns.length}):`);
          extraColumns.forEach(col => {
            const colInfo = columnsResult.rows.find(r => r.column_name === col);
            console.log(`      - ${col} (${colInfo?.data_type || 'unknown'})`);
          });
          allDiscrepancies.extraColumns[tableName] = extraColumns;
        }
      }
    }
    
    // Riepilogo
    console.log('\n\n📊 RIEPILOGO DISCREPANZE\n');
    console.log(`❌ Tabelle mancanti: ${allDiscrepancies.missingTables.length}`);
    console.log(`⚠️  Tabelle extra: ${allDiscrepancies.extraTables.length}`);
    console.log(`❌ Tabelle con colonne mancanti: ${Object.keys(allDiscrepancies.missingColumns).length}`);
    console.log(`⚠️  Tabelle con colonne extra: ${Object.keys(allDiscrepancies.extraColumns).length}`);
    
    const totalMissingColumns = Object.values(allDiscrepancies.missingColumns)
      .reduce((sum, cols) => sum + cols.length, 0);
    console.log(`❌ Totale colonne mancanti: ${totalMissingColumns}`);
    
    // Genera script SQL per migrazione
    console.log('\n\n🔧 GENERAZIONE SCRIPT MIGRAZIONE\n');
    console.log('-- Script per aggiungere colonne mancanti\n');
    
    for (const [tableName, columns] of Object.entries(allDiscrepancies.missingColumns)) {
      console.log(`-- Tabella: ${tableName}`);
      for (const col of columns) {
        // Prova a inferire il tipo dalla tabella expectedSchema (semplificato)
        console.log(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${col} TEXT;`);
      }
      console.log('');
    }
    
    await client.end();
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

compareSchemas();

