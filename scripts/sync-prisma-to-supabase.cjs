const { Client } = require("pg");
require("dotenv").config();

const client = new Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false },
});

// Mapping dei tipi Prisma a PostgreSQL
function prismaToPostgresType(prismaType, isOptional) {
  const nullable = isOptional ? "" : " NOT NULL";

  switch (prismaType) {
    case "String":
      return `VARCHAR(255)${nullable}`;
    case "Int":
      return `INTEGER${nullable}`;
    case "Float":
      return `REAL${nullable}`;
    case "Boolean":
      return `BOOLEAN${nullable}`;
    case "DateTime":
      return `TIMESTAMP${nullable}`;
    default:
      return `VARCHAR(255)${nullable}`;
  }
}

// Funzione per ottenere il default value
function getDefaultValue(defaultValue, prismaType) {
  if (!defaultValue) return "";

  if (defaultValue === "now()" || defaultValue === "now") {
    return " DEFAULT NOW()";
  }
  if (defaultValue === "cuid()") {
    return ""; // CUID generato dall'applicazione
  }
  if (typeof defaultValue === "string") {
    if (prismaType === "Boolean") {
      return defaultValue === "true" ? " DEFAULT true" : " DEFAULT false";
    }
    if (prismaType === "Int") {
      return ` DEFAULT ${defaultValue}`;
    }
    return ` DEFAULT '${defaultValue}'`;
  }
  return "";
}

