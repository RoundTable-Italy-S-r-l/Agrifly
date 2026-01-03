require("dotenv").config();
const { Client } = require("pg");

async function testAPI() {
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

    // Test con org che ha metriche
    const orgId = "2e210dbb5d7749258104e";

    console.log("📊 Test API Endpoint:");
    console.log(`GET /api/operators/metrics/ORGANIZATION/${orgId}\n`);

    const result = await client.query(
      `
      SELECT 
        avg_response_minutes,
        sample_count,
        last_response_at,
        calculation_window_days,
        last_calculated_at
      FROM response_metrics
      WHERE entity_type = 'ORGANIZATION' AND entity_id = $1
    `,
      [orgId],
    );

    if (result.rows.length === 0) {
      console.log("Response:");
      console.log(
        JSON.stringify(
          {
            avg_response_minutes: null,
            sample_count: 0,
            last_response_at: null,
            calculation_window_days: 90,
            last_calculated_at: null,
            status: "insufficient_data",
          },
          null,
          2,
        ),
      );
    } else {
      const metric = result.rows[0];
      console.log("Response:");
      console.log(
        JSON.stringify(
          {
            avg_response_minutes:
              parseFloat(metric.avg_response_minutes) || null,
            sample_count: parseInt(metric.sample_count) || 0,
            last_response_at: metric.last_response_at,
            calculation_window_days:
              parseInt(metric.calculation_window_days) || 90,
            last_calculated_at: metric.last_calculated_at,
            status: metric.sample_count >= 5 ? "reliable" : "building",
          },
          null,
          2,
        ),
      );
    }

    await client.end();
  } catch (error) {
    console.error("❌ Errore:", error.message);
    await client.end();
    process.exit(1);
  }
}

testAPI();
