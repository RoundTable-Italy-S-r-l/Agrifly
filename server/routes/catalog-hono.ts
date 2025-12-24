import { Hono } from 'hono';
import { query } from '../utils/database';
import { publicObjectUrl } from '../utils/storage';

const app = new Hono();

// ============================================================================
// TOGGLE PRODUCT (Attiva/Disattiva prodotto per vendita)
// Route specifica prima della route generica per evitare conflitti
// ============================================================================

app.post('/vendor/:orgId/toggle', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const { skuId, catalogItemId, isForSale } = await c.req.json();

    if (typeof isForSale !== 'boolean') {
      return c.json({ error: 'isForSale obbligatorio e deve essere boolean' }, 400);
    }

    // Accetta sia skuId che catalogItemId (per compatibilità frontend)
    // Il frontend potrebbe passare l'ID del catalog item come skuId
    let actualSkuId = skuId || catalogItemId;
    
    if (!actualSkuId) {
      return c.json({ error: 'skuId o catalogItemId obbligatorio' }, 400);
    }

    // Verifica se actualSkuId è uno sku_id valido
    const skuCheck = await query(`
      SELECT id FROM skus WHERE id = $1
    `, [actualSkuId]);

    if (skuCheck.rows.length === 0) {
      // Non è uno sku_id valido, prova a recuperarlo dal catalog item
      console.log('⚠️  Valore passato non è uno sku_id valido, provo a recuperarlo dal catalog item:', actualSkuId);
      const catalogItemResult = await query(`
        SELECT sku_id FROM vendor_catalog_items
        WHERE id = $1 AND vendor_org_id = $2
      `, [actualSkuId, orgId]);
      
      if (catalogItemResult.rows.length === 0) {
        return c.json({ error: 'Catalog item o sku non trovato' }, 404);
      }
      
      actualSkuId = catalogItemResult.rows[0].sku_id;
      console.log('🔄 Convertito catalog item ID a skuId:', { originalId: skuId || catalogItemId, actualSkuId });
    } else {
      console.log('✅ skuId valido:', actualSkuId);
    }

    console.log('🔄 Toggle prodotto:', { orgId, skuId: actualSkuId, isForSale });

    // Aggiorna is_for_sale nel vendor_catalog_items
    const result = await query(`
      UPDATE vendor_catalog_items
      SET is_for_sale = $1
      WHERE vendor_org_id = $2 AND sku_id = $3
      RETURNING id, is_for_sale, is_for_rent
    `, [isForSale, orgId, actualSkuId]);

    if (result.rows.length === 0) {
      return c.json({ error: 'Prodotto non trovato nel catalogo vendor' }, 404);
    }

    console.log('✅ Prodotto aggiornato:', result.rows[0]);

    return c.json({ 
      success: true,
      catalogItem: result.rows[0]
    });

  } catch (error: any) {
    console.error('❌ Errore toggle prodotto:', error);
    console.error('Stack:', error.stack);
    return c.json({ 
      error: 'Errore interno', 
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack?.split('\n').slice(0, 5) : undefined
    }, 500);
  }
});

// ============================================================================
// UPDATE PRODUCT (Aggiorna prezzo, lead time, notes, stock)
// Route specifica prima della route generica per evitare conflitti
// ============================================================================

