const { Client } = require('pg');
require('dotenv').config();

const config = {
  host: process.env.PGHOST || 'aws-1-eu-central-2.pooler.supabase.com',
  port: Number(process.env.PGPORT || 6543),
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER || 'postgres.fzowfkfwriajohjjboed',
  password: process.env.PGPASSWORD || '_Mszqe_%uF_82%@',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
};

// Schema atteso dal codice (solo colonne necessarie)
const expectedSchema = {
  users: ['id', 'email', 'phone', 'first_name', 'last_name', 'password_hash', 'password_salt', 
          'email_verified', 'email_verified_at', 'oauth_provider', 'oauth_id', 'reset_token', 
          'reset_token_expires', 'status', 'created_at', 'updated_at', 'role'],
  organizations: ['id', 'legal_name', 'org_type', 'type', 'status', 'logo_url', 'support_email',
                  'is_certified', 'can_buy', 'can_sell', 'can_operate', 'can_dispatch', 'kind'],
  org_memberships: ['id', 'user_id', 'org_id', 'role', 'is_active', 'created_at'],
  verification_codes: ['id', 'user_id', 'code', 'purpose', 'expires_at', 'used', 'used_at', 'created_at'],
  
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
  
  rate_cards: ['id', 'seller_org_id', 'service_type', 'base_rate_per_ha_cents', 'min_charge_cents',
               'travel_fixed_cents', 'travel_rate_per_km_cents', 'hilly_terrain_multiplier',
               'hilly_terrain_surcharge_cents', 'custom_multipliers_json', 'custom_surcharges_json',
               'hourly_operator_rate_cents', 'seasonal_multipliers_json', 'risk_multipliers_json',
               'show_company_only', 'assigned_operator_ids', 'supported_model_codes',
               'operator_assignment_mode', 'service_area_set_id', 'crop_types', 'is_active',
               'created_at', 'updated_at'],
  
  operator_profiles: ['id', 'user_id', 'org_id', 'home_location_id', 'max_hours_per_day',
                     'max_ha_per_day', 'service_tags', 'default_service_area_set_id',
                     'service_area_mode', 'status'],
  service_configurations: ['id', 'org_id', 'base_location_lat', 'base_location_lng'],
  service_area_sets: ['id', 'org_id', 'name'],
  
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
  
  geo_admin_units: ['code', 'name', 'level', 'region_code', 'province_code'],
  
  organization_settings: ['id', 'org_id', 'setting_key', 'setting_value', 'created_at', 'updated_at'],
  organization_invitations: ['id', 'org_id', 'email', 'role', 'token', 'status', 'expires_at',
                            'invited_by_user_id', 'created_at'],
  
  // Nota: addresses potrebbe esistere già, viene verificata dinamicamente
  addresses: ['id', 'org_id', 'type', 'name', 'company', 'address_line', 'city', 'province',
              'postal_code', 'country', 'phone', 'is_default', 'created_at', 'updated_at'],
};

