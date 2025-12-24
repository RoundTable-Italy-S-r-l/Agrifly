import { Hono } from 'hono';
import { query } from '../utils/database';

const app = new Hono();

// ============================================================================
// GET VENDOR CATALOG
// ============================================================================

app.get('/vendor/:orgId', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    
    console.log('📦 Richiesta catalogo vendor per org:', orgId);

    // Query per ottenere catalogo vendor con prodotti, SKU, prezzi e stock
    const catalogResult = await query(`
      SELECT 
        vci.id,
        vci.sku_id,
        vci.is_for_sale,
        vci.is_for_rent,
        vci.lead_time_days,
        vci.notes,
        s.sku_code,
        s.variant_tags,
        p.id as product_id,
        p.name as product_name,
        p.brand,
        p.model,
        p.product_type,
        p.specs_json,
        p.images_json,
        COALESCE(SUM(i.qty_on_hand), 0) as total_stock,
        COALESCE(SUM(i.qty_reserved), 0) as total_reserved
      FROM vendor_catalog_items vci
      JOIN skus s ON vci.sku_id = s.id
      JOIN products p ON s.product_id = p.id
      LEFT JOIN inventories i ON vci.sku_id = i.sku_id AND i.vendor_org_id = $1
      WHERE vci.vendor_org_id = $1
      GROUP BY vci.id, vci.sku_id, vci.is_for_sale, vci.is_for_rent, 
               vci.lead_time_days, vci.notes, s.sku_code, s.variant_tags,
               p.id, p.name, p.brand, p.model, p.product_type, p.specs_json, p.images_json
      ORDER BY p.brand, p.model, s.sku_code
    `, [orgId]);

    const catalog = catalogResult.rows.map(row => {
      const totalStock = parseInt(row.total_stock) || 0;
      const totalReserved = parseInt(row.total_reserved) || 0;
      const available = totalStock - totalReserved;
      
      return {
        id: row.id,
        skuId: row.sku_id,
        skuCode: row.sku_code,
        variantTags: row.variant_tags || [],
        productId: row.product_id,
        productName: row.product_name,
        brand: row.brand,
        model: row.model,
        productType: row.product_type,
        specs: row.specs_json,
        images: row.images_json,
        isForSale: row.is_for_sale,
        isForRent: row.is_for_rent,
        leadTimeDays: row.lead_time_days,
        notes: row.notes,
        stock: available, // Numero disponibile (per compatibilità frontend)
        stockDetails: { // Dettagli opzionali per uso futuro
          total: totalStock,
          reserved: totalReserved,
          available: available
        }
      };
    });

    console.log(`✅ Catalogo vendor trovato: ${catalog.length} prodotti`);

    return c.json({ catalog });

  } catch (error: any) {
    console.error('Errore get vendor catalog:', error);
    return c.json({ error: 'Errore interno', message: error.message }, 500);
  }
});

// ============================================================================
// GET PUBLIC CATALOG (Aggregato da tutti i vendor)
// ============================================================================

