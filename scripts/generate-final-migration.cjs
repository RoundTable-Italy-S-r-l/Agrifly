const { Client } = require("pg");
require("dotenv").config();

const config = {
  host: process.env.PGHOST || "aws-1-eu-central-2.pooler.supabase.com",
  port: Number(process.env.PGPORT || 6543),
  database: process.env.PGDATABASE || "postgres",
  user: process.env.PGUSER || "postgres.fzowfkfwriajohjjboed",
  password: process.env.PGPASSWORD || "_Mszqe_%uF_82%@",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
};

// Schema atteso dal codice
const expectedSchema = {
  // Tabelle da creare
  order_items: {
    columns: [
      "id",
      "order_id",
      "sku_id",
      "quantity",
      "unit_price_cents",
      "total_cents",
    ],
    create: true,
  },
  organization_settings: {
    columns: [
      "id",
      "org_id",
      "setting_key",
      "setting_value",
      "created_at",
      "updated_at",
    ],
    create: true,
  },

  // Colonne da aggiungere (con mapping se necessario)
  skus: ["variant_name"],
  price_list_items: ["currency"],
  assets: ["productid"],
  locations: [
    "address_line",
    "city",
    "province",
    "postal_code",
    "country",
    "latitude",
    "longitude",
    "is_default",
  ],
  job_offer_messages: [
    "sender_org_id",
    "message_text", // Nota: esiste 'body' nel DB, ma il codice usa 'message_text'
    "is_read",
  ],
  bookings: ["payment_status", "paid_at"],
  service_area_sets: ["org_id"],
  orders: [
    "order_number",
    "vendor_org_id",
    "updated_at",
    // NOTA: shipping_address e billing_address esistono già come TEXT (non ID)
  ],
  order_messages: [
    "sender_org_id",
    "message_text", // Nota: esiste 'body' nel DB, ma il codice usa 'message_text'
    "is_read",
  ],
  organization_invitations: ["org_id", "status"],
};

// Mapping nomi colonne DB -> Codice (per gestire differenze)
const columnMappings = {
  job_offer_messages: {
    body: "message_text", // Il DB ha 'body', il codice usa 'message_text'
  },
  order_messages: {
    body: "message_text", // Il DB ha 'body', il codice usa 'message_text'
  },
  orders: {
    shipping_address: "shipping_address_id", // Il DB ha TEXT, codice vuole ID
    billing_address: "billing_address_id", // Il DB ha TEXT, codice vuole ID
  },
};

// Tipi di colonne
const columnTypes = {
  id: "VARCHAR(255)",
  order_id: "VARCHAR(255)",
  sku_id: "VARCHAR(255)",
  quantity: "INTEGER",
  unit_price_cents: "INTEGER",
  total_cents: "INTEGER",
  org_id: "VARCHAR(255)",
  setting_key: "VARCHAR(255)",
  setting_value: "TEXT",
  variant_name: "TEXT",
  currency: "VARCHAR(10)",
  productid: "TEXT",
  address_line: "TEXT",
  city: "TEXT",
  province: "TEXT",
  postal_code: "VARCHAR(20)",
  country: "VARCHAR(2)",
  latitude: "NUMERIC(10,8)",
  longitude: "NUMERIC(11,8)",
  is_default: "BOOLEAN",
  sender_org_id: "VARCHAR(255)",
  message_text: "TEXT",
  is_read: "BOOLEAN",
  payment_status: "VARCHAR(50)",
  paid_at: "TIMESTAMP",
  order_number: "VARCHAR(100)",
  vendor_org_id: "VARCHAR(255)",
  shipping_address_id: "VARCHAR(255)",
  billing_address_id: "VARCHAR(255)",
  updated_at: "TIMESTAMP DEFAULT NOW()",
  status: "VARCHAR(50)",
  created_at: "TIMESTAMP DEFAULT NOW()",
};

function getColumnType(columnName) {
  return columnTypes[columnName] || "TEXT";
}

