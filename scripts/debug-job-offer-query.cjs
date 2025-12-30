const { Client } = require('pg');
require('dotenv').config();

async function debugQuery() {
  const client = new Client({
    host: process.env.PGHOST,
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE || 'postgres',
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connesso a Supabase\n');

    const orgId = 'lenzi-org-id';
    const offerId = 'offer_1767028330610_h5ifxclnr';
    const jobId = 'job_mjrc1jxfh07fm6mwpk6';

    // 1. Verifica la job offer direttamente
    console.log('1️⃣ Verifica job_offer direttamente...');
    const offerResult = await client.query('SELECT * FROM job_offers WHERE id = $1', [offerId]);
    console.log(`   Job offers trovate: ${offerResult.rows.length}`);
    if (offerResult.rows.length > 0) {
      const offer = offerResult.rows[0];
      console.log(`   - ID: ${offer.id}`);
      console.log(`   - job_id: ${offer.job_id}`);
      console.log(`   - operator_org_id: ${offer.operator_org_id}`);
      console.log(`   - status: ${offer.status}`);
    }
    console.log('');

    // 2. Verifica se il job esiste
    console.log('2️⃣ Verifica se il job esiste...');
    const jobResult = await client.query('SELECT * FROM jobs WHERE id = $1', [jobId]);
    console.log(`   Jobs trovate: ${jobResult.rows.length}`);
    if (jobResult.rows.length > 0) {
      const job = jobResult.rows[0];
      console.log(`   - ID: ${job.id}`);
      console.log(`   - buyer_org_id: ${job.buyer_org_id}`);
      console.log(`   - field_name: ${job.field_name}`);
      console.log(`   - status: ${job.status}`);
    } else {
      console.log(`   ❌ Job non trovato! Questo è il problema - il job_id nella job_offer non esiste nella tabella jobs.`);
    }
    console.log('');

    // 3. Verifica il JOIN semplice
    console.log('3️⃣ Test JOIN semplice job_offers -> jobs...');
    const joinResult = await client.query(`
      SELECT jo.id, jo.job_id, j.id as job_exists
      FROM job_offers jo
      LEFT JOIN jobs j ON jo.job_id = j.id
      WHERE jo.operator_org_id = $1
    `, [orgId]);
    console.log(`   Risultati: ${joinResult.rows.length}`);
    joinResult.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. offer_id: ${row.id}, job_id: ${row.job_id}, job_exists: ${row.job_exists || 'NULL'}`);
    });
    console.log('');

    // 4. Verifica il JOIN con organizations (buyer_org)
    console.log('4️⃣ Test JOIN con buyer_org...');
    const buyerOrgResult = await client.query(`
      SELECT jo.id, jo.job_id, j.buyer_org_id, buyer_org.id as buyer_org_exists
      FROM job_offers jo
      JOIN jobs j ON jo.job_id = j.id
      LEFT JOIN organizations buyer_org ON j.buyer_org_id = buyer_org.id
      WHERE jo.operator_org_id = $1
    `, [orgId]);
    console.log(`   Risultati: ${buyerOrgResult.rows.length}`);
    buyerOrgResult.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. offer_id: ${row.id}, job_id: ${row.job_id}, buyer_org_id: ${row.buyer_org_id}, buyer_org_exists: ${row.buyer_org_exists || 'NULL'}`);
    });
    console.log('');

    // 5. Verifica il JOIN con organizations (operator_org)
    console.log('5️⃣ Test JOIN con operator_org...');
    const operatorOrgResult = await client.query(`
      SELECT jo.id, jo.operator_org_id, operator_org.id as operator_org_exists
      FROM job_offers jo
      LEFT JOIN organizations operator_org ON jo.operator_org_id = operator_org.id
      WHERE jo.operator_org_id = $1
    `, [orgId]);
    console.log(`   Risultati: ${operatorOrgResult.rows.length}`);
    operatorOrgResult.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. offer_id: ${row.id}, operator_org_id: ${row.operator_org_id}, operator_org_exists: ${row.operator_org_exists || 'NULL'}`);
    });
    console.log('');

    // 6. Test query completa come nel codice
    console.log('6️⃣ Test query completa "made" (come nel codice)...');
    try {
      const fullQueryResult = await client.query(`
        SELECT 
          jo.id, jo.job_id, jo.operator_org_id, jo.status, jo.pricing_snapshot_json,
          jo.total_cents, jo.currency, jo.proposed_start, jo.proposed_end, jo.provider_note,
          jo.created_at, jo.updated_at,
          j.field_name, j.service_type, j.area_ha, j.location_json,
          j.target_date_start, j.target_date_end, j.notes, j.status as job_status,
          buyer_org.legal_name as buyer_org_legal_name,
          operator_org.legal_name as operator_org_legal_name
        FROM job_offers jo
        JOIN jobs j ON jo.job_id = j.id
        JOIN organizations buyer_org ON j.buyer_org_id = buyer_org.id
        LEFT JOIN organizations operator_org ON jo.operator_org_id = operator_org.id
        WHERE jo.operator_org_id = $1
        ORDER BY jo.created_at DESC
      `, [orgId]);
      console.log(`   Risultati: ${fullQueryResult.rows.length}`);
      if (fullQueryResult.rows.length > 0) {
        const first = fullQueryResult.rows[0];
        console.log(`   Prima offerta: ID=${first.id}, field_name=${first.field_name}, status=${first.status}`);
      }
    } catch (error) {
      console.log(`   ❌ Errore nella query: ${error.message}`);
    }
    console.log('');

  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

debugQuery();

