require("dotenv").config();
const { Client } = require("pg");

async function testResponseMetrics() {
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

    // 1. Trova 2 organizzazioni esistenti
    console.log("🔍 Cerca organizzazioni...");
    const orgs = await client.query(`
      SELECT id, legal_name 
      FROM organizations 
      WHERE status = 'ACTIVE'
      LIMIT 2
    `);

    if (orgs.rows.length < 2) {
      console.log(
        "❌ Servono almeno 2 organizzazioni attive. Trovate:",
        orgs.rows.length,
      );
      await client.end();
      return;
    }

    const org1 = orgs.rows[0];
    const org2 = orgs.rows[1];
    console.log(`✅ Organizzazioni trovate:`);
    console.log(`  - Org1: ${org1.legal_name} (${org1.id})`);
    console.log(`  - Org2: ${org2.legal_name} (${org2.id})\n`);

    // 2. Trova utenti per queste organizzazioni
    console.log("🔍 Cerca utenti per le organizzazioni...");
    const user1 = await client.query(
      `
      SELECT u.id, u.email, om.org_id
      FROM users u
      JOIN org_memberships om ON om.user_id = u.id
      WHERE om.org_id = $1 AND om.is_active = true AND u.status = 'ACTIVE'
      LIMIT 1
    `,
      [org1.id],
    );

    const user2 = await client.query(
      `
      SELECT u.id, u.email, om.org_id
      FROM users u
      JOIN org_memberships om ON om.user_id = u.id
      WHERE om.org_id = $1 AND om.is_active = true AND u.status = 'ACTIVE'
      LIMIT 1
    `,
      [org2.id],
    );

    if (user1.rows.length === 0 || user2.rows.length === 0) {
      console.log("❌ Servono utenti attivi per entrambe le organizzazioni");
      await client.end();
      return;
    }

    const u1 = user1.rows[0];
    const u2 = user2.rows[0];
    console.log(`✅ Utenti trovati:`);
    console.log(`  - User1: ${u1.email} (${u1.id})`);
    console.log(`  - User2: ${u2.email} (${u2.id})\n`);

    // 3. Crea un job di test (per avere un context)
    console.log("📝 Crea job di test...");
    const jobId = `test_job_${Date.now()}`;
    await client.query(
      `
      INSERT INTO jobs (
        id, buyer_org_id, service_type, status, field_name, field_polygon,
        created_at, updated_at
      ) VALUES ($1, $2, 'SPRAY', 'ACCEPTED', 'Campo Test', '[]', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `,
      [jobId, org1.id],
    );
    console.log(`✅ Job creato: ${jobId}\n`);

    // 4. Crea conversation OPEN
    console.log("💬 Crea conversation...");

    // Verifica se esiste già
    const existingConv = await client.query(
      `
      SELECT id FROM conversations WHERE context_type = 'JOB' AND context_id = $1
    `,
      [jobId],
    );

    let finalConvId;
    if (existingConv.rows.length > 0) {
      finalConvId = existingConv.rows[0].id;
      // Aggiorna status a OPEN
      await client.query(
        `
        UPDATE conversations SET status = 'OPEN' WHERE id = $1
      `,
        [finalConvId],
      );
      console.log(`✅ Conversation esistente aggiornata: ${finalConvId}\n`);
    } else {
      finalConvId = `test_conv_${Date.now()}`;
      await client.query(
        `
        INSERT INTO conversations (
          id, context_type, context_id, status, created_at
        ) VALUES ($1, 'JOB', $2, 'OPEN', NOW())
      `,
        [finalConvId, jobId],
      );
      console.log(`✅ Conversation creata: ${finalConvId}\n`);
    }

    // 5. Aggiungi partecipanti
    console.log("👥 Aggiungi partecipanti...");
    await client.query(
      `
      INSERT INTO conversation_participants (id, conversation_id, org_id, role, joined_at)
      VALUES 
        ($1, $2, $3, 'BUYER', NOW()),
        ($2 || '_2', $2, $4, 'OPERATOR', NOW())
      ON CONFLICT (conversation_id, org_id) DO NOTHING
    `,
      [`${finalConvId}_p1`, finalConvId, org1.id, org2.id],
    );
    console.log(`✅ Partecipanti aggiunti\n`);

    // 6. Crea messaggi con timing realistico (simula risposte)
    console.log("📨 Crea messaggi di test...");
    const now = new Date();

    // Messaggio 1: Org1 alle 10:00
    const msg1Time = new Date(now.getTime() - 60 * 60 * 1000); // 1 ora fa
    await client.query(
      `
      INSERT INTO messages (id, conversation_id, sender_user_id, body, created_at)
      VALUES ($1, $2, $3, 'Ciao, ho bisogno di un preventivo per il trattamento', $4)
    `,
      [`msg_${Date.now()}_1`, finalConvId, u1.id, msg1Time],
    );

    // Messaggio 2: Org1 ancora (blocco consecutivo) alle 10:01
    const msg2Time = new Date(msg1Time.getTime() + 1 * 60 * 1000); // +1 minuto
    await client.query(
      `
      INSERT INTO messages (id, conversation_id, sender_user_id, body, created_at)
      VALUES ($1, $2, $3, 'Il campo è di 5 ettari', $4)
    `,
      [`msg_${Date.now()}_2`, finalConvId, u1.id, msg2Time],
    );

    // Messaggio 3: Org2 risponde alle 10:15 (14 minuti dopo)
    const msg3Time = new Date(msg2Time.getTime() + 14 * 60 * 1000); // +14 minuti
    await client.query(
      `
      INSERT INTO messages (id, conversation_id, sender_user_id, body, created_at)
      VALUES ($1, $2, $3, 'Perfetto, posso aiutarti. Quale tipo di trattamento?', $4)
    `,
      [`msg_${Date.now()}_3`, finalConvId, u2.id, msg3Time],
    );

    // Messaggio 4: Org1 risponde alle 10:20 (5 minuti dopo)
    const msg4Time = new Date(msg3Time.getTime() + 5 * 60 * 1000); // +5 minuti
    await client.query(
      `
      INSERT INTO messages (id, conversation_id, sender_user_id, body, created_at)
      VALUES ($1, $2, $3, 'Trattamento fitosanitario per vigneto', $4)
    `,
      [`msg_${Date.now()}_4`, finalConvId, u1.id, msg4Time],
    );

    // Messaggio 5: Org2 risponde alle 10:25 (5 minuti dopo)
    const msg5Time = new Date(msg4Time.getTime() + 5 * 60 * 1000); // +5 minuti
    await client.query(
      `
      INSERT INTO messages (id, conversation_id, sender_user_id, body, created_at)
      VALUES ($1, $2, $3, 'Ottimo, ti invio il preventivo entro oggi', $4)
    `,
      [`msg_${Date.now()}_5`, finalConvId, u2.id, msg5Time],
    );

    console.log(`✅ 5 messaggi creati\n`);

    // 7. Verifica messaggi creati
    const msgCount = await client.query(
      `
      SELECT COUNT(*) as count FROM messages WHERE conversation_id = $1
    `,
      [finalConvId],
    );
    console.log(`📊 Messaggi nella conversation: ${msgCount.rows[0].count}\n`);

    await client.end();

    console.log("✅ Setup completato!");
    console.log(`\n📋 Dettagli test:`);
    console.log(`  - Conversation ID: ${finalConvId}`);
    console.log(`  - Job ID: ${jobId}`);
    console.log(`  - Org1 (requester): ${org1.legal_name}`);
    console.log(`  - Org2 (responder): ${org2.legal_name}`);
    console.log(
      `\n🚀 Ora esegui: tsx server/scripts/calculate-response-metrics.ts`,
    );
  } catch (error) {
    console.error("❌ Errore:", error.message);
    console.error(error.stack);
    await client.end();
    process.exit(1);
  }
}

testResponseMetrics();
