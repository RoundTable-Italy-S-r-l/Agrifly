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

    // Query notevolmente semplificata per catalogo pubblico
    // Adattata allo schema Supabase esistente - mostra prodotti di base
    let querySql = `
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.brand,
        p.model,
        p.product_type,
        p.specs_json,
        p.specs_core_json,
        p.images_json,
        p.glb_files_json,
        p.id as productId,
        1 as vendor_count,
        NULL as min_price_euros,
        0 as total_stock
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

    // TEMPORANEO: Usa dati hardcoded per testare il flusso frontend
    // TODO: Rimuovere quando il database sarà corretto
    const mockProducts = [
      {
        product_id: 'prd_t50',
        product_name: 'DJI Agras T50',
        brand: 'DJI',
        model: 'Agras T50',
        product_type: 'DRONE',
        specs_json: '{"tank": "40L", "battery": "30min", "feature": "Drone agricolo avanzato"}',
        images_json: '["https://example.com/t50.jpg"]',
        glb_files_json: null,
        productId: 'prd_t50',
        vendor_count: 2,
        min_price_euros: 28500.00,
        total_stock: 5
      },
      {
        product_id: 'prd_t30',
        product_name: 'DJI Agras T30',
        brand: 'DJI',
        model: 'Agras T30',
        product_type: 'DRONE',
        specs_json: '{"tank": "30L", "battery": "20min", "feature": "Drone versatile"}',
        images_json: '["https://example.com/t30.jpg"]',
        glb_files_json: null,
        productId: 'prd_t30',
        vendor_count: 1,
        min_price_euros: 22000.00,
        total_stock: 3
      }
    ];

    const result = { rows: mockProducts };
    console.log(`📦 [CATALOG PUBLIC] Prodotti mock caricati: ${result.rows.length}`);

    console.log(`📦 [CATALOG PUBLIC] Prodotti trovati: ${result.rows.length}`);
    if (result.rows.length > 0) {
      console.log(`📦 [CATALOG PUBLIC] Primo risultato raw:`, result.rows[0]);
    }

    // Rimuovi debug e procedi con elaborazione normale

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

      const vendorCount = typeof row.vendor_count === 'number' ? row.vendor_count : parseInt(row.vendor_count as any) || 0;
      const minPrice = typeof row.min_price_euros === 'number' ? row.min_price_euros : (row.min_price_euros ? parseFloat(row.min_price_euros as any) : null);
      const totalStock = typeof row.total_stock === 'number' ? row.total_stock : parseInt(row.total_stock as any) || 0;

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
        specsCore: null, // TODO: aggiungere specs_core_json quando disponibile
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

    // Query per offerte bundle attive
    const bundlesQuery = `
      SELECT
        o.id,
        o.name,
        o.rules_json,
        o.valid_from,
        o.valid_to,
        org.legal_name as vendor_name,
        org.logo_url as vendor_logo
      FROM offers o
      JOIN organizations org ON o.vendor_org_id = org.id
      WHERE o.offer_type = 'BUNDLE'
        AND o.status = 'ACTIVE'
        AND o.valid_from <= NOW()
        AND (o.valid_to IS NULL OR o.valid_to >= NOW())
      ORDER BY o.valid_from DESC
    `;

    const bundlesResult = await query(bundlesQuery, []);
    console.log(`🎁 [CATALOG PUBLIC] Offerte bundle trovate: ${bundlesResult.rows.length}`);

    // Mappa le offerte bundle
    const bundles = bundlesResult.rows.map(row => {
      const rules = row.rules_json; // È già un oggetto JSONB
      const products = rules.products || [];

      // Trova l'immagine rappresentativa (primo prodotto del bundle)
      let bundleImageUrl: string | undefined;
      if (products.length > 0) {
        // Per ora usiamo un'immagine placeholder, in futuro potremmo avere un'immagine dedicata per il bundle
        bundleImageUrl = '/api/storage/public/bundle-placeholder.jpg';
      }

      return {
        id: row.id,
        type: 'bundle',
        name: row.name,
        description: rules.description || `Bundle con ${products.length} prodotti`,
        bundlePrice: rules.bundle_price || 0,
        products: products,
        vendorName: row.vendor_name,
        vendorLogo: row.vendor_logo,
        imageUrl: bundleImageUrl,
        validUntil: row.valid_to,
        savings: products.length > 0 ? 'Risparmia acquistando insieme!' : ''
      };
    });

    console.log(`✅ Catalogo pubblico: ${filteredProducts.length} prodotti + ${bundles.length} bundle`);
    return c.json({
      products: filteredProducts,
      bundles: bundles
    });

  } catch (error: any) {
    console.error('❌ [CATALOG PUBLIC] Errore get public catalog:', error);
    console.error('❌ [CATALOG PUBLIC] Error message:', error.message);
    console.error('❌ [CATALOG PUBLIC] Error code:', error.code);
    console.error('❌ [CATALOG PUBLIC] Stack:', error.stack);
    // params è definito solo nel try block, quindi non possiamo accedervi qui
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

    let vendors = result.rows.map(row => {
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
        currency: row.currency || 'EUR',
        offer: null // Per ora nessun offerta
      };
    });

    // Query semplificata per offerte attive - per ora cerchiamo tutte le offerte attive
    const offersQuery = `
      SELECT
        o.id as offer_id,
        o.name as offer_name,
        o.offer_type,
        o.rules_json,
        o.valid_from,
        o.valid_to,
        o.vendor_org_id as vendor_id
      FROM offers o
      WHERE o.status = 'ACTIVE'
        AND o.valid_from <= NOW()
        AND (o.valid_to IS NULL OR o.valid_to >= NOW())
      ORDER BY o.vendor_org_id
    `;

    const offersResult = await query(offersQuery, []);

    // Crea una mappa delle offerte per vendor
    const offersMap = new Map();
    offersResult.rows.forEach(offer => {
      offersMap.set(offer.vendor_id, {
        id: offer.offer_id,
        name: offer.offer_name,
        type: offer.offer_type,
        rules: offer.rules_json // È già un oggetto JSONB
      });
    });

    // Applica le offerte ai vendor esistenti
    const finalVendors = vendors.map(vendor => {
      const offer = offersMap.get(vendor.vendorId);
      if (offer) {
        // Calcola prezzo scontato se è un'offerta di sconto
        let discountedPrice = vendor.price;
        let discountPercent = 0;

        if (offer.rules) {
          if (offer.type === 'PROMO' && (offer.rules.discount_percent || offer.rules.count_percent)) {
            discountPercent = offer.rules.discount_percent || offer.rules.count_percent;
            discountedPrice = vendor.price * (1 - discountPercent / 100);
          } else if (offer.type === 'BUNDLE' && offer.rules.bundle_price) {
            // Per i bundle, usa il prezzo del bundle se applicabile
            discountedPrice = offer.rules.bundle_price;
          }
        }

        return {
          ...vendor,
          price: discountedPrice,
          offer: {
            id: offer.id,
            name: offer.name,
            type: offer.type,
            discountPercent: discountPercent,
            originalPrice: vendor.price,
            rules: offer.rules
          }
        };
      }
      return vendor;
    });

    console.log(`✅ Trovati ${finalVendors.length} vendor per prodotto ${productId} (${offersResult.rows.length} offerte attive)`);
    return c.json({ vendors: finalVendors });
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
