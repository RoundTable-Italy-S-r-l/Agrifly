const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function listOrganizations() {
  try {
    console.log('🔗 Connessione a Supabase...');
    await client.connect();
    console.log('✅ Connesso a Supabase\n');

    const orgs = await client.query(`
      SELECT 
        o.id,
        o.legal_name,
        o.is_certified,
        o.can_operate,
        o.status,
        o.kind,
        COUNT(DISTINCT rc.id) as rate_cards_count,
        COUNT(DISTINCT sc.id) as service_configs_count
      FROM organizations o
      LEFT JOIN rate_cards rc ON rc.seller_org_id = o.id
      LEFT JOIN service_configurations sc ON sc.org_id = o.id
      GROUP BY o.id, o.legal_name, o.is_certified, o.can_operate, o.status, o.kind
      ORDER BY o.legal_name
    `);

    console.log(`📊 Organizzazioni nel database:`);
    console.log(`   Trovate: ${orgs.rows.length}\n`);

    if (orgs.rows.length === 0) {
      console.log('   ⚠️  Nessuna organizzazione trovata\n');
    } else {
      orgs.rows.forEach((org, index) => {
        console.log(`   ${index + 1}. ${org.legal_name}`);
        console.log(`      ID: ${org.id}`);
        console.log(`      Tipo: ${org.kind || 'N/A'}`);
        console.log(`      Certificata: ${org.is_certified ? '✅' : '❌'}`);
        console.log(`      Può operare: ${org.can_operate ? '✅' : '❌'}`);
        console.log(`      Status: ${org.status}`);
        console.log(`      Rate Cards: ${org.rate_cards_count}`);
        console.log(`      Service Configs: ${org.service_configs_count}`);
        console.log('');
      });
    }

    await client.end();
  } catch (error) {
    console.error('❌ Errore durante la verifica:', error);
    await client.end();
    process.exit(1);
  }
}

listOrganizations();

