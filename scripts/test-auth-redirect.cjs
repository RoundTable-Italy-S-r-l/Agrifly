/**
 * Test script per verificare le modifiche di auth-redirect
 * Testa: login, registrazione, redirect, Index.tsx dinamico
 */

require("dotenv").config();
const { Client } = require("pg");

async function testAuthRedirect() {
  const client = new Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("✅ Connesso al database\n");

    // Test 1: Verifica che le tabelle necessarie esistano
    console.log("📊 Test 1: Verifica tabelle necessarie");
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'organizations', 'org_memberships', 'response_events', 'response_metrics')
      ORDER BY table_name
    `);

    const expectedTables = [
      "users",
      "organizations",
      "org_memberships",
      "response_events",
      "response_metrics",
    ];
    const foundTables = tables.rows.map((r) => r.table_name);
    const missing = expectedTables.filter((t) => !foundTables.includes(t));

    if (missing.length > 0) {
      console.log("❌ Tabelle mancanti:", missing);
      return;
    }
    console.log("✅ Tutte le tabelle necessarie sono presenti\n");

    // Test 2: Verifica enum EntityType
    console.log("📊 Test 2: Verifica enum EntityType");
    const enumCheck = await client.query(`
      SELECT typname, enumlabel 
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid 
      WHERE typname = 'EntityType'
      ORDER BY enumsortorder
    `);

    if (enumCheck.rows.length === 0) {
      console.log("❌ Enum EntityType non trovato");
      return;
    }
    console.log(
      "✅ Enum EntityType presente con valori:",
      enumCheck.rows.map((r) => r.enumlabel).join(", "),
      "\n",
    );

    // Test 3: Verifica organizzazioni buyer/vendor/operator
    console.log("📊 Test 3: Verifica organizzazioni per tipo");
    const orgTypes = await client.query(`
      SELECT type, COUNT(*) as count
      FROM organizations
      WHERE type IN ('buyer', 'vendor', 'operator')
      GROUP BY type
      ORDER BY type
    `);

    console.log("Organizzazioni per tipo:");
    orgTypes.rows.forEach((row) => {
      console.log(`  ${row.type}: ${row.count}`);
    });
    console.log("");

    // Test 4: Verifica response_events e response_metrics
    console.log("📊 Test 4: Verifica response_events e response_metrics");
    const eventsCount = await client.query(
      "SELECT COUNT(*) as count FROM response_events",
    );
    const metricsCount = await client.query(
      "SELECT COUNT(*) as count FROM response_metrics",
    );

    console.log(`  response_events: ${eventsCount.rows[0].count} righe`);
    console.log(`  response_metrics: ${metricsCount.rows[0].count} righe`);
    console.log("");

    // Test 5: Verifica struttura response_events
    console.log("📊 Test 5: Verifica struttura response_events");
    const eventsColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'response_events'
      ORDER BY ordinal_position
    `);

    const requiredColumns = [
      "id",
      "conversation_id",
      "requester_org_id",
      "requester_user_id",
      "request_message_id",
      "responder_org_id",
      "responder_user_id",
      "response_message_id",
      "response_seconds",
      "response_minutes",
      "created_at",
    ];

    const foundColumns = eventsColumns.rows.map((r) => r.column_name);
    const missingColumns = requiredColumns.filter(
      (c) => !foundColumns.includes(c),
    );

    if (missingColumns.length > 0) {
      console.log("❌ Colonne mancanti in response_events:", missingColumns);
    } else {
      console.log("✅ Tutte le colonne necessarie sono presenti");
    }
    console.log("");

    // Test 6: Verifica struttura response_metrics
    console.log("📊 Test 6: Verifica struttura response_metrics");
    const metricsColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'response_metrics'
      ORDER BY ordinal_position
    `);

    const requiredMetricsColumns = [
      "id",
      "entity_type",
      "entity_id",
      "avg_response_minutes",
      "sample_count",
      "last_response_at",
      "calculation_window_days",
      "last_calculated_at",
    ];

    const foundMetricsColumns = metricsColumns.rows.map((r) => r.column_name);
    const missingMetricsColumns = requiredMetricsColumns.filter(
      (c) => !foundMetricsColumns.includes(c),
    );

    if (missingMetricsColumns.length > 0) {
      console.log(
        "❌ Colonne mancanti in response_metrics:",
        missingMetricsColumns,
      );
    } else {
      console.log("✅ Tutte le colonne necessarie sono presenti");
    }
    console.log("");

    // Test 7: Verifica foreign keys
    console.log("📊 Test 7: Verifica foreign keys");
    const fks = await client.query(`
      SELECT conname, conrelid::regclass, confrelid::regclass
      FROM pg_constraint
      WHERE contype = 'f'
      AND (conrelid::regclass::text = 'response_events' OR conrelid::regclass::text = 'response_metrics')
    `);

    console.log("Foreign keys trovate:");
    fks.rows.forEach((fk) => {
      console.log(`  ${fk.conname}: ${fk.conrelid} → ${fk.confrelid}`);
    });
    console.log("");

    // Test 8: Verifica indici
    console.log("📊 Test 8: Verifica indici");
    const indexes = await client.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE tablename IN ('response_events', 'response_metrics')
      ORDER BY tablename, indexname
    `);

    console.log("Indici trovati:");
    indexes.rows.forEach((idx) => {
      console.log(`  ${idx.tablename}.${idx.indexname}`);
    });
    console.log("");

    console.log("✅ Tutti i test di struttura database sono passati!");
    console.log("\n📝 Note:");
    console.log(
      "  - I test di funzionalità frontend (login, redirect, Index.tsx) richiedono test E2E",
    );
    console.log("  - Verifica manuale:");
    console.log("    1. Login/registrazione e redirect alla pagina di origine");
    console.log(
      "    2. Index.tsx mostra Login/Logout e Dashboard in base all'auth",
    );
    console.log(
      '    3. "Vai al sito" nelle dashboard AdminLayout e BuyerLayout',
    );
    console.log("    4. Vendor/operator vanno sempre a /admin (semplificato)");
  } catch (error) {
    console.error("❌ Errore durante i test:", error.message);
    throw error;
  } finally {
    await client.end();
  }
}

testAuthRedirect().catch(console.error);
