require('dotenv').config();
const { Client } = require('pg');

(async () => {
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
    console.log('✅ Connesso al database');
    
    // Leggi tutti i prodotti con specs_core_json e purpose
    const products = await client.query(`
      SELECT 
        p.id,
        p.name,
        p.specs_core_json,
        array_agg(pp.purpose) as purposes
      FROM products p
      LEFT JOIN product_purposes pp ON p.id = pp.product_id
      WHERE p.specs_core_json IS NOT NULL
        AND p.status = 'ACTIVE'
      GROUP BY p.id, p.name, p.specs_core_json
      ORDER BY p.name
    `);
    
    console.log(`\n📋 Analizzando ${products.rows.length} prodotti...\n`);
    
    // Analizza tutte le specs per identificare cluster e campi
    const allSpecs = {};
    const fieldVariants = {}; // Mappa varianti -> campo normalizzato
    
    products.rows.forEach(product => {
      try {
        const specs = typeof product.specs_core_json === 'string' 
          ? JSON.parse(product.specs_core_json)
          : product.specs_core_json;
        
        if (!Array.isArray(specs)) return;
        
        specs.forEach(spec => {
          const key = spec.key || spec.name || '';
          const section = spec.section || 'Altro';
          const value = spec.value || '';
          const unit = spec.unit || '';
          
          // Normalizza chiave (rimuovi varianti)
          const normalizedKey = key.toLowerCase()
            .replace(/peso massimo al decollo per (spandimento|irrorazione|lo spandimento)/gi, 'peso_massimo_decollo')
            .replace(/raggio massimo di volo|massimo raggio di volo configurabile/gi, 'raggio_max_volo')
            .replace(/temperatura operativa (minima|massima)/gi, 'temperatura_operativa')
            .replace(/resistenza massima al vento|massima resistenza al vento/gi, 'resistenza_vento')
            .replace(/capacità serbatoio di (irrorazione|spandimento)/gi, 'capacita_serbatoio')
            .replace(/carico massimo per (irrorazione|spandimento)/gi, 'carico_max')
            .replace(/larghezza effettiva di (irrorazione|spandimento)|larghezza (dello spruzzo efficace|di spandimento effettiva)/gi, 'larghezza_effettiva')
            .replace(/peso batteria|peso/gi, 'peso_batteria')
            .replace(/capacità batteria|capacità/gi, 'capacita_batteria')
            .replace(/tempo di ricarica|tempo di ricarica\[6\]/gi, 'tempo_ricarica')
            .replace(/consumo carburante generatore|consumo di carburante di riferimento/gi, 'consumo_carburante')
            .replace(/portata rilevamento radar|portata\[4\]/gi, 'portata_radar')
            .replace(/[^\w]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
          
          if (!allSpecs[section]) {
            allSpecs[section] = {};
          }
          
          if (!allSpecs[section][normalizedKey]) {
            allSpecs[section][normalizedKey] = {
              variants: new Set(),
              units: new Set(),
              examples: []
            };
          }
          
          allSpecs[section][normalizedKey].variants.add(key);
          if (unit) allSpecs[section][normalizedKey].units.add(unit);
          if (allSpecs[section][normalizedKey].examples.length < 3) {
            allSpecs[section][normalizedKey].examples.push({ key, value, unit, product: product.name });
          }
        });
      } catch (error) {
        console.log(`⚠️  Errore parsing specs per ${product.name}:`, error.message);
      }
    });
    
    // Stampa cluster identificati
    console.log('📊 CLUSTER IDENTIFICATI:\n');
    Object.keys(allSpecs).sort().forEach(section => {
      console.log(`\n🔹 ${section.toUpperCase()}`);
      Object.entries(allSpecs[section]).forEach(([normalizedKey, data]) => {
        console.log(`  ${normalizedKey}:`);
        console.log(`    Varianti: ${Array.from(data.variants).join(', ')}`);
        console.log(`    Unità: ${Array.from(data.units).join(', ')}`);
        console.log(`    Esempi: ${data.examples.map(e => `${e.product}: ${e.value} ${e.unit}`).join('; ')}`);
      });
    });
    
    // Identifica i 5-6 cluster principali
    const mainClusters = {
      'Velivolo': ['peso_massimo_decollo', 'raggio_max_volo', 'temperatura_operativa', 'resistenza_vento'],
      'Sistema Irrorazione': ['capacita_serbatoio', 'carico_max', 'larghezza_effettiva'],
      'Sistema Spandimento': ['capacita_serbatoio', 'carico_max', 'larghezza_effettiva'],
      'Batteria': ['peso_batteria', 'capacita_batteria'],
      'Caricatore': ['tempo_ricarica'],
      'Generatore': ['consumo_carburante'],
      'Radar': ['portata_radar']
    };
    
    console.log('\n\n🎯 CLUSTER PRINCIPALI PROPOSTI:\n');
    Object.entries(mainClusters).forEach(([cluster, fields]) => {
      console.log(`  ${cluster}: ${fields.join(', ')}`);
    });
    
    await client.end();
  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();

