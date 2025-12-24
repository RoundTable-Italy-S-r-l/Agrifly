import { Hono } from 'hono';
import { query } from '../utils/database';
import { publicObjectUrl } from '../utils/storage';

const app = new Hono();

// GET /api/drones - Lista tutti i droni
app.get('/', async (c) => {
  try {
    const result = await query(`
      SELECT 
        p.id,
        p.name,
        p.model,
        p.brand,
        p.product_type,
        p.specs_json,
        p.images_json,
        p.glb_files_json,
        p.specs_core_json,
        p.specs_extra_json
      FROM products p
      WHERE p.status = 'ACTIVE'
      ORDER BY p.brand, p.model
    `);

    const drones = result.rows.map(row => {
      // Estrai GLB e immagini
      let imageUrl: string | undefined;
      let glbUrl: string | undefined;

      if (row.glb_files_json) {
        try {
          const glbFiles = typeof row.glb_files_json === 'string' 
            ? JSON.parse(row.glb_files_json) 
            : row.glb_files_json;
          if (Array.isArray(glbFiles) && glbFiles.length > 0) {
            const firstGlb = glbFiles[0];
            const rawPath = firstGlb.url || firstGlb.filename || firstGlb;
            
            if (typeof rawPath === 'string' && (rawPath.startsWith('http://') || rawPath.startsWith('https://'))) {
              glbUrl = rawPath;
            } else if (typeof rawPath === 'string') {
              try {
                glbUrl = publicObjectUrl('product', rawPath);
              } catch (e) {
                console.warn('Errore costruzione URL GLB:', e);
              }
            }
          }
        } catch (e) {
          console.warn('Errore parsing glb_files_json:', e);
        }
      }

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
        name: row.name,
        model: row.model,
        brand: row.brand,
        productType: row.product_type,
        specs: row.specs_json,
        specsCore: row.specs_core_json,
        specsExtra: row.specs_extra_json,
        images: row.images_json,
        imageUrl,
        glbUrl
      };
    });

    return c.json(drones);
  } catch (error: any) {
    console.error('Errore get drones:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET /api/drones/:id - Dettaglio drone per catalog_item_id o product_id
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    console.log('🔍 Richiesta drone detail per ID:', id);
    
    // Prova prima come catalog_item_id (vendor_catalog_items)
    // Se non trovato, prova come product_id
    let result = await query(`
      SELECT 
        p.id,
        p.name,
        p.model,
        p.brand,
        p.product_type,
        p.specs_json,
        p.images_json,
        p.glb_files_json,
        p.specs_core_json,
        p.specs_extra_json,
        p.manuals_json,
        vci.id as catalog_item_id,
        vci.is_for_sale,
        vci.is_for_rent,
        vci.lead_time_days,
        vci.notes as vendor_notes,
        s.id as sku_id,
        s.sku_code
      FROM products p
      JOIN skus s ON s.product_id = p.id
      JOIN vendor_catalog_items vci ON vci.sku_id = s.id
      WHERE vci.id = $1
        AND p.status = 'ACTIVE'
      LIMIT 1
    `, [id]);

    // Se non trovato come catalog_item_id, prova come product_id
    if (result.rows.length === 0) {
      console.log('⚠️  Non trovato come catalog_item_id, provo come product_id');
      result = await query(`
        SELECT 
          p.id,
          p.name,
          p.model,
          p.brand,
          p.product_type,
          p.specs_json,
          p.images_json,
          p.glb_files_json,
          p.specs_core_json,
          p.specs_extra_json,
          p.manuals_json,
          NULL as catalog_item_id,
          NULL as is_for_sale,
          NULL as is_for_rent,
          NULL as lead_time_days,
          NULL as vendor_notes,
          s.id as sku_id,
          s.sku_code
        FROM products p
        LEFT JOIN skus s ON s.product_id = p.id
        WHERE p.id = $1
          AND p.status = 'ACTIVE'
        LIMIT 1
      `, [id]);
    }

    if (result.rows.length === 0) {
      console.log('❌ Drone non trovato con ID:', id);
      return c.json({ error: 'Drone non trovato', id }, 404);
    }
    
    console.log('✅ Drone trovato:', result.rows[0].model);

    const row = result.rows[0];

    // Estrai GLB e immagini
    let imageUrl: string | undefined;
    let glbUrl: string | undefined;

    if (row.glb_files_json) {
      try {
        const glbFiles = typeof row.glb_files_json === 'string' 
          ? JSON.parse(row.glb_files_json) 
          : row.glb_files_json;
        if (Array.isArray(glbFiles) && glbFiles.length > 0) {
          const firstGlb = glbFiles[0];
          const rawPath = firstGlb.url || firstGlb.filename || firstGlb;
          
          if (typeof rawPath === 'string' && (rawPath.startsWith('http://') || rawPath.startsWith('https://'))) {
            glbUrl = rawPath;
          } else if (typeof rawPath === 'string') {
            try {
              glbUrl = publicObjectUrl('product', rawPath);
            } catch (e) {
              console.warn('Errore costruzione URL GLB:', e);
            }
          }
        }
      } catch (e) {
        console.warn('Errore parsing glb_files_json:', e);
      }
    }

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

    const drone = {
      id: row.id,
      name: row.name,
      model: row.model,
      brand: row.brand,
      productType: row.product_type,
      specs: row.specs_json,
      specsCore: row.specs_core_json,
      specsExtra: row.specs_extra_json,
      images: row.images_json,
      manuals: row.manuals_json,
      imageUrl,
      glbUrl,
      catalogItemId: row.catalog_item_id,
      isForSale: row.is_for_sale,
      isForRent: row.is_for_rent,
      leadTimeDays: row.lead_time_days,
      vendorNotes: row.vendor_notes,
      skuId: row.sku_id,
      skuCode: row.sku_code
    };

    return c.json(drone);
  } catch (error: any) {
    console.error('Errore get drone by id:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;
