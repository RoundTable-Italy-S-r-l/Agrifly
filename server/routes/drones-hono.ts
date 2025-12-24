import { Hono } from 'hono';
import { query } from '../utils/database';
import { publicObjectUrl } from '../utils/storage';

const app = new Hono();

// GET /api/drones - Lista prodotti (per compatibilità)
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
        p.glb_files_json
      FROM products p
      WHERE p.status = 'ACTIVE'
      ORDER BY p.brand, p.model
    `);

    const products = result.rows.map(row => {
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
                glbUrl = publicObjectUrl('assets', rawPath);
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
        images: row.images_json,
        imageUrl,
        glbUrl
      };
    });

    return c.json(products);
  } catch (error: any) {
    console.error('Errore get products:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET /api/drones/:id - Dettaglio prodotto per product_id o sku_code
app.get('/:id', async (c) => {
  try {
    const param = c.req.param('id');
    console.log('🔍 Richiesta product detail per param:', param);

    // Determina se è un UUID o un codice SKU
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);

    let querySql: string;
    let queryParams: any[];

    if (isUUID) {
      // Cerca per product_id (UUID)
      querySql = `
        SELECT
          p.id,
          p.name,
          p.model,
          p.brand,
          p.product_type,
          p.specs_json,
          p.images_json,
          p.glb_files_json
        FROM products p
        WHERE p.id = $1 AND p.status = 'ACTIVE'
        LIMIT 1
      `;
      queryParams = [param];
    } else {
      // Cerca per sku_code (es. prd_t25)
      querySql = `
        SELECT
          p.id,
          p.name,
          p.model,
          p.brand,
          p.product_type,
          p.specs_json,
          p.images_json,
          p.glb_files_json
        FROM products p
        JOIN skus s ON p.id = s.product_id
        WHERE s.sku_code = $1 AND p.status = 'ACTIVE' AND s.status = 'ACTIVE'
        LIMIT 1
      `;
      queryParams = [param];
    }

    const result = await query(querySql, queryParams);

    if (result.rows.length === 0) {
      console.log('❌ Prodotto non trovato:', productId);
      return c.json({ error: 'Prodotto non trovato', productId }, 404);
    }

    console.log('✅ Prodotto trovato:', result.rows[0].model);

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
              glbUrl = publicObjectUrl('assets', rawPath);
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

    const product = {
      id: row.id,
      name: row.name,
      model: row.model,
      brand: row.brand,
      productType: row.product_type,
      specs: row.specs_json,
      images: row.images_json,
      imageUrl,
      glbUrl
    };

    return c.json(product);
  } catch (error: any) {
    console.error('Errore get product by id:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET /api/drones/debug/tables - Debug: lista tutte le tabelle
app.get('/debug/tables', async (c) => {
  try {
    console.log('🔍 Debug: richiesta lista tabelle');

    const tablesResult = await query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );

    const tables = tablesResult.rows.map(row => row.table_name);

    // Controlla se esiste assets
    const hasAssets = tables.includes('assets');

    let assetsInfo = null;
    if (hasAssets) {
      // Struttura della tabella assets
      const columnsResult = await query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'assets' AND table_schema = 'public'
        ORDER BY ordinal_position
      `);

      // Alcuni record di esempio
      const assetsResult = await query('SELECT * FROM assets LIMIT 3');

      assetsInfo = {
        columns: columnsResult.rows,
        sampleRecords: assetsResult.rows
      };
    }

    return c.json({
      tables,
      hasAssets,
      assetsInfo
    });

  } catch (error: any) {
    console.error('Errore debug tables:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;