app.put('/vendor/:orgId/product', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const body = await c.req.json();
    const { skuId, catalogItemId, price, leadTimeDays, notes, stock } = body;

    // Accetta sia skuId che catalogItemId (per compatibilità frontend)
    // Il frontend potrebbe passare l'ID del catalog item come skuId
    let actualSkuId = skuId || catalogItemId;
    
    if (!actualSkuId) {
      return c.json({ error: 'skuId o catalogItemId obbligatorio' }, 400);
    }

    // Verifica se actualSkuId è uno sku_id valido
    const skuCheck = await query(`
      SELECT id FROM skus WHERE id = $1
    `, [actualSkuId]);

    if (skuCheck.rows.length === 0) {
      // Non è uno sku_id valido, prova a recuperarlo dal catalog item
      console.log('⚠️  Valore passato non è uno sku_id valido, provo a recuperarlo dal catalog item:', actualSkuId);
      const catalogItemResult = await query(`
        SELECT sku_id FROM vendor_catalog_items
        WHERE id = $1 AND vendor_org_id = $2
      `, [actualSkuId, orgId]);
      
      if (catalogItemResult.rows.length === 0) {
        return c.json({ error: 'Catalog item o sku non trovato' }, 404);
      }
      
      actualSkuId = catalogItemResult.rows[0].sku_id;
      console.log('🔄 Convertito catalog item ID a skuId:', { originalId: skuId || catalogItemId, actualSkuId });
    } else {
      console.log('✅ skuId valido:', actualSkuId);
    }

    console.log('📝 Update prodotto:', { orgId, skuId: actualSkuId, price, leadTimeDays, notes, stock });

    // Aggiorna vendor_catalog_items
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (leadTimeDays !== undefined) {
      updates.push(`lead_time_days = $${paramIndex}`);
      params.push(leadTimeDays);
      paramIndex++;
    }

    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex}`);
      params.push(notes);
      paramIndex++;
    }

    if (updates.length > 0) {
      params.push(orgId, actualSkuId);
      const updateQuery = `
        UPDATE vendor_catalog_items
        SET ${updates.join(', ')}
        WHERE vendor_org_id = $${paramIndex} AND sku_id = $${paramIndex + 1}
        RETURNING id, lead_time_days, notes
      `;
      await query(updateQuery, params);
    }

    // Aggiorna prezzo nella price list attiva
    if (price !== undefined && price > 0) {
      // Trova price list attiva
      const priceListResult = await query(`
        SELECT id, currency
        FROM price_lists
        WHERE vendor_org_id = $1
          AND status = 'ACTIVE'
          AND valid_from <= NOW()
          AND (valid_to IS NULL OR valid_to >= NOW())
        ORDER BY valid_from DESC
        LIMIT 1
      `, [orgId]);

      if (priceListResult.rows.length > 0) {
        const priceListId = priceListResult.rows[0].id;
        const priceCents = Math.round(price * 100);

        // Upsert price list item
        await query(`
          INSERT INTO price_list_items (id, price_list_id, sku_id, price_cents)
          VALUES (gen_random_uuid(), $1, $2, $3)
          ON CONFLICT (price_list_id, sku_id) 
          DO UPDATE SET price_cents = $3
        `, [priceListId, actualSkuId, priceCents]);

        console.log('✅ Prezzo aggiornato nella price list');
      } else {
        console.warn('⚠️  Nessuna price list attiva trovata per aggiornare il prezzo');
      }
    }

    // Aggiorna stock (inventario)
    if (stock !== undefined) {
      // Trova location principale del vendor (o crea una default)
      let locationResult = await query(`
        SELECT id FROM locations
        WHERE org_id = $1
        LIMIT 1
      `, [orgId]);

      let locationId: string;

      if (locationResult.rows.length > 0) {
        locationId = locationResult.rows[0].id;
      } else {
        // Crea una location di default se non esiste
        console.log('📍 Creazione location di default per vendor:', orgId);
        const newLocationResult = await query(`
          INSERT INTO locations (id, org_id, name, address_json, is_hub)
          VALUES (gen_random_uuid(), $1, 'Magazzino Principale', '{}'::json, false)
          RETURNING id
        `, [orgId]);
        locationId = newLocationResult.rows[0].id;
        console.log('✅ Location di default creata:', locationId);
      }

      // Upsert inventory (usa il constraint UNIQUE corretto)
      await query(`
        INSERT INTO inventories (id, vendor_org_id, location_id, sku_id, qty_on_hand, qty_reserved)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, 0)
        ON CONFLICT (vendor_org_id, location_id, sku_id)
        DO UPDATE SET qty_on_hand = $4
      `, [orgId, locationId, actualSkuId, stock]);

      console.log('✅ Stock aggiornato:', { orgId, locationId, skuId: actualSkuId, stock });
    }

    return c.json({ 
      success: true,
      message: 'Prodotto aggiornato con successo'
    });

  } catch (error: any) {
    console.error('❌ Errore update prodotto:', error);
    console.error('Stack:', error.stack);
    return c.json({ 
      error: 'Errore interno', 
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack?.split('\n').slice(0, 5) : undefined
    }, 500);
  }
});

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
        p.glb_files_json,
        COALESCE(SUM(i.qty_on_hand), 0) as total_stock,
        COALESCE(SUM(i.qty_reserved), 0) as total_reserved,
        -- Prezzo dalla price list attiva più recente
        (
          SELECT pli.price_cents / 100.0
          FROM price_list_items pli
          JOIN price_lists pl ON pli.price_list_id = pl.id
          WHERE pli.sku_id = vci.sku_id
            AND pl.vendor_org_id = $1
            AND pl.status = 'ACTIVE'
            AND pl.valid_from <= NOW()
            AND (pl.valid_to IS NULL OR pl.valid_to >= NOW())
          ORDER BY pl.valid_from DESC
          LIMIT 1
        ) as price_euros
      FROM vendor_catalog_items vci
      JOIN skus s ON vci.sku_id = s.id
      JOIN products p ON s.product_id = p.id
      LEFT JOIN inventories i ON vci.sku_id = i.sku_id AND i.vendor_org_id = $1
      WHERE vci.vendor_org_id = $1
      GROUP BY vci.id, vci.sku_id, vci.is_for_sale, vci.is_for_rent, 
               vci.lead_time_days, vci.notes, s.sku_code, s.variant_tags,
               p.id, p.name, p.brand, p.model, p.product_type, p.specs_json, p.images_json, p.glb_files_json
      ORDER BY p.brand, p.model, s.sku_code
    `, [orgId]);

    const catalog = catalogResult.rows.map(row => {
      const totalStock = parseInt(row.total_stock) || 0;
      const totalReserved = parseInt(row.total_reserved) || 0;
      const available = totalStock - totalReserved;
      
      // Converti il prezzo da stringa a numero e arrotonda a 2 decimali
      const priceRaw = row.price_euros || null;
      const price = priceRaw ? (typeof priceRaw === 'string' ? parseFloat(priceRaw) : priceRaw) : null;
      const priceRounded = price ? Math.round(price * 100) / 100 : null;
      
      // Estrai GLB e immagini
      let imageUrl: string | undefined;
      let glbUrl: string | undefined;
      
      // Prima cerca GLB in glb_files_json
      if (row.glb_files_json) {
        try {
          const glbFiles = typeof row.glb_files_json === 'string' 
            ? JSON.parse(row.glb_files_json) 
            : row.glb_files_json;
          if (Array.isArray(glbFiles) && glbFiles.length > 0) {
            const firstGlb = glbFiles[0];
            let rawUrl = firstGlb.url || firstGlb.filename || firstGlb;
            
            // Se è un URL completo (http/https), usa direttamente
            if (typeof rawUrl === 'string' && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))) {
              glbUrl = rawUrl;
            } 
            // Se è un path relativo, costruisci URL Supabase Storage
            else if (typeof rawUrl === 'string') {
              try {
                glbUrl = publicObjectUrl('assets', rawUrl);
              } catch (e) {
                console.warn('Errore costruzione URL Supabase Storage:', e);
                glbUrl = undefined; // Non usare path locale su Netlify
              }
            }
          }
        } catch (e) {
          console.warn('Errore parsing glb_files_json:', e);
        }
      }
      
      // Poi cerca immagini in images_json come fallback
      if (row.images_json) {
        try {
          const images = typeof row.images_json === 'string' 
            ? JSON.parse(row.images_json) 
            : row.images_json;
          if (Array.isArray(images) && images.length > 0) {
            const normalImage = images.find((img: any) => 
              img.type !== 'glb' && !img.url?.endsWith('.glb')
            );
            if (normalImage) {
              imageUrl = normalImage.url || normalImage;
            } else if (images[0]) {
              imageUrl = images[0].url || images[0];
            }
          }
        } catch (e) {
          console.warn('Errore parsing images_json:', e);
        }
      }
      
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
        isActive: row.is_for_sale, // Alias per compatibilità frontend
        leadTimeDays: row.lead_time_days,
        notes: row.notes,
        price: priceRounded, // Prezzo arrotondato a 2 decimali
        stock: available, // Numero disponibile (per compatibilità frontend)
        stockDetails: { // Dettagli opzionali per uso futuro
          total: totalStock,
          reserved: totalReserved,
          available: available
        },
        imageUrl,
        glbUrl
      };
    });

    console.log(`✅ Catalogo vendor trovato: ${catalog.length} prodotti`);

    return c.json({ catalog });

  } catch (error: any) {
    console.error('Errore get vendor catalog:', error);
    console.error('Stack:', error.stack);
    return c.json({ 
      error: 'Errore interno', 
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack?.split('\n').slice(0, 5) : undefined
    }, 500);
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
    // Usa CTE per evitare problemi con subquery e GROUP BY
    let querySql = `
      WITH catalog_base AS (
        SELECT 
          o.id as vendor_id,
          o.legal_name as vendor_name,
          vci.id as catalog_item_id,
          vci.sku_id,
          vci.is_for_sale,
          vci.is_for_rent,
          vci.lead_time_days,
          vci.notes as vendor_notes,
          s.id as sku_table_id,
          s.sku_code,
          p.id as product_id,
          p.name as product_name,
          p.brand,
          p.model,
          p.product_type,
          p.specs_json,
          p.images_json,
          p.glb_files_json,
          COALESCE(SUM(i.qty_on_hand), 0) - COALESCE(SUM(i.qty_reserved), 0) as available_stock
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
        GROUP BY o.id, o.legal_name, vci.id, vci.sku_id, vci.is_for_sale, 
                 vci.is_for_rent, vci.lead_time_days, vci.notes, s.id, s.sku_code, p.id, 
                 p.name, p.brand, p.model, p.product_type, p.specs_json, p.images_json
      )
      SELECT 
        cb.*,
        -- Prezzo dalla price list attiva più recente
        (
          SELECT pli.price_cents / 100.0
          FROM price_list_items pli
          JOIN price_lists pl ON pli.price_list_id = pl.id
          WHERE pli.sku_id = cb.sku_table_id
            AND pl.vendor_org_id = cb.vendor_id
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
          WHERE pli.sku_id = cb.sku_table_id
            AND pl.vendor_org_id = cb.vendor_id
            AND pl.status = 'ACTIVE'
            AND pl.valid_from <= NOW()
            AND (pl.valid_to IS NULL OR pl.valid_to >= NOW())
          ORDER BY pl.valid_from DESC
          LIMIT 1
        ) as currency
      FROM catalog_base cb
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Filtri (applicati alla CTE)
    if (category) {
      querySql += ` AND cb.product_type = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (vendorId) {
      querySql += ` AND cb.vendor_id = $${paramIndex}`;
      params.push(vendorId);
      paramIndex++;
    }

    querySql += ` ORDER BY cb.vendor_name, cb.brand, cb.model, cb.sku_code`;

    const result = await query(querySql, params);

    console.log(`📦 Prodotti trovati nel catalogo pubblico: ${result.rows.length}`);

    // Raggruppa per vendor e applica filtri prezzo
    const vendorsMap = new Map<string, any>();

    result.rows.forEach(row => {
      // Applica filtri prezzo in JavaScript (dopo la query)
      // Converti il prezzo da stringa a numero e arrotonda a 2 decimali
      const priceRaw = row.price_euros || 0;
      const price = typeof priceRaw === 'string' ? parseFloat(priceRaw) : priceRaw;
      const priceRounded = Math.round(price * 100) / 100; // Arrotonda a 2 decimali
      
      if (minPrice !== null && priceRounded < minPrice) return;
      if (maxPrice !== null && priceRounded > maxPrice) return;
      const vendorId = row.vendor_id;
      
      if (!vendorsMap.has(vendorId)) {
        vendorsMap.set(vendorId, {
          id: vendorId,
          name: row.vendor_name,
          logo: '', // TODO: aggiungere logo quando disponibile
          description: '', // Organizations non ha description, usare valore vuoto o costruire da address
          products: []
        });
      }

      const vendor = vendorsMap.get(vendorId)!;
      
      // Estrai GLB da glb_files_json (priorità) e immagini da images_json (fallback)
      let imageUrl: string | undefined;
      let glbUrl: string | undefined;
      
      // Prima cerca GLB in glb_files_json
      if (row.glb_files_json) {
        try {
          const glbFiles = typeof row.glb_files_json === 'string' 
            ? JSON.parse(row.glb_files_json) 
            : row.glb_files_json;
          if (Array.isArray(glbFiles) && glbFiles.length > 0) {
            const firstGlb = glbFiles[0];
            let rawUrl = firstGlb.url || firstGlb.filename || firstGlb;
            
            // Se è un URL completo (http/https), usa direttamente
            if (typeof rawUrl === 'string' && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))) {
              glbUrl = rawUrl;
            } 
            // Se è un path relativo, costruisci URL Supabase Storage
            else if (typeof rawUrl === 'string') {
              try {
                glbUrl = publicObjectUrl('assets', rawUrl);
              } catch (e) {
                console.warn('Errore costruzione URL Supabase Storage:', e);
                glbUrl = undefined; // Non usare path locale su Netlify
              }
            }
          }
        } catch (e) {
          console.warn('Errore parsing glb_files_json:', e);
        }
      }
      
      // Poi cerca immagini in images_json come fallback
      if (row.images_json) {
        try {
          const images = typeof row.images_json === 'string' 
            ? JSON.parse(row.images_json) 
            : row.images_json;
          if (Array.isArray(images) && images.length > 0) {
            // Cerca la prima immagine normale (non GLB)
            const normalImage = images.find((img: any) => 
              img.type !== 'glb' && !img.url?.endsWith('.glb')
            );
            if (normalImage) {
              imageUrl = normalImage.url || normalImage;
            } else if (images[0]) {
              // Se non c'è immagine normale, usa la prima disponibile
              imageUrl = images[0].url || images[0];
            }
          }
        } catch (e) {
          console.warn('Errore parsing images_json:', e);
        }
      }

      // Filtra solo prodotti con stock disponibile > 0 o con prezzo definito
      const availableStock = parseInt(row.available_stock) || 0;
      
      // Mostra prodotti se hanno stock disponibile O prezzo (anche se stock = 0)
      // Questo permette di vedere prodotti anche senza stock se hanno un prezzo
      if (availableStock > 0 || priceRounded > 0) {
        vendor.products.push({
          id: row.catalog_item_id, // Usa catalog_item_id come ID univoco
          skuCode: row.sku_code,
          name: row.product_name,
          model: row.model,
          brand: row.brand,
          category: row.product_type,
          price: priceRounded, // Prezzo arrotondato a 2 decimali
          currency: row.currency || 'EUR',
          stock: availableStock,
          leadTimeDays: row.lead_time_days || null,
          imageUrl,
          glbUrl,
          description: `${row.brand} ${row.model} - ${row.product_name}`, // Costruisci description da altri campi
          specs: row.specs_json,
          vendorNotes: row.vendor_notes
        });
      } else {
        console.log('⚠️  Prodotto escluso dal catalogo pubblico:', {
          skuCode: row.sku_code,
          productName: row.product_name,
          stock: availableStock,
          price: price,
          isForSale: row.is_for_sale
        });
      }
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