// Tipi di colonne per PostgreSQL
const columnTypes = {
  // IDs
  'id': 'VARCHAR(255)',
  'user_id': 'VARCHAR(255)',
  'org_id': 'VARCHAR(255)',
  'organization_id': 'VARCHAR(255)',
  'buyer_org_id': 'VARCHAR(255)',
  'vendor_org_id': 'VARCHAR(255)',
  'seller_org_id': 'VARCHAR(255)',
  'operator_org_id': 'VARCHAR(255)',
  'executor_org_id': 'VARCHAR(255)',
  'job_id': 'VARCHAR(255)',
  'offer_id': 'VARCHAR(255)',
  'accepted_offer_id': 'VARCHAR(255)',
  'product_id': 'VARCHAR(255)',
  'sku_id': 'VARCHAR(255)',
  'cart_id': 'VARCHAR(255)',
  'order_id': 'VARCHAR(255)',
  'price_list_id': 'VARCHAR(255)',
  'location_id': 'VARCHAR(255)',
  'home_location_id': 'VARCHAR(255)',
  'shipping_address_id': 'VARCHAR(255)',
  'billing_address_id': 'VARCHAR(255)',
  'service_area_set_id': 'VARCHAR(255)',
  'default_service_area_set_id': 'VARCHAR(255)',
  'invited_by_user_id': 'VARCHAR(255)',
  
  // Strings
  'email': 'TEXT',
  'phone': 'TEXT',
  'first_name': 'TEXT',
  'last_name': 'TEXT',
  'legal_name': 'TEXT',
  'name': 'TEXT',
  'code': 'VARCHAR(255)',
  'sku_code': 'TEXT',
  'variant_name': 'TEXT',
  'field_name': 'TEXT',
  'status': 'VARCHAR(50)',
  'order_status': 'VARCHAR(50)',
  'payment_status': 'VARCHAR(50)',
  'role': 'VARCHAR(50)',
  'service_type': 'VARCHAR(50)',
  'product_type': 'VARCHAR(50)',
  'type': 'VARCHAR(50)',
  'org_type': 'VARCHAR(50)',
  'kind': 'VARCHAR(50)',
  'level': 'VARCHAR(50)',
  'region_code': 'VARCHAR(10)',
  'province_code': 'VARCHAR(10)',
  'currency': 'VARCHAR(10)',
  'order_number': 'VARCHAR(100)',
  'token': 'TEXT',
  'code': 'TEXT',
  'purpose': 'VARCHAR(50)',
  'address_line': 'TEXT',
  'city': 'TEXT',
  'province': 'TEXT',
  'postal_code': 'VARCHAR(20)',
  'country': 'VARCHAR(2)',
  'note': 'TEXT',
  'notes': 'TEXT',
  'provider_note': 'TEXT',
  'message_text': 'TEXT',
  'setting_key': 'VARCHAR(255)',
  'setting_value': 'TEXT',
  'company': 'TEXT',
  'support_email': 'TEXT',
  'logo_url': 'TEXT',
  
  // JSON
  'location_json': 'TEXT',
  'pricing_snapshot_json': 'TEXT',
  'site_snapshot_json': 'TEXT',
  'specs_json': 'TEXT',
  'specs_core_json': 'TEXT',
  'specs_extra_json': 'TEXT',
  'images_json': 'TEXT',
  'glb_files_json': 'TEXT',
  'manuals_pdf_json': 'TEXT',
  'custom_multipliers_json': 'TEXT',
  'custom_surcharges_json': 'TEXT',
  'seasonal_multipliers_json': 'TEXT',
  'risk_multipliers_json': 'TEXT',
  'capabilities_json': 'TEXT',
  'polygon': 'TEXT',
  'service_tags': 'TEXT',
  'assigned_operator_ids': 'TEXT',
  'supported_model_codes': 'TEXT',
  'crop_types': 'TEXT',
  
  // Numbers
  'area_ha': 'DECIMAL(10,4)',
  'latitude': 'NUMERIC(10,8)',
  'longitude': 'NUMERIC(11,8)',
  'base_location_lat': 'NUMERIC(10,8)',
  'base_location_lng': 'NUMERIC(11,8)',
  'total_cents': 'INTEGER',
  'price_cents': 'INTEGER',
  'unit_price_cents': 'INTEGER',
  'base_rate_per_ha_cents': 'INTEGER',
  'min_charge_cents': 'INTEGER',
  'travel_fixed_cents': 'INTEGER',
  'travel_rate_per_km_cents': 'INTEGER',
  'hilly_terrain_surcharge_cents': 'INTEGER',
  'hourly_operator_rate_cents': 'INTEGER',
  'qty_on_hand': 'INTEGER',
  'qty_reserved': 'INTEGER',
  'quantity': 'INTEGER',
  'lead_time_days': 'INTEGER',
  'hours_total': 'INTEGER',
  'battery_cycles': 'INTEGER',
  'max_hours_per_day': 'INTEGER',
  'max_ha_per_day': 'NUMERIC(10,2)',
  
  // Reals
  'hilly_terrain_multiplier': 'REAL',
  
  // Booleans
  'is_active': 'BOOLEAN',
  'is_default': 'BOOLEAN',
  'is_for_sale': 'BOOLEAN',
  'is_for_rent': 'BOOLEAN',
  'is_read': 'BOOLEAN',
  'is_certified': 'BOOLEAN',
  'can_buy': 'BOOLEAN',
  'can_sell': 'BOOLEAN',
  'can_operate': 'BOOLEAN',
  'can_dispatch': 'BOOLEAN',
  'show_company_only': 'BOOLEAN',
  'email_verified': 'BOOLEAN',
  'used': 'BOOLEAN',
  
  // Timestamps
  'created_at': 'TIMESTAMP DEFAULT NOW()',
  'updated_at': 'TIMESTAMP DEFAULT NOW()',
  'expires_at': 'TIMESTAMP',
  'used_at': 'TIMESTAMP',
  'email_verified_at': 'TIMESTAMP',
  'reset_token_expires': 'TIMESTAMP',
  'target_date_start': 'TIMESTAMP',
  'target_date_end': 'TIMESTAMP',
  'proposed_start': 'TIMESTAMP',
  'proposed_end': 'TIMESTAMP',
  'valid_from': 'TIMESTAMP',
  'valid_to': 'TIMESTAMP',
  'shipped_at': 'TIMESTAMP',
  'delivered_at': 'TIMESTAMP',
  'paid_at': 'TIMESTAMP',
  
  // Other
  'password_hash': 'TEXT',
  'password_salt': 'TEXT',
  'oauth_provider': 'VARCHAR(50)',
  'oauth_id': 'TEXT',
  'reset_token': 'TEXT',
  'serial_number': 'TEXT',
  'asset_status': 'VARCHAR(50)',
  'service_area_mode': 'VARCHAR(50)',
  'operator_assignment_mode': 'VARCHAR(50)',
  'productid': 'TEXT',
};

