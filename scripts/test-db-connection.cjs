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

async function testConnection() {
  try {
    console.log("🔌 Test connessione Supabase...\n");
    console.log("Config:", {
      host: process.env.PGHOST,
      port: process.env.PGPORT,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      hasPassword: !!process.env.PGPASSWORD,
    });

    await client.connect();
    console.log("✅ Connesso a Supabase\n");

    // Test 1: Verifica tabelle principali
    console.log("📋 Test 1: Verifica tabelle principali...");
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'organizations', 'org_memberships', 'products', 'skus', 'vendor_catalog_items', 'price_lists', 'price_list_items', 'inventories')
      ORDER BY table_name
    `);
    console.log(
      "Tabelle trovate:",
      tables.rows.map((r) => r.table_name).join(", "),
    );

    // Test 2: Verifica utente login
    console.log("\n📋 Test 2: Verifica utente per login...");
    const userEmail = "giacomocavalcabo13@gmail.com";
    const userResult = await client.query(
      `
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.status,
        u.password_hash IS NOT NULL as has_password,
        u.password_salt IS NOT NULL as has_salt,
        u.role as user_role,
        om.role as membership_role, om.is_active as membership_active,
        o.id as org_id, o.legal_name, 
        COALESCE(o.type, o.org_type::text, 'buyer') as org_type
      FROM users u
      LEFT JOIN org_memberships om ON u.id = om.user_id AND om.is_active = true
      LEFT JOIN organizations o ON om.org_id = o.id
      WHERE u.email = $1 AND u.status = 'ACTIVE'
    `,
      [userEmail],
    );

    if (userResult.rows.length === 0) {
      console.log("❌ Utente NON trovato o non attivo");
    } else {
      const user = userResult.rows[0];
      console.log("✅ Utente trovato:");
      console.log("  - ID:", user.id);
      console.log("  - Email:", user.email);
      console.log("  - Has password_hash:", user.has_password);
      console.log("  - Has password_salt:", user.has_salt);
      console.log("  - User role:", user.user_role);
      console.log("  - Membership role:", user.membership_role);
      console.log("  - Membership active:", user.membership_active);
      console.log("  - Org ID:", user.org_id);
      console.log("  - Org name:", user.legal_name);
      console.log("  - Org type:", user.org_type);
    }

    // Test 3: Verifica query catalogo
    console.log("\n📋 Test 3: Verifica query catalogo pubblico...");
    try {
      const catalogResult = await client.query(`
        SELECT COUNT(*) as total
        FROM products p
        WHERE p.status = 'ACTIVE'
      `);
      console.log("✅ Query catalogo base OK");
      console.log("  - Prodotti attivi:", catalogResult.rows[0].total);

      // Test query completa (semplificata)
      const catalogFull = await client.query(`
        SELECT DISTINCT
          p.id as product_id,
          p.name as product_name,
          p.brand,
          p.model,
          p.product_type,
          COALESCE(
            (
              SELECT a."productId" as productId
              FROM assets a
              JOIN skus s_asset ON a.sku_id = s_asset.id
              WHERE s_asset.product_id = p.id
                AND a.asset_status = 'AVAILABLE'
              LIMIT 1
            ),
            p.id
          ) as productId
        FROM products p
        WHERE p.status = 'ACTIVE'
        LIMIT 5
      `);
      console.log("✅ Query catalogo completa OK");
      console.log("  - Prodotti test:", catalogFull.rows.length);
      if (catalogFull.rows.length > 0) {
        console.log("  - Primo prodotto:", catalogFull.rows[0].product_name);
      }
    } catch (error) {
      console.log("❌ Errore query catalogo:", error.message);
      console.log("  Stack:", error.stack?.split("\n").slice(0, 3).join("\n"));
    }

    // Test 4: Verifica colonne products
    console.log("\n📋 Test 4: Verifica colonne tabella products...");
    const productCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns
      WHERE table_name = 'products' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    const requiredCols = [
      "id",
      "name",
      "brand",
      "model",
      "product_type",
      "status",
      "specs_json",
      "images_json",
      "glb_files_json",
      "specs_core_json",
    ];
    const existingCols = productCols.rows.map((c) => c.column_name);
    console.log("Colonne richieste:", requiredCols.join(", "));
    console.log(
      "Colonne mancanti:",
      requiredCols.filter((c) => !existingCols.includes(c)).join(", ") ||
        "Nessuna",
    );

    // Test 5: Verifica tabella assets
    console.log("\n📋 Test 5: Verifica tabella assets...");
    const assetsCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'assets'
    `);
    if (assetsCheck.rows.length === 0) {
      console.log("⚠️  Tabella assets NON trovata (opzionale)");
    } else {
      const assetCols = await client.query(`
        SELECT column_name 
        FROM information_schema.columns
        WHERE table_name = 'assets' AND table_schema = 'public'
      `);
      console.log("✅ Tabella assets trovata");
      console.log(
        "  - Colonne:",
        assetCols.rows.map((c) => c.column_name).join(", "),
      );
    }

    await client.end();
    console.log("\n✅ Test completati");
  } catch (error) {
    console.error("❌ Errore:", error.message);
    console.error("Stack:", error.stack?.split("\n").slice(0, 5).join("\n"));
    process.exit(1);
  }
}

testConnection();
