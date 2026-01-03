const { Client } = require("pg");
require("dotenv").config();

async function testLeftJoin() {
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

    console.log(
      'Test query "made" con LEFT JOIN (come nel codice aggiornato)...',
    );
    const result = await client.query(
      `
      SELECT 
        jo.id, jo.job_id, jo.operator_org_id, jo.status, jo.pricing_snapshot_json,
        jo.total_cents, jo.currency, jo.proposed_start, jo.proposed_end, jo.provider_note,
        jo.created_at, jo.updated_at,
        j.field_name, j.service_type, j.area_ha, j.location_json,
        j.target_date_start, j.target_date_end, j.notes, j.status as job_status,
        j.buyer_org_id,
        buyer_org.legal_name as buyer_org_legal_name,
        operator_org.legal_name as operator_org_legal_name
      FROM job_offers jo
      LEFT JOIN jobs j ON jo.job_id = j.id
      LEFT JOIN organizations buyer_org ON j.buyer_org_id = buyer_org.id
      LEFT JOIN organizations operator_org ON jo.operator_org_id = operator_org.id
      WHERE jo.operator_org_id = $1
      ORDER BY jo.created_at DESC
    `,
      [orgId],
    );

    console.log(`Risultati: ${result.rows.length}`);
    if (result.rows.length > 0) {
      const first = result.rows[0];
      console.log("\nPrima offerta:");
      console.log(`- ID: ${first.id}`);
      console.log(`- job_id: ${first.job_id}`);
      console.log(`- operator_org_id: ${first.operator_org_id}`);
      console.log(`- status: ${first.status}`);
      console.log(`- field_name: ${first.field_name || "NULL"}`);
      console.log(`- buyer_org_id: ${first.buyer_org_id || "NULL"}`);
      console.log(
        `- buyer_org_legal_name: ${first.buyer_org_legal_name || "NULL"}`,
      );
      console.log(
        `- operator_org_legal_name: ${first.operator_org_legal_name || "NULL"}`,
      );
    } else {
      console.log("❌ Nessun risultato!");
    }
  } catch (error) {
    console.error("❌ Errore:", error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

testLeftJoin();
