const { Client } = require('pg');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.replace(/"/g, '');
  }
});

const client = new Client({
  host: envVars.PGHOST,
  port: envVars.PGPORT,
  database: envVars.PGDATABASE,
  user: envVars.PGUSER,
  password: envVars.PGPASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function checkLenziInventory() {
  try {
    await client.connect();
    console.log('🔍 Analisi dettagliata inventario Lenzi...\n');

    // Prima trova l'organizzazione Lenzi
    const lenziOrg = await client.query('SELECT id, legal_name, org_type FROM organizations WHERE legal_name ILIKE \'%lenzi%\' ORDER BY legal_name');
    console.log('🏢 Organizzazioni Lenzi trovate:');
    lenziOrg.rows.forEach(org => {
      console.log(`  - ${org.legal_name} (${org.org_type}) - ID: ${org.id}`);
    });

    if (lenziOrg.rows.length === 0) {
      console.log('❌ Nessuna organizzazione Lenzi trovata');
      return;
    }

    const lenziId = lenziOrg.rows[0].id;
    console.log(`\n📋 Usando organizzazione: ${lenziOrg.rows[0].legal_name} (ID: ${lenziId})\n`);

    // Controlla vendor_catalog_items
    const catalogItems = await client.query('SELECT COUNT(*) as count FROM vendor_catalog_items WHERE vendor_org_id = $1', [lenziId]);
    console.log(`📦 Vendor catalog items: ${catalogItems.rows[0].count}`);

    // Controlla inventories
    const inventories = await client.query('SELECT COUNT(*) as count, SUM(qty_on_hand) as total_stock FROM inventories WHERE vendor_org_id = $1', [lenziId]);
    console.log(`📊 Inventory records: ${inventories.rows[0].count}`);
    console.log(`📈 Total stock: ${inventories.rows[0].total_stock || 0}`);

    // Lista dettagliata degli inventory items se esistono
    if (parseInt(inventories.rows[0].count) > 0) {
      const inventoryDetails = await client.query(`
        SELECT
          i.sku_id,
          s.sku_code,
          p.name as product_name,
          p.brand,
          p.model,
          SUM(i.qty_on_hand) as qty_on_hand,
          SUM(i.qty_reserved) as qty_reserved,
          SUM(i.qty_on_hand) - SUM(i.qty_reserved) as qty_available
        FROM inventories i
        JOIN skus s ON i.sku_id = s.id
        JOIN products p ON s.product_id = p.id
        WHERE i.vendor_org_id = $1
        GROUP BY i.sku_id, s.sku_code, p.name, p.brand, p.model
        ORDER BY p.name
      `, [lenziId]);

      console.log('\n📋 Dettagli inventario:');
      inventoryDetails.rows.forEach(item => {
        console.log(`  - ${item.product_name} (${item.brand} ${item.model})`);
        console.log(`    SKU: ${item.sku_code}`);
        console.log(`    Disponibile: ${item.qty_available}, Riservato: ${item.qty_reserved}, Totale: ${item.qty_on_hand}`);
        console.log('');
      });
    }

    // Controlla se ci sono prodotti associati direttamente
    const products = await client.query('SELECT COUNT(*) as count FROM products WHERE name ILIKE \'%lenzi%\' OR brand ILIKE \'%lenzi%\'');
    console.log(`🏷️  Prodotti con marchio Lenzi: ${products.rows[0].count}`);

    // Controlla assets associati a Lenzi
    const assets = await client.query('SELECT COUNT(*) as count FROM assets WHERE owning_org_id = $1', [lenziId]);
    console.log(`🚁 Assets di proprietà Lenzi: ${assets.rows[0].count}`);

    if (parseInt(assets.rows[0].count) > 0) {
      const assetDetails = await client.query(`
        SELECT a.serial_number, p.name, p.brand, p.model, a.asset_status
        FROM assets a
        JOIN skus s ON a.sku_id = s.id
        JOIN products p ON s.product_id = p.id
        WHERE a.owning_org_id = $1
        ORDER BY p.name
      `, [lenziId]);

      console.log('\n🚁 Assets Lenzi:');
      assetDetails.rows.forEach(asset => {
        console.log(`  - ${asset.name} (${asset.brand} ${asset.model})`);
        console.log(`    Serial: ${asset.serial_number}, Status: ${asset.asset_status}`);
        console.log('');
      });
    }

  } catch (err) {
    console.error('❌ Errore:', err.message);
  } finally {
    await client.end();
  }
}

checkLenziInventory();
