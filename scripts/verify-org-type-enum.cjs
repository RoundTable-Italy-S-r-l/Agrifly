#!/usr/bin/env node

/**
 * Verifica rapida del tipo di organizations.type
 */

const { Client } = require("pg");
require("dotenv").config();

async function verify() {
  const client = new Client({
    host: process.env.PGHOST,
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE || "postgres",
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });

  try {
    await client.connect();

    // Verifica tipo colonna
    const result = await client.query(`
      SELECT data_type, udt_name, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'organizations' 
      AND column_name = 'type';
    `);

    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log("Tipo colonna:", row.data_type);
      console.log("UDT Name:", row.udt_name);
      console.log("Default:", row.column_default);

      if (row.data_type === "USER-DEFINED" && row.udt_name === "OrgType") {
        console.log("\n✅ organizations.type è enum OrgType");
      } else {
        console.log("\n❌ organizations.type NON è enum");
      }
    }

    // Verifica valori
    const values = await client.query(`
      SELECT DISTINCT type, COUNT(*) as count
      FROM organizations
      GROUP BY type
      ORDER BY type;
    `);

    console.log("\nValori nella tabella:");
    values.rows.forEach((r) => {
      console.log(`  - "${r.type}": ${r.count}`);
    });
  } catch (error) {
    console.error("Errore:", error.message);
  } finally {
    await client.end();
  }
}

verify();
