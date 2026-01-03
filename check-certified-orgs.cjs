const { Client } = require("pg");
require("dotenv").config();

const client = new Client({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || "5432"),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function checkCertifiedOrgs() {
  try {
    console.log("🔗 Connessione a Supabase...");
    await client.connect();
    console.log("✅ Connesso a Supabase PostgreSQL\n");

    // Controlla colonne della tabella organizations
    const columns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'organizations' 
      ORDER BY column_name
    `);
    console.log('📋 Colonne tabella organizations:');
    columns.rows.forEach(col => console.log(`   - ${col.column_name}`));
    console.log('');

    // Controlla organizzazioni certificate
    const certified = await client.query(`
      SELECT id, legal_name, type, status, is_certified 
      FROM organizations 
      WHERE is_certified = true
    `);
    console.log('📊 Organizzazioni certificate:');
    console.log(`   Trovate: ${certified.rows.length}`);
    certified.rows.forEach((org, i) => {
      console.log(`   ${i+1}. ${org.legal_name} (${org.id})`);
      console.log(`      Tipo: ${org.type}, Status: ${org.status}, Certificata: ${org.is_certified}`);
    });
    console.log('');

    // Controlla rate cards per organizzazioni certificate
    const rateCards = await client.query(`
      SELECT DISTINCT o.legal_name, rc.service_type, rc.is_active, rc.base_rate_per_ha_cents
      FROM organizations o
      JOIN rate_cards rc ON rc.seller_org_id = o.id
      WHERE o.is_certified = true
      ORDER BY o.legal_name, rc.service_type
    `);
    console.log('📊 Rate cards per organizzazioni certificate:');
    rateCards.rows.forEach(row => {
      const ratePerHa = row.base_rate_per_ha_cents ? (row.baste_per_ha_cents / 100).toFixed(2) : 'N/A';
      console.log(`   ${row.legal_name}: ${row.service_type} (€${ratePerHa}/ha, attivo: ${row.is_active})`);
    });

    await client.end();
  } catch (error) {
    console.error('❌ Errore:', error);
    await client.end();
    process.exit(1);
  }
}

checkCertifiedOrgs();
