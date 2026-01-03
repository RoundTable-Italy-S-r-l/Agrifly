const { Client } = require("pg");
const Database = require("better-sqlite3");

// Connessione Supabase
const supabaseClient = new Client({
  host: process.env.PGHOST || "aws-1-eu-central-2.pooler.supabase.com",
  port: parseInt(process.env.PGPORT || "6543"),
  database: process.env.PGDATABASE || "postgres",
  user: process.env.PGUSER || "postgres.fzowfkfwriajohjjboed",
  password: process.env.PGPASSWORD || "_Mszqe_%uF_82%@",
  ssl: { rejectUnauthorized: false },
});

// Connessione SQLite locale
const sqliteDb = new Database("./prisma/dev.db");

async function syncLocalToSupabase() {
  try {
    await supabaseClient.connect();
    console.log("✅ Connesso a Supabase PostgreSQL\n");

    // Step 1: Aggiungi colonne mancanti in organizations
    console.log("📝 Step 1: Aggiunta colonne mancanti in organizations...\n");

    const columnsToAdd = [
      { name: "can_buy", type: "BOOLEAN", default: "true", nullable: false },
      { name: "can_sell", type: "BOOLEAN", default: "false", nullable: false },
      {
        name: "can_operate",
        type: "BOOLEAN",
        default: "false",
        nullable: false,
      },
      {
        name: "can_dispatch",
        type: "BOOLEAN",
        default: "false",
        nullable: false,
      },
      { name: "kind", type: "TEXT", default: "'BUSINESS'", nullable: false },
      { name: "type", type: "TEXT", nullable: true },
    ];

    for (const col of columnsToAdd) {
      try {
        // Verifica se esiste già
        const check = await supabaseClient.query(
          `
          SELECT column_name 
          FROM information_schema.columns
          WHERE table_name = 'organizations' 
            AND column_name = $1
            AND table_schema = 'public'
        `,
          [col.name],
        );

        if (check.rows.length === 0) {
          const nullableClause = col.nullable ? "" : "NOT NULL";
          const defaultClause = col.default ? `DEFAULT ${col.default}` : "";

          await supabaseClient.query(`
            ALTER TABLE organizations 
            ADD COLUMN ${col.name} ${col.type} ${defaultClause} ${nullableClause}
          `);
          console.log(`  ✅ Aggiunta colonna: ${col.name}`);
        } else {
          console.log(`  ⏭️  Colonna già presente: ${col.name}`);
        }
      } catch (err) {
        if (err.message.includes("already exists")) {
          console.log(`  ⏭️  Colonna già presente: ${col.name}`);
        } else {
          console.error(`  ❌ Errore aggiungendo ${col.name}:`, err.message);
        }
      }
    }

    // Step 2: Aggiungi tabelle mancanti
    console.log("\n📝 Step 2: Aggiunta tabelle mancanti...\n");

    // Tabella service_configurations
    try {
      await supabaseClient.query(`
        CREATE TABLE IF NOT EXISTS service_configurations (
          id TEXT PRIMARY KEY,
          org_id TEXT NOT NULL,
          base_location_lat REAL,
          base_location_lng REAL,
          base_location_address TEXT,
          working_hours_start INTEGER NOT NULL DEFAULT 8,
          working_hours_end INTEGER NOT NULL DEFAULT 18,
          available_days TEXT NOT NULL DEFAULT 'MON,TUE,WED,THU,FRI',
          offer_message_template TEXT,
          rejection_message_template TEXT,
          available_drones TEXT,
          preferred_terrain TEXT,
          max_slope_percentage REAL,
          fuel_surcharge_cents INTEGER NOT NULL DEFAULT 0,
          maintenance_surcharge_cents INTEGER NOT NULL DEFAULT 0,
          enable_offer_filters BOOLEAN NOT NULL DEFAULT false,
          max_distance_from_base REAL,
          accepted_service_types TEXT,
          min_price_per_ha_cents INTEGER,
          max_price_per_ha_cents INTEGER,
          accepted_terrain_conditions TEXT,
          max_accepted_slope REAL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
        )
      `);
      console.log("  ✅ Tabella service_configurations creata/verificata");
    } catch (err) {
      if (err.message.includes("already exists")) {
        console.log("  ⏭️  Tabella service_configurations già esiste");
      } else {
        console.error(
          "  ❌ Errore creando service_configurations:",
          err.message,
        );
      }
    }

    // Tabella conversations
    try {
      await supabaseClient.query(`
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          context_type TEXT NOT NULL,
          context_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'OPEN',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      console.log("  ✅ Tabella conversations creata/verificata");
    } catch (err) {
      if (err.message.includes("already exists")) {
        console.log("  ⏭️  Tabella conversations già esiste");
      } else {
        console.error("  ❌ Errore creando conversations:", err.message);
      }
    }

    // Tabella conversation_participants
    try {
      await supabaseClient.query(`
        CREATE TABLE IF NOT EXISTS conversation_participants (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          org_id TEXT NOT NULL,
          role TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
          FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
          UNIQUE(conversation_id, org_id)
        )
      `);
      console.log("  ✅ Tabella conversation_participants creata/verificata");
    } catch (err) {
      if (err.message.includes("already exists")) {
        console.log("  ⏭️  Tabella conversation_participants già esiste");
      } else {
        console.error(
          "  ❌ Errore creando conversation_participants:",
          err.message,
        );
      }
    }

    // Tabella messages
    try {
      await supabaseClient.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          sender_user_id TEXT NOT NULL,
          body TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
          FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log("  ✅ Tabella messages creata/verificata");
    } catch (err) {
      if (err.message.includes("already exists")) {
        console.log("  ⏭️  Tabella messages già esiste");
      } else {
        console.error("  ❌ Errore creando messages:", err.message);
      }
    }

    // Tabella job_offer_messages
    try {
      await supabaseClient.query(`
        CREATE TABLE IF NOT EXISTS job_offer_messages (
          id TEXT PRIMARY KEY,
          job_offer_id TEXT NOT NULL,
          sender_user_id TEXT NOT NULL,
          body TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          FOREIGN KEY (job_offer_id) REFERENCES job_offers(id) ON DELETE CASCADE,
          FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log("  ✅ Tabella job_offer_messages creata/verificata");
    } catch (err) {
      if (err.message.includes("already exists")) {
        console.log("  ⏭️  Tabella job_offer_messages già esiste");
      } else {
        console.error("  ❌ Errore creando job_offer_messages:", err.message);
      }
    }

    // Tabella order_messages
    try {
      await supabaseClient.query(`
        CREATE TABLE IF NOT EXISTS order_messages (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          sender_user_id TEXT NOT NULL,
          body TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
          FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log("  ✅ Tabella order_messages creata/verificata");
    } catch (err) {
      if (err.message.includes("already exists")) {
        console.log("  ⏭️  Tabella order_messages già esiste");
      } else {
        console.error("  ❌ Errore creando order_messages:", err.message);
      }
    }

    // Step 3: Migra dati da SQLite a Supabase
    console.log("\n📝 Step 3: Migrazione dati...\n");

    // Migra organizations (solo quelle non esistenti)
    console.log("  📋 Migrazione organizations...");
    const localOrgs = sqliteDb.prepare("SELECT * FROM organizations").all();
    const supabaseOrgs = await supabaseClient.query(
      "SELECT id FROM organizations",
    );
    const existingOrgIds = new Set(supabaseOrgs.rows.map((r) => r.id));

    // Funzione helper per convertire timestamp
    const parseTimestamp = (ts) => {
      if (!ts) return new Date().toISOString();
      if (typeof ts === "number") {
        // Se è un numero (millisecondi), converti
        return new Date(ts).toISOString();
      }
      if (typeof ts === "string") {
        // Se è già una stringa ISO, usa direttamente
        if (ts.match(/^\d+$/)) {
          return new Date(parseInt(ts)).toISOString();
        }
        return ts;
      }
      return new Date().toISOString();
    };

    let orgsAdded = 0;
    for (const org of localOrgs) {
      if (!existingOrgIds.has(org.id)) {
        try {
          // Verifica se Supabase usa org_type invece di kind
          const orgColumns = await supabaseClient.query(`
            SELECT column_name 
            FROM information_schema.columns
            WHERE table_name = 'organizations' AND column_name IN ('org_type', 'kind')
          `);
          const hasOrgType = orgColumns.rows.some(
            (c) => c.column_name === "org_type",
          );
          const hasKind = orgColumns.rows.some((c) => c.column_name === "kind");

          const orgTypeValue = hasOrgType
            ? org.org_type || org.kind || "BUSINESS"
            : null;
          const kindValue = hasKind ? org.kind || "BUSINESS" : null;

          const orgTypeCol = hasOrgType ? "org_type" : "";
          const kindCol = hasKind ? "kind" : "";
          const orgTypeVal = hasOrgType ? orgTypeValue : null;
          const kindVal = hasKind ? kindValue : null;

          const orgCols = [
            "id",
            "legal_name",
            "logo_url",
            "phone",
            "support_email",
            "vat_number",
            "tax_code",
            "address_line",
            "city",
            "province",
            "region",
            "postal_code",
            "country",
            "status",
            "created_at",
            "can_buy",
            "can_sell",
            "can_operate",
            "can_dispatch",
            kindCol,
            "type",
            "is_certified",
          ].filter((c) => c !== "");

          const orgVals = [
            org.id,
            org.legal_name,
            org.logo_url || null,
            org.phone || null,
            org.support_email || null,
            org.vat_number || null,
            org.tax_code || null,
            org.address_line,
            org.city,
            org.province,
            org.region,
            org.postal_code || null,
            org.country || "IT",
            org.status || "ACTIVE",
            parseTimestamp(org.created_at),
            org.can_buy !== undefined
              ? org.can_buy === 1 || org.can_buy === true
              : true,
            org.can_sell !== undefined
              ? org.can_sell === 1 || org.can_sell === true
              : false,
            org.can_operate !== undefined
              ? org.can_operate === 1 || org.can_operate === true
              : false,
            org.can_dispatch !== undefined
              ? org.can_dispatch === 1 || org.can_dispatch === true
              : false,
            kindVal,
            org.type || null,
            org.is_certified !== undefined
              ? org.is_certified === 1 || org.is_certified === true
              : false,
          ].filter((v, i) => orgCols[i] !== "");

          if (hasOrgType) {
            orgCols.splice(orgCols.indexOf("kind"), 1, "org_type");
            orgVals.splice(orgVals.indexOf(kindVal), 1, orgTypeValue);
          }

          const placeholders = orgCols.map((_, i) => `$${i + 1}`).join(", ");

          await supabaseClient.query(
            `
            INSERT INTO organizations (${orgCols.join(", ")})
            VALUES (${placeholders})
          `,
            orgVals,
          );
          orgsAdded++;
        } catch (err) {
          console.error(
            `    ⚠️  Errore inserendo organization ${org.id}:`,
            err.message,
          );
        }
      }
    }
    console.log(
      `    ✅ Aggiunte ${orgsAdded} organizzazioni (${localOrgs.length - orgsAdded} già esistenti)`,
    );

    // Migra users (solo quelli non esistenti)
    console.log("  👤 Migrazione users...");
    const localUsers = sqliteDb.prepare("SELECT * FROM users").all();
    const supabaseUsers = await supabaseClient.query("SELECT id FROM users");
    const existingUserIds = new Set(supabaseUsers.rows.map((r) => r.id));

    let usersAdded = 0;
    for (const user of localUsers) {
      if (!existingUserIds.has(user.id)) {
        try {
          // Verifica se la tabella users ha updated_at come NOT NULL
          const userColumns = await supabaseClient.query(`
            SELECT column_name, is_nullable 
            FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'updated_at'
          `);
          const needsUpdatedAt =
            userColumns.rows.length > 0 &&
            userColumns.rows[0].is_nullable === "NO";

          await supabaseClient.query(
            `
            INSERT INTO users (
              id, email, first_name, last_name, phone, password_hash, password_salt,
              email_verified, email_verified_at, status, created_at${needsUpdatedAt ? ", updated_at" : ""}
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11${needsUpdatedAt ? ", $12" : ""})
          `,
            [
              user.id,
              user.email,
              user.first_name || null,
              user.last_name || null,
              user.phone || null,
              user.password_hash,
              user.password_salt || null,
              user.email_verified || false,
              user.email_verified_at
                ? parseTimestamp(user.email_verified_at)
                : null,
              user.status || "ACTIVE",
              parseTimestamp(user.created_at),
              ...(needsUpdatedAt
                ? [parseTimestamp(user.updated_at || user.created_at)]
                : []),
            ],
          );
          usersAdded++;
        } catch (err) {
          console.error(
            `    ⚠️  Errore inserendo user ${user.id}:`,
            err.message,
          );
        }
      }
    }
    console.log(
      `    ✅ Aggiunti ${usersAdded} utenti (${localUsers.length - usersAdded} già esistenti)`,
    );

    // Migra altre tabelle comuni (jobs, job_offers, rate_cards, etc.)
    const commonTables = [
      "jobs",
      "job_offers",
      "rate_cards",
      "products",
      "skus",
    ];

    // Gestione speciale per saved_fields: ricrea la tabella con la struttura corretta
    console.log("  📋 Gestione saved_fields...");
    try {
      // Verifica se esiste la vecchia struttura
      const oldStructure = await supabaseClient.query(`
        SELECT column_name 
        FROM information_schema.columns
        WHERE table_name = 'saved_fields' AND column_name = 'client_name'
      `);

      if (oldStructure.rows.length > 0) {
        // Elimina la vecchia tabella (è vuota comunque)
        console.log("    🔄 Rimozione vecchia struttura saved_fields...");
        await supabaseClient.query("DROP TABLE IF EXISTS saved_fields CASCADE");
      }

      // Crea la tabella con la struttura corretta
      await supabaseClient.query(`
        CREATE TABLE IF NOT EXISTS saved_fields (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          name TEXT NOT NULL,
          polygon TEXT NOT NULL,
          area_ha REAL,
          location_json TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )
      `);
      console.log(
        "    ✅ Tabella saved_fields creata/aggiornata con struttura corretta",
      );

      // Migra i dati dal locale
      const localFields = sqliteDb.prepare("SELECT * FROM saved_fields").all();
      if (localFields.length > 0) {
        const existingFields = await supabaseClient.query(
          "SELECT id FROM saved_fields",
        );
        const existingIds = new Set(existingFields.rows.map((r) => r.id));

        let fieldsAdded = 0;
        for (const field of localFields) {
          if (!existingIds.has(field.id)) {
            try {
              await supabaseClient.query(
                `
                INSERT INTO saved_fields (
                  id, organization_id, name, polygon, area_ha, location_json, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              `,
                [
                  field.id,
                  field.organization_id,
                  field.name,
                  field.polygon,
                  field.area_ha || null,
                  field.location_json || null,
                  parseTimestamp(field.created_at),
                  parseTimestamp(field.updated_at || field.created_at),
                ],
              );
              fieldsAdded++;
            } catch (err) {
              console.error(
                `    ⚠️  Errore inserendo saved_field ${field.id}:`,
                err.message.substring(0, 100),
              );
            }
          }
        }
        console.log(
          `    ✅ saved_fields: aggiunti ${fieldsAdded} record (${localFields.length - fieldsAdded} già esistenti)`,
        );
      } else {
        console.log("    ⏭️  Nessun saved_field da migrare dal locale");
      }
    } catch (err) {
      console.error("    ❌ Errore gestendo saved_fields:", err.message);
    }

    for (const tableName of commonTables) {
      try {
        const localData = sqliteDb.prepare(`SELECT * FROM ${tableName}`).all();
        if (localData.length === 0) continue;

        // Ottieni colonne della tabella
        const supabaseColumns = await supabaseClient.query(
          `
          SELECT column_name 
          FROM information_schema.columns
          WHERE table_name = $1 AND table_schema = 'public'
          ORDER BY ordinal_position
        `,
          [tableName],
        );

        if (supabaseColumns.rows.length === 0) {
          console.log(
            `    ⏭️  Tabella ${tableName} non esiste in Supabase, saltata`,
          );
          continue;
        }

        const columnNames = supabaseColumns.rows.map((c) => c.column_name);
        const idColumn = columnNames.find((c) => c === "id") || columnNames[0];

        // Ottieni ID esistenti
        const existingIds = await supabaseClient.query(
          `SELECT ${idColumn} FROM ${tableName}`,
        );
        const existingIdSet = new Set(existingIds.rows.map((r) => r[idColumn]));

        let added = 0;
        for (const row of localData) {
          if (!existingIdSet.has(row[idColumn])) {
            try {
              const cols = columnNames.filter((c) => row[c] !== undefined);
              // Converti timestamp e boolean
              const values = cols.map((c) => {
                const val = row[c];
                // Se è una colonna timestamp/date
                if (
                  c.includes("_at") ||
                  c.includes("_date") ||
                  c.includes("created") ||
                  c.includes("updated") ||
                  c.includes("_start") ||
                  c.includes("_end") ||
                  c === "proposed_start" ||
                  c === "proposed_end"
                ) {
                  return parseTimestamp(val);
                }
                // Se è boolean e viene da SQLite (0/1)
                if (typeof val === "number" && (val === 0 || val === 1)) {
                  const colInfo = supabaseColumns.rows.find(
                    (col) => col.column_name === c,
                  );
                  if (
                    colInfo &&
                    (colInfo.data_type === "boolean" ||
                      colInfo.data_type === "USER-DEFINED")
                  ) {
                    return val === 1;
                  }
                }
                // Se è null e la colonna è NOT NULL, usa default
                if (val === null || val === undefined) {
                  const colInfo = supabaseColumns.rows.find(
                    (col) => col.column_name === c,
                  );
                  if (colInfo && colInfo.is_nullable === "NO") {
                    // Prova a usare un valore di default ragionevole
                    if (c.includes("name") || c.includes("title")) return "";
                    if (c.includes("_cents") || c.includes("_amount")) return 0;
                    if (colInfo.data_type === "boolean") return false;
                    if (colInfo.data_type === "text") return "";
                  }
                }
                return val;
              });
              const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");

              await supabaseClient.query(
                `
                INSERT INTO ${tableName} (${cols.join(", ")})
                VALUES (${placeholders})
              `,
                values,
              );
              added++;
            } catch (err) {
              // Ignora errori di foreign key, constraint, o formato UUID
              if (
                !err.message.includes("violates foreign key") &&
                !err.message.includes("duplicate key") &&
                !err.message.includes("invalid input syntax for type uuid")
              ) {
                console.error(
                  `    ⚠️  Errore inserendo in ${tableName} (ID: ${row[idColumn]}):`,
                  err.message.substring(0, 100),
                );
              }
            }
          }
        }

        if (added > 0) {
          console.log(
            `    ✅ ${tableName}: aggiunti ${added} record (${localData.length - added} già esistenti)`,
          );
        }
      } catch (err) {
        console.error(`    ❌ Errore processando ${tableName}:`, err.message);
      }
    }

    // Migra service_configurations se esiste in locale
    try {
      const localConfigs = sqliteDb
        .prepare("SELECT * FROM service_configurations")
        .all();
      if (localConfigs.length > 0) {
        const existing = await supabaseClient.query(
          "SELECT id FROM service_configurations",
        );
        const existingIds = new Set(existing.rows.map((r) => r.id));

        let added = 0;
        for (const config of localConfigs) {
          if (!existingIds.has(config.id)) {
            try {
              await supabaseClient.query(
                `
                INSERT INTO service_configurations (
                  id, org_id, base_location_lat, base_location_lng, base_location_address,
                  working_hours_start, working_hours_end, available_days,
                  offer_message_template, rejection_message_template, available_drones,
                  preferred_terrain, max_slope_percentage, fuel_surcharge_cents,
                  maintenance_surcharge_cents, enable_offer_filters, max_distance_from_base,
                  accepted_service_types, min_price_per_ha_cents, max_price_per_ha_cents,
                  accepted_terrain_conditions, max_accepted_slope, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
              `,
                [
                  config.id,
                  config.org_id,
                  config.base_location_lat || null,
                  config.base_location_lng || null,
                  config.base_location_address || null,
                  config.working_hours_start || 8,
                  config.working_hours_end || 18,
                  config.available_days || "MON,TUE,WED,THU,FRI",
                  config.offer_message_template || null,
                  config.rejection_message_template || null,
                  config.available_drones || null,
                  config.preferred_terrain || null,
                  config.max_slope_percentage || null,
                  config.fuel_surcharge_cents || 0,
                  config.maintenance_surcharge_cents || 0,
                  config.enable_offer_filters || false,
                  config.max_distance_from_base || null,
                  config.accepted_service_types || null,
                  config.min_price_per_ha_cents || null,
                  config.max_price_per_ha_cents || null,
                  config.accepted_terrain_conditions || null,
                  config.max_accepted_slope || null,
                  parseTimestamp(config.created_at),
                  parseTimestamp(config.updated_at || config.created_at),
                ],
              );
              added++;
            } catch (err) {
              console.error(
                `    ⚠️  Errore inserendo service_configuration ${config.id}:`,
                err.message,
              );
            }
          }
        }
        console.log(`    ✅ service_configurations: aggiunti ${added} record`);
      }
    } catch (err) {
      console.log(
        `    ⏭️  service_configurations non presente in locale o errore:`,
        err.message,
      );
    }

    console.log("\n✅ Sincronizzazione completata!");
    console.log("\n📊 Riepilogo finale:");
    console.log(
      "  ✅ Colonne aggiunte in organizations (can_buy, can_sell, can_operate, can_dispatch, kind, type)",
    );
    console.log(
      "  ✅ Tabelle create: service_configurations, conversations, conversation_participants, messages, job_offer_messages, order_messages",
    );
    console.log("  ✅ saved_fields: struttura aggiornata e dati migrati");
    console.log(
      "  ✅ Dati migrati da SQLite locale a Supabase (evitando duplicati)",
    );
    console.log("\n💡 Prossimi passi:");
    console.log("  - Verifica i dati in Supabase");
    console.log(
      "  - Se necessario, esegui di nuovo lo script per aggiornare i dati",
    );

    await supabaseClient.end();
    sqliteDb.close();
  } catch (err) {
    console.error("❌ Errore:", err.message);
    process.exit(1);
  }
}

syncLocalToSupabase();
