require('dotenv').config();
const { Client } = require('pg');

async function checkResults() {
  const client = new Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connesso a Supabase\n');

    // Verifica eventi creati
    console.log('📊 Response Events creati:');
    const events = await client.query(`
      SELECT 
        id,
        requester_org_id,
        responder_org_id,
        response_seconds,
        response_minutes,
        created_at
      FROM response_events
      ORDER BY created_at
    `);
    
    if (events.rows.length === 0) {
      console.log('  ⚠️  Nessun evento trovato');
    } else {
      events.rows.forEach((event, i) => {
        console.log(`\n  Evento ${i + 1}:`);
        console.log(`    - Requester Org: ${event.requester_org_id}`);
        console.log(`    - Responder Org: ${event.responder_org_id}`);
        console.log(`    - Tempo risposta: ${event.response_seconds}s (${event.response_minutes.toFixed(2)} minuti)`);
        console.log(`    - Creato: ${event.created_at}`);
      });
    }

    // Verifica metriche aggregate
    console.log('\n📈 Response Metrics aggregate:');
    const metrics = await client.query(`
      SELECT 
        entity_type,
        entity_id,
        avg_response_minutes,
        sample_count,
        last_response_at,
        calculation_window_days
      FROM response_metrics
      ORDER BY entity_type, entity_id
    `);
    
    if (metrics.rows.length === 0) {
      console.log('  ⚠️  Nessuna metrica trovata');
    } else {
      metrics.rows.forEach((metric, i) => {
        console.log(`\n  Metrica ${i + 1}:`);
        console.log(`    - Tipo: ${metric.entity_type}`);
        console.log(`    - ID: ${metric.entity_id}`);
        console.log(`    - Tempo medio: ${metric.avg_response_minutes.toFixed(2)} minuti`);
        console.log(`    - Campione: ${metric.sample_count} risposte`);
        console.log(`    - Ultima risposta: ${metric.last_response_at}`);
        console.log(`    - Finestra calcolo: ${metric.calculation_window_days} giorni`);
      });
    }

    // Verifica organizzazioni coinvolte
    console.log('\n🏢 Organizzazioni coinvolte:');
    const orgs = await client.query(`
      SELECT DISTINCT o.id, o.legal_name
      FROM organizations o
      WHERE o.id IN (
        SELECT DISTINCT responder_org_id FROM response_events
        UNION
        SELECT DISTINCT requester_org_id FROM response_events
      )
    `);
    
    orgs.rows.forEach(org => {
      console.log(`  - ${org.legal_name} (${org.id})`);
    });

    await client.end();
    console.log('\n✅ Verifica completata');
  } catch (error) {
    console.error('❌ Errore:', error.message);
    await client.end();
    process.exit(1);
  }
}

checkResults();

