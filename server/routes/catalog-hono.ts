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
            // Se è un path relativo, costruisci URL Supabase Storage (bucket "Media File")
            else if (typeof rawUrl === 'string') {
              try {
                // Converti path tipo "/glb/t25p/t25p.glb" in "glb/t25p/t25p.glb" per il bucket
                const storagePath = rawUrl.startsWith('/glb/') 
                  ? rawUrl.replace(/^\/glb\//, 'glb/') 
                  : rawUrl.startsWith('/') 
                    ? rawUrl.substring(1) 
                    : rawUrl;
                glbUrl = publicObjectUrl(undefined, storagePath);
                console.log('✅ Using Supabase Storage GLB:', glbUrl);
              } catch (e) {
                console.warn('Errore costruzione URL Supabase Storage:', e);
                glbUrl = undefined;
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
// GET PUBLIC CATALOG (Prodotti dalla tabella products, non raggruppati per vendor)
// ============================================================================

app.get('/public', async (c) => {
  try {
    const category = c.req.query('category');
    const minPrice = c.req.query('minPrice') ? parseInt(c.req.query('minPrice')!) : null;
    const maxPrice = c.req.query('maxPrice') ? parseInt(c.req.query('maxPrice')!) : null;

    console.log('🌐 [CATALOG PUBLIC] Richiesta catalogo pubblico prodotti', { category, minPrice, maxPrice });
    console.log('🌐 [CATALOG PUBLIC] Environment check:', {
      hasPGHOST: !!process.env.PGHOST,
      hasPGUSER: !!process.env.PGUSER,
      hasPGPASSWORD: !!process.env.PGPASSWORD,
      isNetlify: !!(process.env.NETLIFY || process.env.NETLIFY_BUILD)
    });

    // Query per ottenere TUTTI i prodotti dalla tabella products
    // Mostra tutti i prodotti attivi, a prescindere dal vendor
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
        -- Conta quanti vendor vendono questo prodotto con stock > 0
        (
          SELECT COUNT(DISTINCT vci.vendor_org_id)
          FROM vendor_catalog_items vci
          JOIN skus s2 ON vci.sku_id = s2.id
          LEFT JOIN inventories i2 ON vci.sku_id = i2.sku_id AND i2.vendor_org_id = vci.vendor_org_id
          WHERE s2.product_id = p.id
            AND vci.is_for_sale = true
            AND (COALESCE(i2.qty_on_hand, 0) - COALESCE(i2.qty_reserved, 0)) > 0
        ) as vendor_count,
        -- Prezzo minimo tra tutti i vendor (anche offerte)
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
            AND vci_price.is_for_sale = true
            AND (COALESCE(i_price.qty_on_hand, 0) - COALESCE(i_price.qty_reserved, 0)) > 0
        ) as min_price_euros,
        -- Stock totale disponibile tra tutti i vendor
        (
          SELECT COALESCE(SUM(i_total.qty_on_hand - COALESCE(i_total.qty_reserved, 0)), 0)
          FROM vendor_catalog_items vci_total
          JOIN skus s_total ON vci_total.sku_id = s_total.id
          LEFT JOIN inventories i_total ON vci_total.sku_id = i_total.sku_id AND i_total.vendor_org_id = vci_total.vendor_org_id
          WHERE s_total.product_id = p.id
            AND vci_total.is_for_sale = true
        ) as total_stock
      FROM products p
      WHERE p.status = 'ACTIVE'
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Filtri
    if (category) {
      querySql += ` AND p.product_type = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    // Ordina per brand e model
    querySql += ` ORDER BY p.brand, p.model`;

    console.log('🔍 [CATALOG PUBLIC] Eseguendo query SQL:', querySql.substring(0, 300) + '...');
    console.log('🔍 [CATALOG PUBLIC] Parametri:', params);
    
    const result = await query(querySql, params);

    console.log(`📦 [CATALOG PUBLIC] Prodotti trovati: ${result.rows.length}`);
    if (result.rows.length > 0) {
      const firstRow = result.rows[0];
      let glbPreview: string | null = null;
      if (firstRow.glb_files_json) {
        if (typeof firstRow.glb_files_json === 'string') {
          glbPreview = firstRow.glb_files_json.substring(0, 100);
        } else {
          try {
            const glbStr = JSON.stringify(firstRow.glb_files_json);
            glbPreview = glbStr.substring(0, 100);
          } catch (e) {
            glbPreview = '[unable to stringify]';
          }
        }
      }
      console.log('📦 Primo prodotto:', {
        id: firstRow.product_id,
        name: firstRow.product_name,
        hasGlb: !!firstRow.glb_files_json,
        hasSpecsCore: !!firstRow.specs_core_json,
        glbType: typeof firstRow.glb_files_json,
        glbPreview
      });
    }

    // Estrai prodotti con immagini/GLB
    const products = result.rows.map(row => {
      // Estrai GLB URL
      let glbUrl: string | undefined;
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
                // Converti path tipo "/glb/t25p/t25p.glb" in "glb/t25p/t25p.glb" per il bucket
                const storagePath = rawUrl.startsWith('/glb/') 
                  ? rawUrl.replace(/^\/glb\//, 'glb/') 
                  : rawUrl.startsWith('/') 
                    ? rawUrl.substring(1) 
                    : rawUrl;
                glbUrl = publicObjectUrl(undefined, storagePath);
                console.log('✅ [CATALOG PUBLIC] Using Supabase Storage GLB:', glbUrl);
              } catch (e) {
                console.warn('⚠️  [CATALOG PUBLIC] Errore costruzione URL Supabase Storage:', e);
                glbUrl = undefined;
              }
            }
          }
        } catch (e) {
          console.warn('⚠️  [CATALOG PUBLIC] Errore parsing glb_files_json:', e);
        }
      }

      // Estrai image URL
      let imageUrl: string | undefined;
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

      const vendorCount = parseInt(row.vendor_count) || 0;
      const minPrice = row.min_price_euros ? parseFloat(row.min_price_euros) : null;
      const totalStock = parseInt(row.total_stock) || 0;

      return {
        id: row.product_id,
        productId: row.productId || row.product_id, // da tabella assets (prd_t25, etc.) o fallback a id
        name: row.product_name,
        model: row.model,
        brand: row.brand,
        category: row.product_type,
        imageUrl,
        glbUrl,
        description: `${row.brand} ${row.model} - ${row.product_name}`,
        specs: row.specs_json,
        specsCore: row.specs_core_json,
        vendorCount, // Numero di vendor che vendono questo prodotto
        price: minPrice, // Prezzo minimo tra tutti i vendor
        stock: totalStock // Stock totale disponibile
      };
    });

    // Applica filtri prezzo se necessario
    let filteredProducts = products;
    if (minPrice !== null || maxPrice !== null) {
      console.log('⚠️ Filtri prezzo richiedono query aggiuntiva, applicati lato client');
    }

    console.log(`✅ Catalogo pubblico: ${filteredProducts.length} prodotti`);
    return c.json({ products: filteredProducts });

  } catch (error: any) {
    console.error('❌ [CATALOG PUBLIC] Errore get public catalog:', error);
    console.error('❌ [CATALOG PUBLIC] Error message:', error.message);
    console.error('❌ [CATALOG PUBLIC] Error code:', error.code);
    console.error('❌ [CATALOG PUBLIC] Stack:', error.stack);
    // querySql è definito solo nel try block, quindi non possiamo accedervi qui
    console.error('❌ [CATALOG PUBLIC] Parametri:', params);
    // NON restituire dati mock in caso di errore - restituisci solo errore
    return c.json({
      error: 'Errore interno',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack?.split('\n').slice(0, 10) : undefined
    }, 500);
  }
});

// ============================================================================
// GET PRODUCT VENDORS (Venditori che vendono un prodotto specifico)
// ============================================================================

app.get('/product/:productId/vendors', async (c) => {
  try {
    const productId = c.req.param('productId');
    console.log('🔍 Richiesta vendor per prodotto:', productId);

    // Query per ottenere tutti i vendor che vendono questo prodotto
    const querySql = `
      SELECT DISTINCT
        o.id as vendor_id,
        o.legal_name as vendor_name,
        o.logo_url as vendor_logo_url,
        o.address_line,
        o.city,
        o.province,
        o.postal_code,
        s.id as sku_id,
        s.sku_code,
        vci.lead_time_days,
        vci.notes as vendor_notes,
        COALESCE(SUM(i.qty_on_hand), 0) - COALESCE(SUM(i.qty_reserved), 0) as available_stock,
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
      FROM products p
      JOIN skus s ON s.product_id = p.id
      JOIN vendor_catalog_items vci ON vci.sku_id = s.id
      JOIN organizations o ON vci.vendor_org_id = o.id
      LEFT JOIN inventories i ON vci.sku_id = i.sku_id AND i.vendor_org_id = o.id
      WHERE (
        p.id = $1
        OR EXISTS (SELECT 1 FROM assets a WHERE a.sku_id = s.id AND a."productId" = $1)
      )
        AND o.org_type = 'VENDOR'
        AND o.status = 'ACTIVE'
        AND vci.is_for_sale = true
        AND s.status = 'ACTIVE'
        AND p.status = 'ACTIVE'
      GROUP BY o.id, o.legal_name, o.logo_url, o.address_line, o.city, o.province, o.postal_code, s.id, s.sku_code, vci.lead_time_days, vci.notes
      HAVING (COALESCE(SUM(i.qty_on_hand), 0) - COALESCE(SUM(i.qty_reserved), 0)) > 0
      ORDER BY o.legal_name, s.sku_code
    `;

    const result = await query(querySql, [productId]);

    const vendors = result.rows.map(row => {
      // Costruisci indirizzo completo
      const addressParts = [
        row.address_line,
        row.city,
        row.province,
        row.postal_code
      ].filter(Boolean);
      const fullAddress = addressParts.join(', ') || 'Indirizzo non disponibile';

      return {
        vendorId: row.vendor_id,
        vendorName: row.vendor_name,
        vendorLogo: row.vendor_logo_url,
        vendorAddress: fullAddress,
        skuId: row.sku_id,
        skuCode: row.sku_code,
        leadTimeDays: row.lead_time_days,
        notes: row.vendor_notes,
        availableStock: parseInt(row.available_stock) || 0,
        price: parseFloat(row.price_euros) || 0,
        currency: row.currency || 'EUR'
      };
    });

    console.log(`✅ Trovati ${vendors.length} vendor per prodotto ${productId}`);
    return c.json({ vendors });
  } catch (error: any) {
    console.error('❌ Errore get product vendors:', error);
    console.error('❌ Stack:', error.stack);
    return c.json({
      error: 'Errore interno',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack?.split('\n').slice(0, 10) : undefined
    }, 500);
  }
});

export default app;
