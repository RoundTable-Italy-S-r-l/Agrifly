require("dotenv").config();
const { Client } = require("pg");

(async () => {
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

    // Verifica valori enum OrgType
    const orgTypeValues = await client.query(
      'SELECT unnest(enum_range(NULL::"OrgType")) as value',
    );
    console.log("📋 Valori enum OrgType:");
    orgTypeValues.rows.forEach((row) => {
      console.log(`  ${row.value}`);
    });

    // Verifica valori nelle organizations
    const orgTypes = await client.query(
      "SELECT DISTINCT type, org_type, COUNT(*) as count FROM organizations GROUP BY type, org_type",
    );
    console.log("\n📋 Valori nelle organizations:");
    orgTypes.rows.forEach((row) => {
      console.log(
        `  type: ${row.type}, org_type: ${row.org_type}, count: ${row.count}`,
      );
    });

    await client.end();
  } catch (error) {
    console.error("❌ Errore:", error.message);
    process.exit(1);
  }
})();
