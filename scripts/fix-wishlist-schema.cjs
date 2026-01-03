const { Client } = require("pg");
require("dotenv/config");

const client = new Client({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || "6543"),
  database: process.env.PGDATABASE || "postgres",
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function fixWishlistSchema() {
  try {
    await client.connect();
    console.log("✅ Connesso a Supabase PostgreSQL\n");

    // 1. Aggiungi product_id se non esiste
    try {
      await client.query(
        `ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS product_id TEXT`,
      );
      console.log("✅ Colonna product_id verificata/aggiunta");
    } catch (err) {
      console.log("ℹ️  product_id:", err.message);
    }

    // 2. Rendi sku_id nullable
    try {
      await client.query(
        `ALTER TABLE wishlist_items ALTER COLUMN sku_id DROP NOT NULL`,
      );
      console.log("✅ sku_id resa nullable");
    } catch (err) {
      console.log("⚠️  Errore nel rendere sku_id nullable:", err.message);
    }

    // Verifica risultato
    console.log("\n📊 Verifica finale schema:");
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'wishlist_items' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);

    columns.rows.forEach((col) => {
      console.log(
        `  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable === "YES" ? "YES" : "NO"})`,
      );
    });

    const skuIdNullable =
      columns.rows.find((col) => col.column_name === "sku_id")?.is_nullable ===
      "YES";
    const hasProductId = columns.rows.some(
      (col) => col.column_name === "product_id",
    );

    console.log("\n✅ Risultato:");
    console.log(`  - product_id presente: ${hasProductId ? "✅" : "❌"}`);
    console.log(`  - sku_id nullable: ${skuIdNullable ? "✅" : "❌"}`);
  } catch (error) {
    console.error("❌ Errore:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixWishlistSchema();
