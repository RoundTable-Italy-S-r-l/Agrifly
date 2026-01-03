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

// Tabelle aggiuntive che potrebbero mancare
const additionalTables = {
  locations: {
    id: { type: "VARCHAR(255)", primary: true },
    org_id: { type: "VARCHAR(255)" },
    name: { type: "VARCHAR(255)" },
    address_json: { type: "TEXT" },
    lat: { type: "REAL", nullable: true },
    lon: { type: "REAL", nullable: true },
    is_hub: { type: "BOOLEAN", default: "false" },
  },
  maintenance_events: {
    id: { type: "VARCHAR(255)", primary: true },
    asset_id: { type: "VARCHAR(255)" },
    event_type: { type: "VARCHAR(50)" },
    started_at: { type: "TIMESTAMP" },
    ended_at: { type: "TIMESTAMP", nullable: true },
    cost_cents: { type: "INTEGER", nullable: true },
    notes: { type: "TEXT", nullable: true },
    next_due_at: { type: "TIMESTAMP", nullable: true },
  },
  booking_slots: {
    id: { type: "VARCHAR(255)", primary: true },
    booking_id: { type: "VARCHAR(255)" },
    start_at: { type: "TIMESTAMP" },
    end_at: { type: "TIMESTAMP" },
    timezone: { type: "VARCHAR(50)", default: "'Europe/Rome'" },
    buffer_minutes: { type: "INTEGER", default: "30" },
    workload_snapshot_json: { type: "TEXT", nullable: true },
  },
  booking_assignments: {
    id: { type: "VARCHAR(255)", primary: true },
    booking_id: { type: "VARCHAR(255)" },
    booking_slot_id: { type: "VARCHAR(255)", nullable: true },
    asset_id: { type: "VARCHAR(255)" },
    pilot_user_id: { type: "VARCHAR(255)", nullable: true },
    dispatcher_user_id: { type: "VARCHAR(255)", nullable: true },
    assigned_at: { type: "TIMESTAMP", default: "NOW()" },
    status: { type: "VARCHAR(50)", default: "'ASSIGNED'" },
  },
  missions: {
    id: { type: "VARCHAR(255)", primary: true },
    booking_id: { type: "VARCHAR(255)" },
    booking_slot_id: { type: "VARCHAR(255)", nullable: true },
    executed_start_at: { type: "TIMESTAMP" },
    executed_end_at: { type: "TIMESTAMP", nullable: true },
    actual_area_ha: { type: "REAL", nullable: true },
    actual_hours: { type: "REAL", nullable: true },
    notes: { type: "TEXT", nullable: true },
    mission_files_json: { type: "TEXT", nullable: true },
  },
  busy_blocks: {
    id: { type: "VARCHAR(255)", primary: true },
    operator_profile_id: { type: "VARCHAR(255)" },
    source_type: { type: "VARCHAR(50)" },
    source_id: { type: "VARCHAR(255)" },
    start_at: { type: "TIMESTAMP" },
    end_at: { type: "TIMESTAMP" },
    timezone: { type: "VARCHAR(50)", default: "'Europe/Rome'" },
    status: { type: "VARCHAR(50)", default: "'ACTIVE'" },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  external_calendars: {
    id: { type: "VARCHAR(255)", primary: true },
    connection_id: { type: "VARCHAR(255)" },
    external_calendar_id: { type: "VARCHAR(255)" },
    name: { type: "VARCHAR(255)" },
    is_selected: { type: "BOOLEAN", default: "true" },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  external_calendar_events: {
    id: { type: "VARCHAR(255)", primary: true },
    calendar_id: { type: "VARCHAR(255)" },
    external_event_id: { type: "VARCHAR(255)" },
    title: { type: "VARCHAR(255)" },
    start_at: { type: "TIMESTAMP" },
    end_at: { type: "TIMESTAMP" },
    is_all_day: { type: "BOOLEAN", default: "false" },
    status: { type: "VARCHAR(50)", default: "'CONFIRMED'" },
    updated_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  payments: {
    id: { type: "VARCHAR(255)", primary: true },
    payer_org_id: { type: "VARCHAR(255)" },
    payee_org_id: { type: "VARCHAR(255)" },
    related_type: { type: "VARCHAR(50)" },
    related_id: { type: "VARCHAR(255)" },
    payment_purpose: { type: "VARCHAR(50)" },
    amount_authorized_cents: { type: "INTEGER", nullable: true },
    amount_captured_cents: { type: "INTEGER", nullable: true },
    currency: { type: "VARCHAR(10)", default: "'EUR'" },
    stripe_payment_intent_id: { type: "VARCHAR(255)", nullable: true },
    stripe_charge_id: { type: "VARCHAR(255)", nullable: true },
    stripe_account_id: { type: "VARCHAR(255)", nullable: true },
    application_fee_cents: { type: "INTEGER", nullable: true },
    payment_status: { type: "VARCHAR(50)", default: "'REQUIRES_PAYMENT'" },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
    captured_at: { type: "TIMESTAMP", nullable: true },
  },
  geo_admin_units: {
    id: { type: "VARCHAR(255)", primary: true },
    country: { type: "VARCHAR(10)", default: "'IT'" },
    level: { type: "VARCHAR(50)" },
    code: { type: "VARCHAR(255)", unique: true },
    name: { type: "VARCHAR(255)" },
    province_code: { type: "VARCHAR(50)", nullable: true },
    region_code: { type: "VARCHAR(50)", nullable: true },
  },
  service_area_rules: {
    id: { type: "VARCHAR(255)", primary: true },
    scope_type: { type: "VARCHAR(50)" },
    scope_id: { type: "VARCHAR(255)" },
    service_type: { type: "VARCHAR(50)", nullable: true },
    days_of_week: { type: "TEXT", nullable: true },
    time_window_start: { type: "VARCHAR(50)", nullable: true },
    time_window_end: { type: "VARCHAR(50)", nullable: true },
    date_from: { type: "TIMESTAMP", nullable: true },
    date_to: { type: "TIMESTAMP", nullable: true },
    service_area_set_id: { type: "VARCHAR(255)" },
    priority: { type: "INTEGER", default: "10" },
    is_active: { type: "BOOLEAN", default: "true" },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
    operatorProfileId: { type: "VARCHAR(255)", nullable: true },
  },
  service_sites: {
    id: { type: "VARCHAR(255)", primary: true },
    buyer_org_id: { type: "VARCHAR(255)" },
    name: { type: "VARCHAR(255)" },
    address: { type: "VARCHAR(255)" },
    lat: { type: "REAL", nullable: true },
    lon: { type: "REAL", nullable: true },
    municipality_code: { type: "VARCHAR(50)", nullable: true },
    province_code: { type: "VARCHAR(50)", nullable: true },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  addresses: {
    id: { type: "VARCHAR(255)", primary: true },
    org_id: { type: "VARCHAR(255)" },
    type: { type: "VARCHAR(50)" },
    name: { type: "VARCHAR(255)" },
    company: { type: "VARCHAR(255)", nullable: true },
    address_line: { type: "VARCHAR(255)" },
    city: { type: "VARCHAR(255)" },
    province: { type: "VARCHAR(255)" },
    postal_code: { type: "VARCHAR(10)" },
    country: { type: "VARCHAR(10)", default: "'IT'" },
    phone: { type: "VARCHAR(255)", nullable: true },
    is_default: { type: "BOOLEAN", default: "false" },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
    updated_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  user_notification_preferences: {
    id: { type: "VARCHAR(255)", primary: true },
    user_id: { type: "VARCHAR(255)", unique: true },
    email_orders: { type: "BOOLEAN", default: "true" },
    email_payments: { type: "BOOLEAN", default: "true" },
    email_updates: { type: "BOOLEAN", default: "false" },
    inapp_orders: { type: "BOOLEAN", default: "true" },
    inapp_messages: { type: "BOOLEAN", default: "true" },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
    updated_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  org_payment_accounts: {
    id: { type: "VARCHAR(255)", primary: true },
    org_id: { type: "VARCHAR(255)", unique: true },
    provider: { type: "VARCHAR(50)", default: "'stripe'" },
    stripe_account_id: { type: "VARCHAR(255)", nullable: true },
    charges_enabled: { type: "BOOLEAN", default: "false" },
    payouts_enabled: { type: "BOOLEAN", default: "false" },
    details_submitted: { type: "BOOLEAN", default: "false" },
    onboarding_status: { type: "VARCHAR(50)", default: "'PENDING'" },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
    updated_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  org_billing_profiles: {
    id: { type: "VARCHAR(255)", primary: true },
    org_id: { type: "VARCHAR(255)" },
    billing_name: { type: "VARCHAR(255)" },
    vat_number: { type: "VARCHAR(255)", nullable: true },
    tax_code: { type: "VARCHAR(255)", nullable: true },
    billing_address_json: { type: "TEXT" },
    sdi_code: { type: "VARCHAR(255)", nullable: true },
    pec_email: { type: "VARCHAR(255)", nullable: true },
    invoice_email: { type: "VARCHAR(255)" },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  platform_fees: {
    id: { type: "VARCHAR(255)", primary: true },
    vendor_org_id: { type: "VARCHAR(255)" },
    fee_type: { type: "VARCHAR(50)" },
    fee_percent: { type: "REAL", nullable: true },
    fee_fixed_cents: { type: "INTEGER", nullable: true },
    applies_to: { type: "VARCHAR(50)" },
    valid_from: { type: "TIMESTAMP" },
    valid_to: { type: "TIMESTAMP", nullable: true },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  offers: {
    id: { type: "VARCHAR(255)", primary: true },
    vendor_org_id: { type: "VARCHAR(255)" },
    offer_type: { type: "VARCHAR(50)" },
    name: { type: "VARCHAR(255)" },
    rules_json: { type: "TEXT" },
    valid_from: { type: "TIMESTAMP" },
    valid_to: { type: "TIMESTAMP", nullable: true },
    status: { type: "VARCHAR(50)", default: "'ACTIVE'" },
  },
  quote_requests: {
    id: { type: "VARCHAR(255)", primary: true },
    buyer_org_id: { type: "VARCHAR(255)" },
    request_type: { type: "VARCHAR(50)" },
    service_params_json: { type: "TEXT" },
    status: { type: "VARCHAR(50)", default: "'OPEN'" },
    created_at: { type: "TIMESTAMP", default: "NOW()" },
  },
  quotes: {
    id: { type: "VARCHAR(255)", primary: true },
    quote_request_id: { type: "VARCHAR(255)" },
    seller_org_id: { type: "VARCHAR(255)" },
    executor_org_id: { type: "VARCHAR(255)" },
    revision: { type: "INTEGER", default: "1" },
    pricing_snapshot_json: { type: "TEXT" },
    total_estimated_cents: { type: "INTEGER" },
    currency: { type: "VARCHAR(10)", default: "'EUR'" },
    valid_until: { type: "TIMESTAMP" },
    status: { type: "VARCHAR(50)", default: "'DRAFT'" },
  },
  quote_lines: {
    id: { type: "VARCHAR(255)", primary: true },
    quote_id: { type: "VARCHAR(255)" },
    line_type: { type: "VARCHAR(50)" },
    ref_id: { type: "VARCHAR(255)", nullable: true },
    qty: { type: "REAL" },
    unit_price_cents: { type: "INTEGER" },
    line_total_cents: { type: "INTEGER" },
    tags: { type: "TEXT", nullable: true },
  },
  availability_rules: {
    id: { type: "VARCHAR(255)", primary: true },
    scope_type: { type: "VARCHAR(50)" },
    scope_id: { type: "VARCHAR(255)" },
    rule_type: { type: "VARCHAR(50)" },
    days_of_week: { type: "TEXT", nullable: true },
    time_window_start: { type: "VARCHAR(50)", nullable: true },
    time_window_end: { type: "VARCHAR(50)", nullable: true },
    date_from: { type: "TIMESTAMP", nullable: true },
    date_to: { type: "TIMESTAMP", nullable: true },
    rule_json: { type: "TEXT", nullable: true },
    timezone: { type: "VARCHAR(50)", default: "'Europe/Rome'" },
    priority: { type: "INTEGER", default: "10" },
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

  for (const [colName, colDef] of Object.entries(columns)) {
    let def = `${colName} ${colDef.type}`;

    if (colDef.default) {
      def += ` DEFAULT ${colDef.default}`;
    }

    if (colDef.nullable !== false && !colDef.primary) {
      // nullable
    } else if (!colDef.nullable && !colDef.primary) {
      def += " NOT NULL";
    }

    columnDefs.push(def);

    if (colDef.primary) {
      primaryKeys.push(colName);
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
    return true;
  } catch (e) {
    if (e.message.includes("already exists")) {
      console.log(`   ⏭️  Colonna ${columnName} già esistente in ${tableName}`);
      return false;
    } else {
      console.log(
        `   ⚠️  Errore aggiunta colonna ${columnName} a ${tableName}:`,
        e.message,
      );
      return false;
    }
  }
}

async function syncAdditionalTables() {
  try {
    console.log("🔗 Connessione a Supabase...");
    await client.connect();
    console.log("✅ Connesso a Supabase\n");

    console.log(`📋 Sincronizzazione tabelle aggiuntive...\n`);
    console.log(
      `   Verificando ${Object.keys(additionalTables).length} tabelle...\n`,
    );

    let tablesCreated = 0;
    let columnsAdded = 0;
    let tablesSkipped = 0;

    for (const [tableName, columns] of Object.entries(additionalTables)) {
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
            const result = await addColumn(tableName, colName, colDef);
            if (result) {
              added++;
              columnsAdded++;
            }
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

syncAdditionalTables();
