require("dotenv").config();
const { Client } = require("pg");

async function verify() {
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
    console.log("✅ Connesso a Supabase\n");

    // Verifica tabelle
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('response_events', 'response_metrics')
      ORDER BY table_name
    `);
    console.log("📊 Tabelle:");
    tables.rows.forEach((r) => console.log(`  ✅ ${r.table_name}`));

    // Verifica enum
    const enumCheck = await client.query(`
      SELECT typname 
      FROM pg_type 
      WHERE typname = 'EntityType'
    `);
    if (enumCheck.rows.length > 0) {
      console.log(`  ✅ Enum EntityType`);
    }

    // Conta eventi e metriche
    const eventsCount = await client.query(
      "SELECT COUNT(*) as count FROM response_events",
    );
    console.log(`\n📈 Eventi response_events: ${eventsCount.rows[0].count}`);

    const metricsCount = await client.query(
      "SELECT COUNT(*) as count FROM response_metrics",
    );
    console.log(`📈 Metriche response_metrics: ${metricsCount.rows[0].count}`);

    // Verifica conversation OPEN
    const openConvs = await client.query(`
      SELECT COUNT(*) as count 
      FROM conversations 
      WHERE status = 'OPEN'
    `);
    console.log(`\n💬 Conversation OPEN: ${openConvs.rows[0].count}`);

    // Verifica messaggi nelle conversation OPEN
    const messagesInOpen = await client.query(`
      SELECT COUNT(*) as count
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE c.status = 'OPEN'
        AND m.created_at >= NOW() - INTERVAL '7 days'
    `);
    console.log(
      `💬 Messaggi in conversation OPEN (ultimi 7 giorni): ${messagesInOpen.rows[0].count}`,
    );

    await client.end();
    console.log("\n✅ Verifica completata");
  } catch (error) {
    console.error("❌ Errore:", error.message);
    await client.end();
    process.exit(1);
  }
}

verify();
