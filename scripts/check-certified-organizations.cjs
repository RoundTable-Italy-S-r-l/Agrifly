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

async function checkCertifiedOrganizations() {
  try {
    console.log('🔗 Connessione a Supabase...');
    await client.connect();
    console.log('✅ Connesso a Supabase\n');

    // Verifica se la colonna is_certified esiste
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'organizations' 
      AND column_name = 'is_certified'
    `);

    if (columnCheck.rows.length === 0) {
      console.log('❌ Colonna is_certified non trovata nella tabella organizations');
      await client.end();
      return;
    }

    console.log('📋 Verifica organizzazioni certificate con servizi configurati...\n');

    // Query per trovare organizzazioni certificate con rate cards
    const certifiedWithRateCards = await client.query(`
      SELECT DISTINCT
        o.id,
        o.legal_name,
        o.logo_url,
        o.is_certified,
        o.can_operate,
        o.status,
        COUNT(DISTINCT rc.id) as rate_cards_count,
        STRING_AGG(DISTINCT rc.service_type::text, ', ') as service_types
      FROM organizations o
      LEFT JOIN rate_cards rc ON rc.seller_org_id = o.id AND (rc.is_active = true OR rc.is_active IS NULL)
      WHERE o.is_certified = true
        AND o.can_operate = true
        AND o.status = 'ACTIVE'
      GROUP BY o.id, o.legal_name, o.logo_url, o.is_certified, o.can_operate, o.status
      ORDER BY o.legal_name
    `);

    console.log(`📊 Organizzazioni certificate con rate cards:`);
    console.log(`   Trovate: ${certifiedWithRateCards.rows.length}\n`);

    if (certifiedWithRateCards.rows.length === 0) {
      console.log('   ⚠️  Nessuna organizzazione certificata con rate cards trovata\n');
    } else {
      certifiedWithRateCards.rows.forEach((org, index) => {
        console.log(`   ${index + 1}. ${org.legal_name}`);
        console.log(`      ID: ${org.id}`);
        console.log(`      Logo: ${org.logo_url || 'N/A'}`);
        console.log(`      Certificata: ${org.is_certified ? '✅' : '❌'}`);
        console.log(`      Può operare: ${org.can_operate ? '✅' : '❌'}`);
        console.log(`      Status: ${org.status}`);
        console.log(`      Rate Cards: ${org.rate_cards_count}`);
        console.log(`      Servizi: ${org.service_types || 'Nessuno'}`);
        console.log('');
      });
    }

    // Query per trovare organizzazioni certificate con service configurations
    const certifiedWithServiceConfig = await client.query(`
      SELECT DISTINCT
        o.id,
        o.legal_name,
        o.logo_url,
        o.is_certified,
        o.can_operate,
        o.status,
        sc.base_location_lat,
        sc.base_location_lng,
        sc.service_tags
      FROM organizations o
      LEFT JOIN service_configurations sc ON sc.org_id = o.id
      WHERE o.is_certified = true
        AND o.can_operate = true
        AND o.status = 'ACTIVE'
        AND sc.id IS NOT NULL
      ORDER BY o.legal_name
    `);

    console.log(`📊 Organizzazioni certificate con service configurations:`);
    console.log(`   Trovate: ${certifiedWithServiceConfig.rows.length}\n`);

    if (certifiedWithServiceConfig.rows.length === 0) {
      console.log('   ⚠️  Nessuna organizzazione certificata con service configurations trovata\n');
    } else {
      certifiedWithServiceConfig.rows.forEach((org, index) => {
        console.log(`   ${index + 1}. ${org.legal_name}`);
        console.log(`      ID: ${org.id}`);
        console.log(`      Logo: ${org.logo_url || 'N/A'}`);
        console.log(`      Base Location: ${org.base_location_lat || 'N/A'}, ${org.base_location_lng || 'N/A'}`);
        console.log(`      Service Tags: ${org.service_tags || 'N/A'}`);
        console.log('');
      });
    }

    // Query combinata: organizzazioni certificate con rate cards E service configurations
    const certifiedComplete = await client.query(`
      SELECT DISTINCT
        o.id,
        o.legal_name,
        o.logo_url,
        o.is_certified,
        o.can_operate,
        o.status,
        COUNT(DISTINCT rc.id) as rate_cards_count,
        STRING_AGG(DISTINCT rc.service_type::text, ', ') as service_types,
        sc.base_location_lat,
        sc.base_location_lng,
        sc.service_tags
      FROM organizations o
      LEFT JOIN rate_cards rc ON rc.seller_org_id = o.id AND (rc.is_active = true OR rc.is_active IS NULL)
      LEFT JOIN service_configurations sc ON sc.org_id = o.id
      WHERE o.is_certified = true
        AND o.can_operate = true
        AND o.status = 'ACTIVE'
        AND rc.id IS NOT NULL
        AND sc.id IS NOT NULL
      GROUP BY o.id, o.legal_name, o.logo_url, o.is_certified, o.can_operate, o.status, 
               sc.base_location_lat, sc.base_location_lng, sc.service_tags
      ORDER BY o.legal_name
    `);

    console.log(`📊 Organizzazioni certificate COMPLETE (con rate cards E service configurations):`);
    console.log(`   Trovate: ${certifiedComplete.rows.length}\n`);

    if (certifiedComplete.rows.length === 0) {
      console.log('   ⚠️  Nessuna organizzazione certificata completa trovata\n');
      console.log('   💡 Per testare i preventivi immediati, serve almeno un\'organizzazione che abbia:');
      console.log('      - is_certified = true');
      console.log('      - can_operate = true');
      console.log('      - status = ACTIVE');
      console.log('      - Almeno una rate_card attiva');
      console.log('      - Una service_configuration con base_location');
    } else {
      certifiedComplete.rows.forEach((org, index) => {
        console.log(`   ${index + 1}. ${org.legal_name}`);
        console.log(`      ID: ${org.id}`);
        console.log(`      Logo: ${org.logo_url || 'N/A'}`);
        console.log(`      Rate Cards: ${org.rate_cards_count}`);
        console.log(`      Servizi: ${org.service_types || 'Nessuno'}`);
        console.log(`      Base Location: ${org.base_location_lat || 'N/A'}, ${org.base_location_lng || 'N/A'}`);
        console.log(`      Service Tags: ${org.service_tags || 'N/A'}`);
        console.log('');
      });
    }

    // Verifica tutte le organizzazioni certificate (anche senza servizi)
    const allCertified = await client.query(`
      SELECT 
        o.id,
        o.legal_name,
        o.is_certified,
        o.can_operate,
        o.status,
        COUNT(DISTINCT rc.id) as rate_cards_count,
        COUNT(DISTINCT sc.id) as service_configs_count
      FROM organizations o
      LEFT JOIN rate_cards rc ON rc.seller_org_id = o.id
      LEFT JOIN service_configurations sc ON sc.org_id = o.id
      WHERE o.is_certified = true
      GROUP BY o.id, o.legal_name, o.is_certified, o.can_operate, o.status
      ORDER BY o.legal_name
    `);

    console.log(`\n📊 Tutte le organizzazioni certificate:`);
    console.log(`   Trovate: ${allCertified.rows.length}\n`);

    if (allCertified.rows.length === 0) {
      console.log('   ⚠️  Nessuna organizzazione certificata trovata nel database\n');
    } else {
      allCertified.rows.forEach((org, index) => {
        const hasRateCards = parseInt(org.rate_cards_count) > 0;
        const hasServiceConfig = parseInt(org.service_configs_count) > 0;
        const canOperate = org.can_operate;
        const isActive = org.status === 'ACTIVE';
        
        const status = (canOperate && isActive && hasRateCards) ? '✅ PRONTA' : '⚠️  INCOMPLETA';
        
        console.log(`   ${index + 1}. ${org.legal_name} - ${status}`);
        console.log(`      ID: ${org.id}`);
        console.log(`      Certificata: ✅`);
        console.log(`      Può operare: ${canOperate ? '✅' : '❌'}`);
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

checkCertifiedOrganizations();