function getColumnType(columnName) {
  return columnTypes[columnName] || 'TEXT';
}

async function generateMigration() {
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
    
    console.log('📊 GENERAZIONE SCRIPT MIGRAZIONE SQL\n');
    console.log('-- ============================================================');
    console.log('-- Script di migrazione per aggiungere colonne/tabelle mancanti');
    console.log('-- Generato automaticamente');
    console.log('-- ============================================================\n');
    
    // 1. Crea tabelle mancanti
    const tablesOnlyInCode = codeTables.filter(t => !dbTables.includes(t));
    if (tablesOnlyInCode.length > 0) {
      console.log('-- ============================================================');
      console.log('-- Tabelle mancanti da creare');
      console.log('-- ============================================================\n');
      
      for (const tableName of tablesOnlyInCode) {
        const columns = expectedSchema[tableName];
        console.log(`-- Tabella: ${tableName}`);
        console.log(`CREATE TABLE IF NOT EXISTS ${tableName} (`);
        
        const colDefs = columns.map((col, idx) => {
          const type = getColumnType(col);
          const isLast = idx === columns.length - 1;
          const comma = isLast ? '' : ',';
          
          if (col === 'id') {
            return `  id VARCHAR(255) PRIMARY KEY${comma}`;
          }
          
          return `  ${col} ${type}${comma}`;
        });
        
        console.log(colDefs.join('\n'));
        console.log(');\n');
      }
    }
    
    // 2. Aggiungi colonne mancanti
    console.log('-- ============================================================');
    console.log('-- Colonne mancanti da aggiungere');
    console.log('-- ============================================================\n');
    
    for (const tableName of codeTables) {
      if (!dbTables.includes(tableName)) continue; // Skip se tabella non esiste
      
      const columnsResult = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public'
      `, [tableName]);
      
      const dbColumns = columnsResult.rows.map(r => r.column_name);
      const codeColumns = expectedSchema[tableName];
      const missingColumns = codeColumns.filter(c => !dbColumns.includes(c));
      
      if (missingColumns.length > 0) {
        console.log(`-- Tabella: ${tableName}`);
        for (const col of missingColumns) {
          const type = getColumnType(col);
          console.log(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${col} ${type};`);
        }
        console.log('');
      }
    }
    
    await client.end();
    
    console.log('-- ============================================================');
    console.log('-- Fine script migrazione');
    console.log('-- ============================================================\n');
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

generateMigration();

