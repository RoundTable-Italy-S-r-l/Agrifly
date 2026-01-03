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

// Tutte le tabelle che dovrebbero esistere
const expectedTables = [
  "users",
  "organizations",
  "org_memberships",
  "jobs",
  "job_offers",
  "bookings",
  "products",
  "skus",
  "rate_cards",
  "orders",
  "order_lines",
  "shopping_carts",
  "cart_items",
  "wishlist_items",
  "saved_fields",
  "service_configurations",
  "conversations",
  "conversation_participants",
  "messages",
  "job_offer_messages",
  "order_messages",
  "assets",
  "vendor_catalog_items",
  "inventories",
  "price_lists",
  "price_list_items",
  "operator_profiles",
  "external_calendar_connections",
  "verification_codes",
  "organization_invitations",
  "service_area_sets",
  "service_area_set_items",
  "approved_networks",
  "job_invites",
  "addresses",
  "locations",
  "maintenance_events",
  "booking_slots",
  "booking_assignments",
  "missions",
  "busy_blocks",
  "external_calendars",
  "external_calendar_events",
  "payments",
  "geo_admin_units",
  "service_area_rules",
  "service_sites",
  "user_notification_preferences",
  "org_payment_accounts",
  "org_billing_profiles",
  "platform_fees",
  "offers",
  "quote_requests",
  "quotes",
  "quote_lines",
  "availability_rules",
];

// Colonne critiche da verificare per ogni tabella
const criticalColumns = {
  jobs: [
    "id",
    "buyer_org_id",
    "service_type",
    "status",
    "field_polygon",
    "broker_org_id",
    "accepted_offer_id",
    "visibility_mode",
    "terrain_conditions",
  ],
  job_offers: [
    "id",
    "job_id",
    "operator_org_id",
    "status",
    "total_cents",
    "price_cents",
    "reliability_snapshot_json",
    "offer_lines_json",
  ],
  bookings: [
    "id",
    "job_id",
    "accepted_offer_id",
    "buyer_org_id",
    "executor_org_id",
    "status",
    "updated_at",
  ],
  rate_cards: [
    "id",
    "seller_org_id",
    "service_type",
    "is_active",
    "created_at",
    "updated_at",
  ],
  orders: [
    "id",
    "buyer_org_id",
    "seller_org_id",
    "status",
    "order_status",
    "payment_status",
    "shipping_address",
    "billing_address",
  ],
  organizations: [
    "id",
    "legal_name",
    "is_certified",
    "can_buy",
    "can_sell",
    "can_operate",
    "can_dispatch",
  ],
  users: ["id", "email", "role", "status"],
  cart_items: ["id", "cart_id", "sku_id"],
  shopping_carts: ["id", "user_id", "session_id", "org_id"],
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

async function getTableColumns(tableName) {
  const result = await client.query(
    `
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = $1
    ORDER BY ordinal_position
  `,
    [tableName],
  );
  return result.rows;
}

async function verifySchema() {
  try {
    console.log("🔗 Connessione a Supabase...");
    await client.connect();
    console.log("✅ Connesso a Supabase\n");

    console.log("📋 Verifica schema Supabase...\n");

    // Verifica tabelle
    console.log("📊 VERIFICA TABELLE:\n");
    const missingTables = [];
    const existingTables = [];

    for (const table of expectedTables) {
      const exists = await tableExists(table);
      if (exists) {
        existingTables.push(table);
        console.log(`   ✅ ${table}`);
      } else {
        missingTables.push(table);
        console.log(`   ❌ ${table} - MANCANTE`);
      }
    }

    console.log(`\n📊 Risultati tabelle:`);
    console.log(
      `   ✅ Esistenti: ${existingTables.length}/${expectedTables.length}`,
    );
    console.log(`   ❌ Mancanti: ${missingTables.length}`);

    if (missingTables.length > 0) {
      console.log(`\n   Tabelle mancanti:`);
      missingTables.forEach((t) => console.log(`      - ${t}`));
    }

    // Verifica colonne critiche
    console.log(`\n📊 VERIFICA COLONNE CRITICHE:\n`);
    let totalColumnsChecked = 0;
    let missingColumns = 0;
    const missingColsList = [];

    for (const [table, columns] of Object.entries(criticalColumns)) {
      const tableExistsCheck = await tableExists(table);
      if (!tableExistsCheck) {
        console.log(
          `   ⚠️  ${table}: tabella non esiste, saltata verifica colonne`,
        );
        continue;
      }

      console.log(`   📋 ${table}:`);
      for (const col of columns) {
        totalColumnsChecked++;
        const exists = await columnExists(table, col);
        if (exists) {
          console.log(`      ✅ ${col}`);
        } else {
          missingColumns++;
          missingColsList.push({ table, column: col });
          console.log(`      ❌ ${col} - MANCANTE`);
        }
      }
      console.log("");
    }

    console.log(`\n📊 Risultati colonne:`);
    console.log(
      `   ✅ Verificate: ${totalColumnsChecked - missingColumns}/${totalColumnsChecked}`,
    );
    console.log(`   ❌ Mancanti: ${missingColumns}`);

    if (missingColsList.length > 0) {
      console.log(`\n   Colonne mancanti:`);
      missingColsList.forEach(({ table, column }) => {
        console.log(`      - ${table}.${column}`);
      });
    }

    // Verifica tipo colonne ID (devono essere VARCHAR, non UUID)
    console.log(`\n📊 VERIFICA TIPO COLONNE ID:\n`);
    const idColumns = [
      "users.id",
      "organizations.id",
      "jobs.id",
      "job_offers.id",
      "bookings.id",
      "shopping_carts.id",
      "cart_items.id",
    ];
    let uuidIssues = 0;

    for (const colRef of idColumns) {
      const [table, column] = colRef.split(".");
      const exists = await tableExists(table);
      if (!exists) continue;

      const cols = await getTableColumns(table);
      const colInfo = cols.find((c) => c.column_name === column);

      if (colInfo) {
        const dataType = colInfo.data_type.toLowerCase();
        if (dataType === "uuid") {
          uuidIssues++;
          console.log(`   ❌ ${colRef}: è UUID (dovrebbe essere VARCHAR)`);
        } else if (
          dataType.includes("varchar") ||
          dataType.includes("character varying") ||
          dataType === "text"
        ) {
          console.log(`   ✅ ${colRef}: ${dataType}`);
        } else {
          console.log(`   ⚠️  ${colRef}: tipo sconosciuto (${dataType})`);
        }
      }
    }

    if (uuidIssues > 0) {
      console.log(`\n   ⚠️  ${uuidIssues} colonne ID sono ancora di tipo UUID`);
    }

    // Riepilogo finale
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 RIEPILOGO FINALE:`);
    console.log(
      `   Tabelle: ${existingTables.length}/${expectedTables.length} esistenti`,
    );
    console.log(
      `   Colonne critiche: ${totalColumnsChecked - missingColumns}/${totalColumnsChecked} presenti`,
    );
    console.log(`   Colonne ID UUID: ${uuidIssues} problemi`);

    if (
      missingTables.length === 0 &&
      missingColumns === 0 &&
      uuidIssues === 0
    ) {
      console.log(`\n   ✅ Schema completamente sincronizzato!`);
    } else {
      console.log(
        `\n   ⚠️  Ci sono ancora ${missingTables.length + missingColumns + uuidIssues} problemi da risolvere`,
      );
    }
    console.log(`${"=".repeat(60)}\n`);

    await client.end();
  } catch (error) {
    console.error("❌ Errore durante la verifica:", error);
    await client.end();
    process.exit(1);
  }
}

verifySchema();
