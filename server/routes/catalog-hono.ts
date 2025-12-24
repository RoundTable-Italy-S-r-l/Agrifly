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

// Placeholder per altre route catalog
app.get('/public', (c) => c.json({ message: 'Public catalog - da implementare' }));

export default app;
