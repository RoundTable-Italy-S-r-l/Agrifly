const { Client } = require("pg");
require("dotenv").config();

async function checkJobOffers() {
  const client = new Client({
    host: process.env.PGHOST,
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE || "postgres",
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("✅ Connesso a Supabase\n");

    const orgId = "lenzi-org-id";

    // 1. Verifica se l'organizzazione esiste
    console.log("1️⃣ Verifica organizzazione lenzi-org-id...");
    const orgResult = await client.query(
      "SELECT id, legal_name, type FROM organizations WHERE id = $1",
      [orgId],
    );
    console.log(`   Organizzazioni trovate: ${orgResult.rows.length}`);
    if (orgResult.rows.length > 0) {
      console.log(
        `   - ${orgResult.rows[0].legal_name} (type: ${orgResult.rows[0].type})`,
      );
    }
    console.log("");

    // 2. Conta tutte le job_offers
    console.log("2️⃣ Conta tutte le job_offers nel database...");
    const allOffersResult = await client.query(
      "SELECT COUNT(*) as count FROM job_offers",
    );
    console.log(`   Totale job_offers: ${allOffersResult.rows[0].count}`);
    console.log("");

    // 3. Conta job_offers per operator_org_id = lenzi-org-id (offers "made")
    console.log(
      '3️⃣ Conta job_offers dove operator_org_id = lenzi-org-id (offers "made")...',
    );
    const madeOffersResult = await client.query(
      "SELECT COUNT(*) as count FROM job_offers WHERE operator_org_id = $1",
      [orgId],
    );
    console.log(`   Job offers "made": ${madeOffersResult.rows[0].count}`);

    if (madeOffersResult.rows[0].count > 0) {
      const madeOffersDetail = await client.query(
        `
        SELECT jo.id, jo.job_id, jo.operator_org_id, jo.status, jo.total_cents, jo.created_at
        FROM job_offers jo
        WHERE jo.operator_org_id = $1
        ORDER BY jo.created_at DESC
        LIMIT 5
      `,
        [orgId],
      );
      console.log("   Dettagli (prime 5):");
      madeOffersDetail.rows.forEach((offer, i) => {
        console.log(
          `   ${i + 1}. ID: ${offer.id}, job_id: ${offer.job_id}, status: ${offer.status}, total_cents: ${offer.total_cents}, created: ${offer.created_at}`,
        );
      });
    }
    console.log("");

    // 4. Conta jobs dove buyer_org_id = lenzi-org-id
    console.log("4️⃣ Conta jobs dove buyer_org_id = lenzi-org-id...");
    const buyerJobsResult = await client.query(
      "SELECT COUNT(*) as count FROM jobs WHERE buyer_org_id = $1",
      [orgId],
    );
    console.log(
      `   Jobs dove lenzi-org-id è buyer: ${buyerJobsResult.rows[0].count}`,
    );

    if (buyerJobsResult.rows[0].count > 0) {
      const buyerJobsDetail = await client.query(
        `
        SELECT j.id, j.buyer_org_id, j.field_name, j.status, j.created_at
        FROM jobs j
        WHERE j.buyer_org_id = $1
        ORDER BY j.created_at DESC
        LIMIT 5
      `,
        [orgId],
      );
      console.log("   Dettagli (prime 5):");
      buyerJobsDetail.rows.forEach((job, i) => {
        console.log(
          `   ${i + 1}. ID: ${job.id}, field_name: ${job.field_name}, status: ${job.status}, created: ${job.created_at}`,
        );
      });
    }
    console.log("");

    // 5. Conta job_offers per jobs dove buyer_org_id = lenzi-org-id (offers "received")
    console.log(
      '5️⃣ Conta job_offers per jobs dove buyer_org_id = lenzi-org-id (offers "received")...',
    );
    const receivedOffersResult = await client.query(
      `
      SELECT COUNT(*) as count
      FROM job_offers jo
      JOIN jobs j ON jo.job_id = j.id
      WHERE j.buyer_org_id = $1
    `,
      [orgId],
    );
    console.log(
      `   Job offers "received": ${receivedOffersResult.rows[0].count}`,
    );

    if (receivedOffersResult.rows[0].count > 0) {
      const receivedOffersDetail = await client.query(
        `
        SELECT jo.id, jo.job_id, jo.operator_org_id, jo.status, jo.total_cents, j.buyer_org_id, j.field_name, jo.created_at
        FROM job_offers jo
        JOIN jobs j ON jo.job_id = j.id
        WHERE j.buyer_org_id = $1
        ORDER BY jo.created_at DESC
        LIMIT 5
      `,
        [orgId],
      );
      console.log("   Dettagli (prime 5):");
      receivedOffersDetail.rows.forEach((offer, i) => {
        console.log(
          `   ${i + 1}. ID: ${offer.id}, job_id: ${offer.job_id}, field_name: ${offer.field_name}, operator_org_id: ${offer.operator_org_id}, status: ${offer.status}, created: ${offer.created_at}`,
        );
      });
    }
    console.log("");

    // 6. Verifica la query esatta che usa il codice (received offers)
    console.log('6️⃣ Test query "received" (quella usata dal codice)...');
    const receivedTestResult = await client.query(
      `
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
      WHERE j.buyer_org_id = $1
      ORDER BY jo.created_at DESC
    `,
      [orgId],
    );
    console.log(
      `   Risultati query "received": ${receivedTestResult.rows.length}`,
    );
    if (receivedTestResult.rows.length > 0) {
      console.log("   Prima offerta:");
      const first = receivedTestResult.rows[0];
      console.log(
        `   - ID: ${first.id}, job_id: ${first.job_id}, field_name: ${first.field_name}, status: ${first.status}`,
      );
    }
    console.log("");

    // 7. Verifica la query esatta che usa il codice (made offers)
    console.log('7️⃣ Test query "made" (quella usata dal codice)...');
    const madeTestResult = await client.query(
      `
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
    `,
      [orgId],
    );
    console.log(`   Risultati query "made": ${madeTestResult.rows.length}`);
    if (madeTestResult.rows.length > 0) {
      console.log("   Prima offerta:");
      const first = madeTestResult.rows[0];
      console.log(
        `   - ID: ${first.id}, job_id: ${first.job_id}, field_name: ${first.field_name}, status: ${first.status}`,
      );
    }
    console.log("");

    // 8. Conta tutte le job_offers con i loro operator_org_id per vedere se ce ne sono altre
    console.log("8️⃣ Tutte le job_offers nel database (primi 10)...");
    const allOffersDetail = await client.query(`
      SELECT jo.id, jo.job_id, jo.operator_org_id, jo.status, j.buyer_org_id
      FROM job_offers jo
      LEFT JOIN jobs j ON jo.job_id = j.id
      ORDER BY jo.created_at DESC
      LIMIT 10
    `);
    console.log(`   Prime 10 job_offers:`);
    allOffersDetail.rows.forEach((offer, i) => {
      console.log(
        `   ${i + 1}. ID: ${offer.id}, job_id: ${offer.job_id}, operator_org_id: ${offer.operator_org_id}, buyer_org_id: ${offer.buyer_org_id || "NULL"}, status: ${offer.status}`,
      );
    });
    console.log("");

    // 9. Verifica se ci sono job_offers con operator_org_id o buyer_org_id diversi da lenzi-org-id
    console.log("9️⃣ Verifica altre organizzazioni con job_offers...");
    const otherOrgsResult = await client.query(`
      SELECT 
        jo.operator_org_id,
        COUNT(*) as count
      FROM job_offers jo
      GROUP BY jo.operator_org_id
      ORDER BY count DESC
      LIMIT 10
    `);
    console.log("   Operator orgs con più job_offers:");
    otherOrgsResult.rows.forEach((row, i) => {
      console.log(
        `   ${i + 1}. operator_org_id: ${row.operator_org_id || "NULL"}, count: ${row.count}`,
      );
    });
    console.log("");
  } catch (error) {
    console.error("❌ Errore:", error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

checkJobOffers();