// Definizione completa delle tabelle basata sullo schema Prisma
const tableDefinitions = {
  users: {
    id: { type: "VARCHAR(255)", primary: true },
    email: { type: "VARCHAR(255)", unique: true },
    phone: { type: "VARCHAR(255)", nullable: true },
    first_name: { type: "VARCHAR(255)" },
    last_name: { type: "VARCHAR(255)" },
    password_salt: { type: "VARCHAR(255)", nullable: true },
    password_hash: { type: "VARCHAR(255)", nullable: true },
    email_verified: { type: "BOOLEAN", default: "false" },
    email_verified_at: { type: "TIMESTAMP", nullable: true },
    oauth_provider: { type: "VARCHAR(50)", nullable: true },
    oauth_id: { type: "VARCHAR(255)", nullable: true },
    reset_token: { type: "VARCHAR(255)", nullable: true },
    reset_token_expires: { type: "TIMESTAMP", nullable: true },
    role: { type: "VARCHAR(50)", default: "'admin'", nullable: true },
    status: { type: "VARCHAR(50)", default: "'ACTIVE'" },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
    updated_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  organizations: {
    id: { type: "VARCHAR(255)", primary: true },
    legal_name: { type: "VARCHAR(255)" },
    logo_url: { type: "VARCHAR(500)", nullable: true },
    phone: { type: "VARCHAR(255)", nullable: true },
    support_email: { type: "VARCHAR(255)", nullable: true },
    vat_number: { type: "VARCHAR(255)", nullable: true },
    tax_code: { type: "VARCHAR(255)", nullable: true },
    kind: { type: "VARCHAR(50)" },
    can_buy: { type: "BOOLEAN", default: "true" },
    can_sell: { type: "BOOLEAN", default: "false" },
    can_operate: { type: "BOOLEAN", default: "false" },
    can_dispatch: { type: "BOOLEAN", default: "false" },
    address_line: { type: "VARCHAR(255)" },
    city: { type: "VARCHAR(255)" },
    province: { type: "VARCHAR(255)" },
    region: { type: "VARCHAR(255)" },
    postal_code: { type: "VARCHAR(10)", nullable: true },
    country: { type: "VARCHAR(10)", default: "'IT'" },
    status: { type: "VARCHAR(50)", default: "'ACTIVE'" },
    show_individual_operators: { type: "BOOLEAN", default: "true" },
    is_certified: { type: "BOOLEAN", default: "false" },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
    org_type: { type: "VARCHAR(50)", nullable: true },
    type: { type: "VARCHAR(50)", nullable: true },
  },
  org_memberships: {
    id: { type: "VARCHAR(255)", primary: true },
    org_id: { type: "VARCHAR(255)" },
    user_id: { type: "VARCHAR(255)" },
    role: { type: "VARCHAR(50)" },
    is_active: { type: "BOOLEAN", default: "true" },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  jobs: {
    id: { type: "VARCHAR(255)", primary: true },
    buyer_org_id: { type: "VARCHAR(255)" },
    broker_org_id: { type: "VARCHAR(255)", nullable: true },
    service_type: { type: "VARCHAR(50)" },
    status: { type: "VARCHAR(50)", default: "'DRAFT'" },
    field_name: { type: "VARCHAR(255)", nullable: true },
    field_polygon: { type: "TEXT" },
    area_ha: { type: "REAL", nullable: true },
    location_json: { type: "TEXT", nullable: true },
    requested_window_start: { type: "TIMESTAMP", nullable: true },
    requested_window_end: { type: "TIMESTAMP", nullable: true },
    constraints_json: { type: "TEXT", nullable: true },
    visibility_mode: { type: "VARCHAR(50)", default: "'WHITELIST_ONLY'" },
    accepted_offer_id: { type: "VARCHAR(255)", nullable: true, unique: true },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
    updated_at: { type: "TIMESTAMP", default: "NOW()" },
    target_date_start: { type: "TIMESTAMP", nullable: true },
    target_date_end: { type: "TIMESTAMP", nullable: true },
    notes: { type: "TEXT", nullable: true },
    terrain_conditions: { type: "VARCHAR(50)", nullable: true },
  },
  job_offers: {
    id: { type: "VARCHAR(255)", primary: true },
    job_id: { type: "VARCHAR(255)" },
    operator_org_id: { type: "VARCHAR(255)" },
    status: { type: "VARCHAR(50)", default: "'SUBMITTED'" },
    pricing_snapshot_json: { type: "TEXT" },
    total_cents: { type: "INTEGER" },
    currency: { type: "VARCHAR(10)", default: "'EUR'" },
    proposed_start: { type: "TIMESTAMP", nullable: true },
    proposed_end: { type: "TIMESTAMP", nullable: true },
    reliability_snapshot_json: { type: "TEXT", nullable: true },
    offer_lines_json: { type: "TEXT", nullable: true },
    provider_note: { type: "TEXT", nullable: true },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
    updated_at: { type: "TIMESTAMP", default: "NOW()" },
    price_cents: { type: "INTEGER", nullable: true },
  },
  bookings: {
    id: { type: "VARCHAR(255)", primary: true },
    job_id: { type: "VARCHAR(255)", unique: true },
    accepted_offer_id: { type: "VARCHAR(255)" },
    buyer_org_id: { type: "VARCHAR(255)" },
    broker_org_id: { type: "VARCHAR(255)", nullable: true },
    executor_org_id: { type: "VARCHAR(255)" },
    service_type: { type: "VARCHAR(50)" },
    service_site_id: { type: "VARCHAR(255)", nullable: true },
    site_snapshot_json: { type: "TEXT" },
    status: { type: "VARCHAR(50)", default: "'CONFIRMED'" },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
    updated_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  products: {
    id: { type: "VARCHAR(255)", primary: true },
    product_type: { type: "VARCHAR(50)" },
    brand: { type: "VARCHAR(255)" },
    model: { type: "VARCHAR(255)" },
    name: { type: "VARCHAR(255)" },
    specs_json: { type: "TEXT", nullable: true },
    specs_core_json: { type: "TEXT", nullable: true },
    specs_extra_json: { type: "TEXT", nullable: true },
    videos_json: { type: "TEXT", nullable: true },
    glb_files_json: { type: "TEXT", nullable: true },
    images_json: { type: "TEXT", nullable: true },
    manuals_extracted_json: { type: "TEXT", nullable: true },
    manuals_pdf_json: { type: "TEXT", nullable: true },
    status: { type: "VARCHAR(50)", default: "'ACTIVE'" },
  },
  skus: {
    id: { type: "VARCHAR(255)", primary: true },
    product_id: { type: "VARCHAR(255)" },
    sku_code: { type: "VARCHAR(255)", unique: true },
    variant_tags: { type: "TEXT", nullable: true },
    uom: { type: "VARCHAR(50)", default: "'unit'" },
    status: { type: "VARCHAR(50)", default: "'ACTIVE'" },
  },
  rate_cards: {
    id: { type: "VARCHAR(255)", primary: true },
    seller_org_id: { type: "VARCHAR(255)" },
    service_type: { type: "VARCHAR(50)" },
    base_rate_per_ha_cents: { type: "INTEGER" },
    min_charge_cents: { type: "INTEGER" },
    travel_fixed_cents: { type: "INTEGER", default: "0", nullable: true },
    travel_rate_per_km_cents: { type: "INTEGER", nullable: true },
    hilly_terrain_multiplier: { type: "REAL", nullable: true },
    hilly_terrain_surcharge_cents: {
      type: "INTEGER",
      default: "0",
      nullable: true,
    },
    custom_multipliers_json: { type: "TEXT", nullable: true },
    custom_surcharges_json: { type: "TEXT", nullable: true },
    hourly_operator_rate_cents: { type: "INTEGER", nullable: true },
    seasonal_multipliers_json: { type: "TEXT", nullable: true },
    risk_multipliers_json: { type: "TEXT", nullable: true },
    is_active: { type: "BOOLEAN", default: "true" },
    show_company_only: { type: "BOOLEAN", default: "false" },
    assigned_operator_ids: { type: "TEXT", nullable: true },
    supported_model_codes: { type: "TEXT", nullable: true },
    operator_assignment_mode: { type: "VARCHAR(50)" },
    service_area_set_id: { type: "VARCHAR(255)", nullable: true },
    crop_types: { type: "TEXT", nullable: true },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
    updated_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  orders: {
    id: { type: "VARCHAR(255)", primary: true },
    buyer_org_id: { type: "VARCHAR(255)" },
    seller_org_id: { type: "VARCHAR(255)" },
    quote_id: { type: "VARCHAR(255)", nullable: true },
    order_status: { type: "VARCHAR(50)", default: "'PAID'" },
    status: { type: "VARCHAR(50)", nullable: true },
    total_cents: { type: "INTEGER" },
    currency: { type: "VARCHAR(10)", default: "'EUR'" },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
    shipping_address: { type: "TEXT", nullable: true },
    billing_address: { type: "TEXT", nullable: true },
    shipped_at: { type: "TIMESTAMP", nullable: true },
    delivered_at: { type: "TIMESTAMP", nullable: true },
    payment_status: { type: "VARCHAR(50)", nullable: true },
  },
  order_lines: {
    id: { type: "VARCHAR(255)", primary: true },
    order_id: { type: "VARCHAR(255)" },
    sku_id: { type: "VARCHAR(255)" },
    qty: { type: "INTEGER" },
    quantity: { type: "INTEGER", nullable: true },
    unit_price_snapshot_cents: { type: "INTEGER", nullable: true },
    unit_price_cents: { type: "INTEGER", nullable: true },
    line_total_cents: { type: "INTEGER" },
  },
  shopping_carts: {
    id: { type: "VARCHAR(255)", primary: true },
    user_id: { type: "VARCHAR(255)", nullable: true },
    session_id: { type: "VARCHAR(255)", nullable: true },
    org_id: { type: "VARCHAR(255)", nullable: true },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
    updated_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  cart_items: {
    id: { type: "VARCHAR(255)", primary: true },
    cart_id: { type: "VARCHAR(255)" },
    sku_id: { type: "VARCHAR(255)" },
    quantity: { type: "INTEGER", default: "1" },
    unit_price_cents: { type: "INTEGER", nullable: true },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  wishlist_items: {
    id: { type: "VARCHAR(255)", primary: true },
    buyer_org_id: { type: "VARCHAR(255)" },
    sku_id: { type: "VARCHAR(255)" },
    note: { type: "TEXT", nullable: true },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  saved_fields: {
    id: { type: "VARCHAR(255)", primary: true },
    organization_id: { type: "VARCHAR(255)" },
    name: { type: "VARCHAR(255)" },
    polygon: { type: "TEXT" },
    area_ha: { type: "REAL", nullable: true },
    location_json: { type: "TEXT", nullable: true },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
    updated_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  service_configurations: {
    id: { type: "VARCHAR(255)", primary: true },
    org_id: { type: "VARCHAR(255)" },
    base_location_lat: { type: "REAL", nullable: true },
    base_location_lng: { type: "REAL", nullable: true },
    service_tags: { type: "TEXT", nullable: true },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
    updated_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  conversations: {
    id: { type: "VARCHAR(255)", primary: true },
    context_type: { type: "VARCHAR(50)" },
    context_id: { type: "VARCHAR(255)" },
    status: { type: "VARCHAR(50)", default: "'LOCKED'" },
    unlocked_at: { type: "TIMESTAMP", nullable: true },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  conversation_participants: {
    id: { type: "VARCHAR(255)", primary: true },
    conversation_id: { type: "VARCHAR(255)" },
    org_id: { type: "VARCHAR(255)" },
    role: { type: "VARCHAR(50)" },
    joined_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  messages: {
    id: { type: "VARCHAR(255)", primary: true },
    conversation_id: { type: "VARCHAR(255)" },
    sender_user_id: { type: "VARCHAR(255)" },
    body: { type: "TEXT" },
    attachments_json: { type: "TEXT", nullable: true },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  job_offer_messages: {
    id: { type: "VARCHAR(255)", primary: true },
    offer_id: { type: "VARCHAR(255)" },
    sender_user_id: { type: "VARCHAR(255)" },
    body: { type: "TEXT" },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  order_messages: {
    id: { type: "VARCHAR(255)", primary: true },
    order_id: { type: "VARCHAR(255)" },
    sender_user_id: { type: "VARCHAR(255)" },
    body: { type: "TEXT" },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  assets: {
    id: { type: "VARCHAR(255)", primary: true },
    owning_org_id: { type: "VARCHAR(255)" },
    managed_by_org_id: { type: "VARCHAR(255)" },
    sku_id: { type: "VARCHAR(255)" },
    serial_number: { type: "VARCHAR(255)", nullable: true },
    asset_status: { type: "VARCHAR(50)", default: "'AVAILABLE'" },
    home_location_id: { type: "VARCHAR(255)", nullable: true },
    hours_total: { type: "REAL", nullable: true },
    battery_cycles: { type: "INTEGER", nullable: true },
    capabilities_json: { type: "TEXT", nullable: true },
    notes: { type: "TEXT", nullable: true },
    productId: { type: "VARCHAR(255)", nullable: true },
  },
  vendor_catalog_items: {
    id: { type: "VARCHAR(255)", primary: true },
    vendor_org_id: { type: "VARCHAR(255)" },
    sku_id: { type: "VARCHAR(255)" },
    is_for_sale: { type: "BOOLEAN", default: "true" },
    is_for_rent: { type: "BOOLEAN", default: "false" },
    lead_time_days: { type: "INTEGER", nullable: true },
    notes: { type: "TEXT", nullable: true },
  },
  inventories: {
    id: { type: "VARCHAR(255)", primary: true },
    vendor_org_id: { type: "VARCHAR(255)" },
    location_id: { type: "VARCHAR(255)" },
    sku_id: { type: "VARCHAR(255)" },
    qty_on_hand: { type: "INTEGER", default: "0" },
    qty_reserved: { type: "INTEGER", default: "0" },
  },
  price_lists: {
    id: { type: "VARCHAR(255)", primary: true },
    vendor_org_id: { type: "VARCHAR(255)" },
    name: { type: "VARCHAR(255)" },
    currency: { type: "VARCHAR(10)", default: "'EUR'" },
    valid_from: { type: "TIMESTAMP" },
    valid_to: { type: "TIMESTAMP", nullable: true },
    status: { type: "VARCHAR(50)", default: "'ACTIVE'" },
  },
  price_list_items: {
    id: { type: "VARCHAR(255)", primary: true },
    price_list_id: { type: "VARCHAR(255)" },
    sku_id: { type: "VARCHAR(255)" },
    price_cents: { type: "INTEGER" },
    tax_code: { type: "VARCHAR(50)", nullable: true },
    constraints_json: { type: "TEXT", nullable: true },
  },
  operator_profiles: {
    id: { type: "VARCHAR(255)", primary: true },
    org_id: { type: "VARCHAR(255)" },
    user_id: { type: "VARCHAR(255)" },
    home_location_id: { type: "VARCHAR(255)", nullable: true },
    max_hours_per_day: { type: "REAL", nullable: true },
    max_ha_per_day: { type: "REAL", nullable: true },
    service_tags: { type: "TEXT", nullable: true },
    default_service_area_set_id: { type: "VARCHAR(255)", nullable: true },
    service_area_mode: { type: "VARCHAR(50)", default: "'ORG_DEFAULT'" },
    status: { type: "VARCHAR(50)", default: "'ACTIVE'" },
  },
  external_calendar_connections: {
    id: { type: "VARCHAR(255)", primary: true },
    user_id: { type: "VARCHAR(255)" },
    provider: { type: "VARCHAR(50)" },
    account_email: { type: "VARCHAR(255)" },
    access_token_encrypted: { type: "TEXT", nullable: true },
    refresh_token_encrypted: { type: "TEXT", nullable: true },
    token_expires_at: { type: "TIMESTAMP", nullable: true },
    sync_status: { type: "VARCHAR(50)", default: "'OK'" },
    last_synced_at: { type: "TIMESTAMP", nullable: true },
  },
  verification_codes: {
    id: { type: "VARCHAR(255)", primary: true },
    user_id: { type: "VARCHAR(255)", nullable: true },
    email: { type: "VARCHAR(255)" },
    code: { type: "VARCHAR(10)" },
    purpose: { type: "VARCHAR(50)" },
    expires_at: { type: "TIMESTAMP" },
    used: { type: "BOOLEAN", default: "false" },
    used_at: { type: "TIMESTAMP", nullable: true },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  organization_invitations: {
    id: { type: "VARCHAR(255)", primary: true },
    organization_id: { type: "VARCHAR(255)" },
    email: { type: "VARCHAR(255)" },
    token: { type: "VARCHAR(255)", unique: true },
    role: { type: "VARCHAR(50)" },
    invited_by_user_id: { type: "VARCHAR(255)" },
    expires_at: { type: "TIMESTAMP" },
    accepted_at: { type: "TIMESTAMP", nullable: true },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  service_area_sets: {
    id: { type: "VARCHAR(255)", primary: true },
    owner_type: { type: "VARCHAR(50)" },
    owner_id: { type: "VARCHAR(255)" },
    name: { type: "VARCHAR(255)" },
    is_default: { type: "BOOLEAN", default: "false" },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
    organizationId: { type: "VARCHAR(255)", nullable: true },
  },
  service_area_set_items: {
    id: { type: "VARCHAR(255)", primary: true },
    service_area_set_id: { type: "VARCHAR(255)" },
    geo_admin_unit_id: { type: "VARCHAR(255)" },
    include_mode: { type: "VARCHAR(50)", default: "'INCLUDE'" },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  approved_networks: {
    id: { type: "VARCHAR(255)", primary: true },
    source_org_id: { type: "VARCHAR(255)" },
    target_org_id: { type: "VARCHAR(255)" },
    status: { type: "VARCHAR(50)", default: "'ACTIVE'" },
    scope: { type: "VARCHAR(50)", default: "'SERVICES_ONLY'" },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  job_invites: {
    id: { type: "VARCHAR(255)", primary: true },
    job_id: { type: "VARCHAR(255)" },
    operator_org_id: { type: "VARCHAR(255)" },
    status: { type: "VARCHAR(50)", default: "'PENDING'" },
    invited_by: { type: "VARCHAR(255)" },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
  },
};

async function tableExists(tableName) {
  const result = await client.query(
    `
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )
  `,
    [tableName],
  );
  return result.rows[0].exists;
}

async function columnExists(tableName, columnName) {
  const result = await client.query(
    `
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1 
      AND column_name = $2
    )
  `,
    [tableName, columnName],
  );
  return result.rows[0].exists;
}

async function createTable(tableName, columns) {
  const columnDefs = [];
  const primaryKeys = [];
  const uniqueConstraints = [];

  for (const [colName, colDef] of Object.entries(columns)) {
    let def = `${colName} ${colDef.type}`;

    if (colDef.default) {
      def += ` DEFAULT ${colDef.default}`;
    }

    if (colDef.nullable !== false && !colDef.primary) {
      def += "";
    } else if (!colDef.nullable && !colDef.primary) {
      def += " NOT NULL";
    }

    columnDefs.push(def);

    if (colDef.primary) {
      primaryKeys.push(colName);
    }

    if (colDef.unique) {
      uniqueConstraints.push(`UNIQUE(${colName})`);
    }
  }

  if (primaryKeys.length > 0) {
    columnDefs.push(`PRIMARY KEY (${primaryKeys.join(", ")})`);
  }

  const createSQL = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columnDefs.join(",\n      ")}
    )
  `;

  await client.query(createSQL);

  // Aggiungi unique constraints separatamente
  for (const constraint of uniqueConstraints) {
    try {
      await client.query(
        `ALTER TABLE ${tableName} ADD CONSTRAINT ${tableName}_${constraint.match(/\((\w+)\)/)[1]}_unique ${constraint}`,
      );
    } catch (e) {
      // Constraint già esistente, ignora
    }
  }
}

async function addColumn(tableName, columnName, columnDef) {
  let def = `${columnName} ${columnDef.type}`;

  if (columnDef.default) {
    def += ` DEFAULT ${columnDef.default}`;
  }

  if (columnDef.nullable === false) {
    def += " NOT NULL";
  }

  try {
    await client.query(`ALTER TABLE ${tableName} ADD COLUMN ${def}`);
    console.log(`   ✅ Aggiunta colonna ${columnName} a ${tableName}`);
  } catch (e) {
    if (e.message.includes("already exists")) {
      console.log(`   ⏭️  Colonna ${columnName} già esistente in ${tableName}`);
    } else {
      console.log(
        `   ⚠️  Errore aggiunta colonna ${columnName} a ${tableName}:`,
        e.message,
      );
    }
  }
}

async function syncSchema() {
  try {
    console.log("🔗 Connessione a Supabase...");
    await client.connect();
    console.log("✅ Connesso a Supabase\n");

    console.log(`📋 Sincronizzazione schema Prisma → Supabase...\n`);
    console.log(
      `   Verificando ${Object.keys(tableDefinitions).length} tabelle...\n`,
    );

    let tablesCreated = 0;
    let columnsAdded = 0;
    let tablesSkipped = 0;

    for (const [tableName, columns] of Object.entries(tableDefinitions)) {
      const exists = await tableExists(tableName);

      if (!exists) {
        console.log(`📋 Creazione tabella ${tableName}...`);
        await createTable(tableName, columns);
        tablesCreated++;
        console.log(`   ✅ Tabella ${tableName} creata\n`);
      } else {
        console.log(`📋 Verifica colonne per ${tableName}...`);
        let added = 0;

        for (const [colName, colDef] of Object.entries(columns)) {
          const colExists = await columnExists(tableName, colName);

          if (!colExists) {
            await addColumn(tableName, colName, colDef);
            added++;
            columnsAdded++;
          }
        }

        if (added === 0) {
          console.log(`   ✅ Tutte le colonne già presenti\n`);
        } else {
          console.log(`   ✅ Aggiunte ${added} colonne\n`);
        }

        tablesSkipped++;
      }
    }

    console.log(`\n✅ Sincronizzazione completata:`);
    console.log(`   🆕 Tabelle create: ${tablesCreated}`);
    console.log(`   ➕ Colonne aggiunte: ${columnsAdded}`);
    console.log(`   ✅ Tabelle verificate: ${tablesSkipped}`);

    await client.end();
  } catch (error) {
    console.error("❌ Errore durante la sincronizzazione:", error);
    await client.end();
    process.exit(1);
  }
}

syncSchema();
