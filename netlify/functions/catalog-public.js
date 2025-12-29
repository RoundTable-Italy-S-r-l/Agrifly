const { Client } = require('pg');

console.log('🔧 Catalog Public Function loaded');

const client = new Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false }
});

exports.handler = async (event, context) => {
  console.log('🌐 Catalog Public - Request received:', {
    method: event.httpMethod,
    path: event.path,
    query: event.queryStringParameters
  });

  if (event.httpMethod !== 'GET') {
    console.log('❌ Method not allowed:', event.httpMethod);
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Database connected')');

    const category = event.queryStringParameters?.category;
    const minPrice = event.queryStringParameters?.minPrice ? parseInt(event.queryStringParameters.minPrice) : null;
    const maxPrice = event.queryStringParameters?.maxPrice ? parseInt(event.queryStringParameters.maxPrice) : null;

    console.log('🔍 Query parameters:', { category, minPrice, maxPrice });

    // Query principale per prodotti
    let querySql = `
      SELECT DISTINCT
        p.id as product_id,
        p.name as product_name,
        p.brand,
        p.model,
        p.product_type,
        p.specs_json,
        p.specs_core_json,
        p.images_json,
        p.glb_files_json,
        COALESCE(
          (
            SELECT a."productId" as productId
            FROM assets a
            JOIN skus s_asset ON a.sku_id = s_asset.id
            WHERE s_asset.product_id = p.id
              AND a.asset_status = 'AVAILABLE'
            LIMIT 1
          ),
          p.id
        ) as productId,
        -- Contquanti vendor vendono questo prodotto con stock > 0
        (
          SELECT COUNT(DISTINCT vci.vendor_org_id)
          FROM vendor_catalog_items vci
          JOIN skus s2 ON vci.sku_id = s2.id
          LEFT JOIN inventories i2 ON vci.sku_id = i2.sku_id AND i2.vendor_org_id = vci.vendor_org_id
          WHERE s2.product_id = p.id
            AND vci.is_for_sale = 1
            AND (COALESCE(i2.qty_on_hand, 0) - COALESCE(i2.qty_reserved, 0)) > 0
        ) as vendor_count,
        -- Prezzo minimo tra tutti i vendor
        (
          SELECT MIN(pli.price_cents / 100.0)
          FROM price_list_items pli
          JOIN price_lists pl ON pli.price_list_id = pl.id
          JOIN skus s_price ON pli.sku_id = s_price.id
          JOIN vendor_catalog_items vci_price ON vci_price.sku_id = s_price.id AND vci_price.vendor_org_id = pl.vendor_org_id
          LEFT JOIN inventories i_price ON vci_price.sku_id = i_price.sku_id AND i_price.vendor_org_id = vci_price.vendor_org_id
          WHERE s_price.product_id = p.id
            AND pl.status = 'ACTIVE'
            AND pl.valid_from <= NOW()
            AND (pl.valid_to IS NULL OR pl.valid_to >= NOW())
            AND vci_price.is_for_sale = 1
            AND (COALESCE(i_price.qty_on_hand, 0) - COALESCE(i_price.qty_reserved, 0)) > 0
        ) as min_price_euros,
        -- Stock totale disponibile
        (
          SELECT COALESCE(SUM(i_total.qty_on_hand - COALESCE(i_total.qty_reserved, 0)), 0)
          FROM vendor_catalog_items vci_total
          JOIN skus s_total ON vci_total.sku_id = s_total.id
          LEFT JOIN inventories i_total ON vci_total.sku_id = i_total.sku_id AND i_total.vendor_org_id = vci_total.vendor_org_id
          WHERE s_total.product_id = p.id
            AND vci_total.is_for_sale = 1
        ) as total_stock
      FROM products p
      WHERE p.status = 'ACTIVE'
    `;

    const params = [];
    let paramIndex = 1;

    if (category) {
      querySql += ` AND p.product_type = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    querySql += ` ORDER BY p.brand, p.model`;

    console.log('🔍 Executing query:', querySql.substring(0, 100) + '...');
    console.log('🔍 Parameters:', params);

    const result = await client.query(querySql, params);
    console.log(`📦 Query result: ${result.rows.length} products found`);

    if (result.rows.length > 0) {
      console.log('📦 First product:', {
        id: result.rows[0].product_id,
        name: result.rows[0].product_name,
        brand: result.rows[0].brand,
        type: result.rows[0].product_type
      });
    }

    // Processa risultati
    const products = result.rows.map(row => {
      console.log('🔄 Processing product:', row.product_id, row.product_name);

      // Estrai GLB URL
      let glbUrl;
      let imageUrl;

      // GLB
      if (row.glb_files_json) {
        try {
          const glbFiles = typeof row.glb_files_json === 'string' 
            ? JSON.parse(row.glb_files_json) 
            : row.glb_files_json;
          if (Array.isArray(&& glbFiles.length > 0) {
            const firstGlb = glbFiles[0];
            let rawUrl = firstGlb.url || firstGlb.filename || firstGlb;
            if (typeof rawUrl === 'string' && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))) {
              glbUrl = rawUrl;
            }
          }
        } catch (e) {
          console.warn('Errore parsing glb_files_json:', e);
        }
      }

      // Immagini
      if (row.images_json) {
        try {
          const images = typeof row.images_json === 'string' 
            ? JSON.parse(row.images_json) 
            : row.images_json;
          if (Array.isArray(images) && images.length > 0) {
            const firstImage = images[0];
            let rawUrl = firstImage.url || firstImage.filename || firstImage;
            if (typeof rawUrl === 'string' && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))) {
              imageUrl = rawUrl;
            }
          }
        } catch (e) {
          console.warn('Errore parsing images_json:', e);
        }
      }

      const vendorCount = parseInt(row.vendor_count) || 0;
      const minPrice = row.min_price_euros ? parseFloat(row.min_price_euros) : null;
      const totalStock = parseInt(row.total_stock) || 0;

      return {
        id: row.product_id,
        productId: row.productid || row.productId || row.product_id,
        name: row.product_name,
        model: row.model,
        brand: row.brand,
        category: row.product_type,
        imageUrl,
        glbUrl,
        description: `${row.brand} ${row.model} - ${row.product_name}`,
        specs: row.specs_json,
        specsCore: row.specs_core_json,
        vendorCount,
        price: minPrice,
        stock: totalStock
      };
    });

    console.log(`✅ Returning ${products.length} products`);

    await client.end();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products })
    };

  } catch (error) {
    console.error('❌ Catalog erro error);
    console.error('❌ Stack:', error.stack);

    try {
      await client.end();
    } catch (e) {
      // Ignora errori di chiusura
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack?.split('\n').slice(0, 5) : undefined
      })
    };
  }
};
