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

async function compareSchemas() {
  try {
    await supabaseClient.connect();
    console.log("✅ Connesso a Supabase PostgreSQL\n");

    // Tabelle Supabase
    const supabaseTables = await supabaseClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    const supabaseTableNames = supabaseTables.rows.map((r) => r.table_name);

    // Tabelle SQLite
    const sqliteTables = sqliteDb
      .prepare(
        `
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `,
      )
      .all();
    const sqliteTableNames = sqliteTables.map((t) => t.name);

    console.log("📊 CONFRONTO TABELLE:\n");
    console.log(`Supabase: ${supabaseTableNames.length} tabelle`);
    console.log(`SQLite locale: ${sqliteTableNames.length} tabelle\n`);

    // Tabelle solo in Supabase
    const onlyInSupabase = supabaseTableNames.filter(
      (t) => !sqliteTableNames.includes(t),
    );
    if (onlyInSupabase.length > 0) {
      console.log("📋 Tabelle solo in Supabase:");
      onlyInSupabase.forEach((t) => console.log(`  + ${t}`));
      console.log("");
    }

    // Tabelle solo in SQLite
    const onlyInSQLite = sqliteTableNames.filter(
      (t) => !supabaseTableNames.includes(t),
    );
    if (onlyInSQLite.length > 0) {
      console.log("📋 Tabelle solo in SQLite locale:");
      onlyInSQLite.forEach((t) => console.log(`  - ${t}`));
      console.log("");
    }

    // Tabelle comuni
    const commonTables = supabaseTableNames.filter((t) =>
      sqliteTableNames.includes(t),
    );
    console.log(`✅ Tabelle comuni: ${commonTables.length}\n`);

    // Verifica colonna is_certified in organizations
    console.log("🔍 VERIFICA COLONNA is_certified:\n");

    // Supabase
    const supabaseOrgColumns = await supabaseClient.query(`
      SELECT column_name 
      FROM information_schema.columns
      WHERE table_name = 'organizations' AND table_schema = 'public'
    `);
    const hasIsCertifiedSupabase = supabaseOrgColumns.rows.some(
      (c) => c.column_name === "is_certified",
    );
    console.log(
      `Supabase: ${hasIsCertifiedSupabase ? "✅ Presente" : "❌ MANCANTE"}`,
    );

    // SQLite
    const sqliteOrgColumns = sqliteDb
      .prepare(`PRAGMA table_info(organizations)`)
      .all();
    const hasIsCertifiedSQLite = sqliteOrgColumns.some(
      (c) => c.name === "is_certified",
    );
    console.log(
      `SQLite locale: ${hasIsCertifiedSQLite ? "✅ Presente" : "❌ Mancante"}\n`,
    );

    if (!hasIsCertifiedSupabase) {
      console.log("⚠️  La colonna is_certified NON esiste in Supabase!");
      console.log(
        "   Deve essere aggiunta per far funzionare la feature dei preventivi certificati.\n",
      );
    }

    // Confronto colonne organizations
    console.log("📋 CONFRONTO COLONNE organizations:\n");

    const supabaseCols = supabaseOrgColumns.rows
      .map((c) => c.column_name)
      .sort();
    const sqliteCols = sqliteOrgColumns.map((c) => c.name).sort();

    const onlyInSupabaseCols = supabaseCols.filter(
      (c) => !sqliteCols.includes(c),
    );
    const onlyInSQLiteCols = sqliteCols.filter(
      (c) => !supabaseCols.includes(c),
    );

    if (onlyInSupabaseCols.length > 0) {
      console.log("Colonne solo in Supabase:");
      onlyInSupabaseCols.forEach((c) => console.log(`  + ${c}`));
      console.log("");
    }

    if (onlyInSQLiteCols.length > 0) {
      console.log("Colonne solo in SQLite:");
      onlyInSQLiteCols.forEach((c) => console.log(`  - ${c}`));
      console.log("");
    }

    await supabaseClient.end();
    sqliteDb.close();
  } catch (err) {
    console.error("❌ Errore:", err.message);
    process.exit(1);
  }
}

compareSchemas();