app.get('/public', async (c) => {
  try {
    const category = c.req.query('category');
    const vendorId = c.req.query('vendor');
    const minPrice = c.req.query('minPrice') ? parseInt(c.req.query('minPrice')!) : null;
    const maxPrice = c.req.query('maxPrice') ? parseInt(c.req.query('maxPrice')!) : null;

    console.log('🌐 Richiesta catalogo pubblico', { category, vendorId, minPrice, maxPrice });

    // Query per ottenere tutti i prodotti dei vendor con prezzi e stock
    // Include solo prodotti con is_for_sale = true e stock disponibile
    let querySql = `
      SELECT 
        o.id as vendor_id,
        o.legal_name as vendor_name,
        o.description as vendor_description,
        vci.id as catalog_item_id,
        vci.sku_id,
        vci.is_for_sale,
        vci.is_for_rent,
        vci.lead_time_days,
        vci.notes as vendor_notes,
        s.sku_code,
        p.id as product_id,
        p.name as product_name,
        p.brand,
        p.model,
        p.product_type,
        p.description as product_description,
        p.specs_json,
        p.images_json,
        COALESCE(SUM(i.qty_on_hand), 0) - COALESCE(SUM(i.qty_reserved), 0) as available_stock,
        -- Prezzo dalla price list attiva più recente
        (
          SELECT pli.price_cents / 100.0
          FROM price_list_items pli
          JOIN price_lists pl ON pli.price_list_id = pl.id
          WHERE pli.sku_id = s.id
            AND pl.vendor_org_id = o.id
            AND pl.status = 'ACTIVE'
            AND pl.valid_from <= NOW()
            AND (pl.valid_to IS NULL OR pl.valid_to >= NOW())
          ORDER BY pl.valid_from DESC
          LIMIT 1
        ) as price_euros,
        (
          SELECT pl.currency
          FROM price_list_items pli
          JOIN price_lists pl ON pli.price_list_id = pl.id
          WHERE pli.sku_id = s.id
            AND pl.vendor_org_id = o.id
            AND pl.status = 'ACTIVE'
            AND pl.valid_from <= NOW()
            AND (pl.valid_to IS NULL OR pl.valid_to >= NOW())
          ORDER BY pl.valid_from DESC
          LIMIT 1
        ) as currency
      FROM vendor_catalog_items vci
      JOIN organizations o ON vci.vendor_org_id = o.id
      JOIN skus s ON vci.sku_id = s.id
      JOIN products p ON s.product_id = p.id
      LEFT JOIN inventories i ON vci.sku_id = i.sku_id AND i.vendor_org_id = o.id
      WHERE o.org_type = 'VENDOR'
        AND o.status = 'ACTIVE'
        AND vci.is_for_sale = true
        AND s.status = 'ACTIVE'
        AND p.status = 'ACTIVE'
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Filtri
    if (category) {
      querySql += ` AND p.product_type = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (vendorId) {
      querySql += ` AND o.id = $${paramIndex}`;
      params.push(vendorId);
      paramIndex++;
    }

    querySql += `
      GROUP BY o.id, o.legal_name, o.description, vci.id, vci.sku_id, vci.is_for_sale, 
               vci.is_for_rent, vci.lead_time_days, vci.notes, s.sku_code, p.id, 
               p.name, p.brand, p.model, p.product_type, p.description, p.specs_json, p.images_json
      HAVING COALESCE(SUM(i.qty_on_hand), 0) - COALESCE(SUM(i.qty_reserved), 0) > 0
    `;

    // Filtro prezzo (dopo GROUP BY)
    if (minPrice !== null) {
      querySql += ` AND (
        SELECT pli.price_cents / 100.0
        FROM price_list_items pli
        JOIN price_lists pl ON pli.price_list_id = pl.id
        WHERE pli.sku_id = s.id
          AND pl.vendor_org_id = o.id
          AND pl.status = 'ACTIVE'
          AND pl.valid_from <= NOW()
          AND (pl.valid_to IS NULL OR pl.valid_to >= NOW())
        ORDER BY pl.valid_from DESC
        LIMIT 1
      ) >= $${paramIndex}`;
      params.push(minPrice);
      paramIndex++;
    }

    if (maxPrice !== null) {
      querySql += ` AND (
        SELECT pli.price_cents / 100.0
        FROM price_list_items pli
        JOIN price_lists pl ON pli.price_list_id = pl.id
        WHERE pli.sku_id = s.id
          AND pl.vendor_org_id = o.id
          AND pl.status = 'ACTIVE'
          AND pl.valid_from <= NOW()
          AND (pl.valid_to IS NULL OR pl.valid_to >= NOW())
        ORDER BY pl.valid_from DESC
        LIMIT 1
      ) <= $${paramIndex}`;
      params.push(maxPrice);
      paramIndex++;
    }

    querySql += ` ORDER BY o.legal_name, p.brand, p.model, s.sku_code`;

    const result = await query(querySql, params);

    console.log(`📦 Prodotti trovati nel catalogo pubblico: ${result.rows.length}`);

    // Raggruppa per vendor
    const vendorsMap = new Map<string, any>();

    result.rows.forEach(row => {
      const vendorId = row.vendor_id;
      
      if (!vendorsMap.has(vendorId)) {
        vendorsMap.set(vendorId, {
          id: vendorId,
          name: row.vendor_name,
          logo: '', // TODO: aggiungere logo quando disponibile
          description: row.vendor_description || '',
          products: []
        });
      }

      const vendor = vendorsMap.get(vendorId)!;
      
      // Estrai prima immagine da images_json
      let imageUrl: string | undefined;
      let glbUrl: string | undefined;
      if (row.images_json) {
        try {
          const images = typeof row.images_json === 'string' 
            ? JSON.parse(row.images_json) 
            : row.images_json;
          if (Array.isArray(images) && images.length > 0) {
            imageUrl = images[0].url || images[0];
            glbUrl = images.find((img: any) => img.type === 'glb' || img.url?.endsWith('.glb'))?.url;
          }
        } catch (e) {
          console.warn('Errore parsing images_json:', e);
        }
      }

      vendor.products.push({
        id: row.catalog_item_id, // Usa catalog_item_id come ID univoco
        skuCode: row.sku_code,
        name: row.product_name,
        model: row.model,
        brand: row.brand,
        category: row.product_type,
        price: row.price_euros || 0,
        currency: row.currency || 'EUR',
        stock: parseInt(row.available_stock) || 0,
        leadTimeDays: row.lead_time_days || null,
        imageUrl,
        glbUrl,
        description: row.product_description || '',
        specs: row.specs_json,
        vendorNotes: row.vendor_notes
      });
    });

    const vendors = Array.from(vendorsMap.values());

    console.log(`✅ Catalogo pubblico: ${vendors.length} vendor, ${result.rows.length} prodotti totali`);

    return c.json({ vendors });

  } catch (error: any) {
    console.error('❌ Errore get public catalog:', error);
    console.error('Stack:', error.stack);
    return c.json({ 
      error: 'Errore interno', 
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack?.split('\n').slice(0, 5) : undefined
    }, 500);
  }
});

export default app;