async function generateFinalMigration() {
  const client = new Client(config);

  try {
    await client.connect();
    console.log("✅ Connesso a Supabase\n");

    // Ottieni tutte le tabelle dal database
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const dbTables = tablesResult.rows.map((r) => r.table_name);

    console.log(
      "-- ============================================================",
    );
    console.log(
      "-- Script di migrazione finale - Solo colonne/tabelle mancanti",
    );
    console.log("-- Generato automaticamente");
    console.log(
      "-- ============================================================\n",
    );

    // 1. Crea tabelle mancanti
    console.log(
      "-- ============================================================",
    );
    console.log("-- Tabelle mancanti da creare");
    console.log(
      "-- ============================================================\n",
    );

    const tablesToCreate = ["order_items", "organization_settings"];
    for (const tableName of tablesToCreate) {
      if (dbTables.includes(tableName)) {
        console.log(`-- ⚠️  Tabella ${tableName} esiste già, saltata`);
        continue;
      }

      const schema = expectedSchema[tableName];
      if (!schema || !schema.create) continue;

      const columns = schema.columns;
      console.log(`-- Tabella: ${tableName}`);
      console.log(`CREATE TABLE IF NOT EXISTS ${tableName} (`);

      const colDefs = columns.map((col, idx) => {
        const type = getColumnType(col);
        const isLast = idx === columns.length - 1;
        const comma = isLast ? "" : ",";

        if (col === "id") {
          return `  id VARCHAR(255) PRIMARY KEY${comma}`;
        }

        return `  ${col} ${type}${comma}`;
      });

      console.log(colDefs.join("\n"));
      console.log(");\n");
    }

    // 2. Aggiungi colonne mancanti
    console.log(
      "-- ============================================================",
    );
    console.log("-- Colonne mancanti da aggiungere");
    console.log(
      "-- ============================================================\n",
    );

    // Gestisci colonne speciali (con mapping o note)
    const specialHandling = {
      job_offer_messages: {
        message_text: {
          check: "body", // Verifica se esiste 'body' e crea alias o colonna
          note: "Nota: esiste già body, potrebbe essere necessario un alias o migration",
        },
      },
      order_messages: {
        message_text: {
          check: "body",
          note: "Nota: esiste già body, potrebbe essere necessario un alias o migration",
        },
      },
    };

    for (const [tableName, columns] of Object.entries(expectedSchema)) {
      if (typeof columns === "object" && columns.create) continue; // Skip tabelle da creare

      if (!dbTables.includes(tableName)) {
        console.log(`-- ⚠️  Tabella ${tableName} non esiste, saltata`);
        continue;
      }

      // Ottieni colonne dal database
      const columnsResult = await client.query(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public'
      `,
        [tableName],
      );

      const dbColumns = columnsResult.rows.map((r) => r.column_name);
      const codeColumns = Array.isArray(columns) ? columns : [];

      // Processa colonne (gestisci oggetti con note)
      const missingColumns = [];
      for (const col of codeColumns) {
        const colName = typeof col === "object" ? col.name : col;

        // Per message_text, aggiungiamo comunque anche se esiste body
        // (il codice usa message_text, non body)
        if (colName === "message_text" && dbColumns.includes("body")) {
          console.log(
            `-- ⚠️  ${tableName}.${colName}: esiste 'body' nel DB, ma il codice usa 'message_text'`,
          );
          // Aggiungiamo comunque message_text come colonna separata
          if (!dbColumns.includes(colName)) {
            missingColumns.push({ name: colName });
          }
          continue;
        }

        if (!dbColumns.includes(colName)) {
          missingColumns.push({ name: colName });
        }
      }

      if (missingColumns.length > 0) {
        console.log(`-- Tabella: ${tableName}`);
        for (const col of missingColumns) {
          const type = getColumnType(col.name);
          console.log(
            `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${col.name} ${type};`,
          );
        }
        console.log("");
      }
    }

    await client.end();

    console.log(
      "-- ============================================================",
    );
    console.log("-- Fine script migrazione");
    console.log(
      "-- ============================================================\n",
    );
  } catch (error) {
    console.error("❌ Errore:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

generateFinalMigration();
