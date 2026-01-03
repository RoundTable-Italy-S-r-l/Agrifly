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

async function runMigrations() {
  try {
    console.log("🔗 Connessione a Supabase...");
    await client.connect();
    console.log("✅ Connesso a Supabase\n");

    // 1. Verifica e aggiungi is_active a rate_cards
    console.log("📋 [1/3] Verifica colonna is_active in rate_cards...");
    const checkIsActive = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'rate_cards' 
        AND column_name = 'is_active'
        AND table_schema = 'public'
    `);

    if (checkIsActive.rows.length === 0) {
      console.log("   ➕ Aggiunta colonna is_active a rate_cards...");
      await client.query(`
        ALTER TABLE rate_cards 
        ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true
      `);
      console.log("   ✅ Colonna is_active aggiunta");
    } else {
      console.log("   ✅ Colonna is_active già esistente");
    }

    // 2. Verifica e aggiungi order_number a orders (se necessario)
    console.log("\n📋 [2/3] Verifica colonna order_number in orders...");
    const checkOrderNumber = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'orders' 
        AND column_name = 'order_number'
        AND table_schema = 'public'
    `);

    if (checkOrderNumber.rows.length === 0) {
      console.log(
        "   ℹ️  Colonna order_number non esiste (non necessaria, il codice usa o.id)",
      );
      console.log("   ✅ Nessuna azione richiesta");
    } else {
      console.log("   ✅ Colonna order_number già esistente");
    }

    // 3. Verifica altre colonne critiche
    console.log("\n📋 [3/3] Verifica altre colonne critiche...");

    // Verifica is_certified in organizations
    const checkIsCertified = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'organizations' 
        AND column_name = 'is_certified'
        AND table_schema = 'public'
    `);

    if (checkIsCertified.rows.length === 0) {
      console.log("   ➕ Aggiunta colonna is_certified a organizations...");
      await client.query(`
        ALTER TABLE organizations 
        ADD COLUMN is_certified BOOLEAN NOT NULL DEFAULT false
      `);
      console.log("   ✅ Colonna is_certified aggiunta");
    } else {
      console.log("   ✅ Colonna is_certified già esistente");
    }

    // Verifica role in users
    const checkRole = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' 
        AND column_name = 'role'
        AND table_schema = 'public'
    `);

    if (checkRole.rows.length === 0) {
      console.log("   ➕ Aggiunta colonna role a users...");
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN role VARCHAR(50) DEFAULT 'admin'
      `);
      console.log("   ✅ Colonna role aggiunta");
    } else {
      console.log("   ✅ Colonna role già esistente");
    }

    console.log("\n✅ Tutte le migrazioni completate con successo!");
    await client.end();
  } catch (error) {
    console.error("❌ Errore durante le migrazioni:", error);
    await client.end();
    process.exit(1);
  }
}

runMigrations();
