const { Client } = require('pg');

const client = new Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false }
});

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('🌐 Catalog Public - Request received');
    console.log('🔧 Environment check:');
    console.log('  PGHOST:', process.env.PGHOST ? 'present' : 'MISSING');
    console.log('  PGUSER:', process.env.PGUSER ? 'present' : 'MISSING');
    console.log('  PGPASSWORD:', process.env.PGPASSWORD ? 'present' : 'MISSING');
    console.log('  PGDATABASE:', process.env.PGDATABASE ? 'present' : 'MISSING');

    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Database connected successfully');

    const category = event.queryStringParameters?.category;
    const minPrice = event.queryStringParameters?.minPrice ? parseInt(event.queryStringParameters.minPrice) : null;
    const maxPrice = event.yStringParameters?.maxPrice ? parseInt(event.queryStringParameters.maxPrice) : null;

    console.log('🔍 Query parameters:', { category, minPrice, maxPrice });

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
        (
          SELECT COUNT(DISTINCT vci.vendor_org_id)
          FROM vendor_catalog_items vci
          JOIN skus s2 ON vci.sku_id = s2.id
          LEFT JOIN inventories i2 ON vci.sku_id = i2.sku_id AND i2.vendor_org_id = vci.vendor_org_id
          WHERE s2.product_id = id
            AND vci.is_for_sale = 1
            AND (COALESCE(i2.qty_on_hand, 0) - COALESCE(i2.qty_reserved, 0)) > 0
        ) as vendor_count,
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

    console.log('🔍 Executing query...');
    console.log('  Query length:', querySql.length);
    console.log('  Params count:', params.length);

    try {
      const result = await client.query(querySql, params);
      console.log(`📦 Query successful - Found ${result.rows.length} products`);
    } catch (queryError) {
      console.error('❌ Query failed:', queryError.message);
      console.error('❌ Query:', querySql.substring(0, 200) + '...');
      console.error('❌ Params:', params);
      throw queryError;
    }

    const products = result.rows.map(row => ({
      id: row.product_id,
      productId: row.productid || row.productId || row.product_id,
      name: row.product_name,
      model: row.model,
     nd: row.brand,
      category: row.product_type,
      imageUrl: null,
      glbUrl: null,
      description: `${row.brand} ${row.model} - ${row.product_name}`,
      specs: row.specs_json,
      specsCore: row.specs_core_json,
      vendorCount: parseInt(row.vendor_count) || 0,
      price: row.min_price_euros ? parseFloat(row.min_price_euros) : null,
      stock: parseInt(row.total_stock) || 0
    }));

    console.log(`✅ Returning ${products.length} products`);

    await client.end();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products })
    };

  } catch (error) {
    console.error('❌ Catalog error:', error.message);
    
    try {
      await client.end();
    } catch (e) {}
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};
