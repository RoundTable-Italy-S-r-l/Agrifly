require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");

async function checkDatabase() {
  const client = new Client({
    host: process.env.PGHOST,
    port: process.env.PGPORT || 6543,
    database: process.env.PGDATABASE || "postgres",
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("✅ Connesso al database\n");

    // 1. Controlla se esiste la tabella rate_cards
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'rate_cards'
      );
    `);
    console.log("📋 Tabella rate_cards esiste?", tableCheck.rows[0].exists);

    if (!tableCheck.rows[0].exists) {
      console.log("❌ La tabella rate_cards non esiste!");
      await client.end();
      return;
    }

    // 2. Controlla struttura colonne
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'rate_cards'
      ORDER BY ordinal_position;
    `);
    console.log("\n📋 Colonne nella tabella rate_cards:");
    columns.rows.forEach((col) => {
      console.log(
        `  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`,
      );
    });

    // 3. Conta rate_cards per lenzi-org-id
    const count = await client.query(`
      SELECT COUNT(*) as count
      FROM rate_cards
      WHERE seller_org_id = 'lenzi-org-id';
    `);
    console.log("\n📊 Rate cards per lenzi-org-id:", count.rows[0].count);

    // 4. Lista rate_cards per lenzi-org-id
    const rateCards = await client.query(`
      SELECT id, seller_org_id, service_type, is_active
      FROM rate_cards
      WHERE seller_org_id = 'lenzi-org-id'
      ORDER BY service_type;
    `);
    console.log("\n📋 Rate cards per lenzi-org-id:");
    if (rateCards.rows.length === 0) {
      console.log("  ❌ Nessuna rate card trovata!");
    } else {
      rateCards.rows.forEach((rc) => {
        console.log(
          `  - ${rc.service_type}: id=${rc.id}, active=${rc.is_active}`,
        );
      });
    }

    // 5. Controlla tutte le organizzazioni con rate_cards
    const allOrgs = await client.query(`
      SELECT DISTINCT seller_org_id, COUNT(*) as count
      FROM rate_cards
      GROUP BY seller_org_id
      ORDER BY count DESC;
    `);
    console.log("\n📋 Tutte le organizzazioni con rate cards:");
    allOrgs.rows.forEach((org) => {
      console.log(`  - ${org.seller_org_id}: ${org.count} rate cards`);
    });

    // 6. Verifica se lenzi-org-id esiste nelle organizations
    const orgCheck = await client.query(`
      SELECT id, legal_name, type
      FROM organizations
      WHERE id = 'lenzi-org-id';
    `);
    console.log("\n📋 Organizzazione lenzi-org-id:");
    if (orgCheck.rows.length === 0) {
      console.log("  ❌ Organizzazione non trovata!");
    } else {
      const org = orgCheck.rows[0];
      console.log(`  ✅ Trovata: ${org.legal_name} (type: ${org.type})`);
    }
  } catch (error) {
    console.error("❌ Errore:", error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

checkDatabase();
