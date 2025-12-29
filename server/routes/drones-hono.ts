import { Hono } from 'hono';
import { query } from '../utils/database';
import { publicObjectUrl } from '../utils/storage';
import fs from 'fs';
import path from 'path';

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
      WHERE p.status = 'ACTIVE' AND p.product_type = 'drone'
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
            // Se il path inizia con /glb/, servilo come file statico locale
            if (rawPath.startsWith('/glb/')) {
              const glbPath = path.join(process.env.HOME || '', 'Desktop', 'DJI KB', rawPath);
              console.log('🔍 Checking GLB file:', { rawPath, glbPath, exists: fs.existsSync(glbPath) });
              if (fs.existsSync(glbPath)) {
                // Per sviluppo locale, usa un endpoint che serve i file statici
                // rawPath è tipo "/glb/t25p/t25p.glb", quindi rimuoviamo il primo "/glb/"
                const relativePath = rawPath.replace(/^\/glb\//, '');
                glbUrl = `/api/drones/glb/${relativePath}`;
                console.log('✅ Using local GLB:', glbUrl);
              } else {
                console.warn('⚠️  Local GLB not found, using Supabase fallback');
                try {
                  glbUrl = publicObjectUrl(undefined, rawPath);
                } catch (e) {
                  console.warn('Errore costruzione URL GLB:', e);
                }
              }
            } else if (rawPath.startsWith('/images/') || rawPath.startsWith('/manuals/') || rawPath.startsWith('/pdf/')) {
              // Gestisci immagini e manuali locali
              const localPath = path.join(process.env.HOME || '', 'Desktop', 'DJI KB', rawPath);
              if (fs.existsSync(localPath)) {
                if (rawPath.startsWith('/images/')) {
                  const relativePath = rawPath.replace(/^\/images\//, '');
                  glbUrl = `/api/drones/images/${relativePath}`;
                } else if (rawPath.startsWith('/manuals/') || rawPath.startsWith('/pdf/')) {
                  const relativePath = rawPath.replace(/^\/(manuals|pdf)\//, '');
                  glbUrl = `/api/drones/manuals/${relativePath}`;
                }
                console.log('✅ Using local media:', glbUrl);
              } else {
                try {
                  glbUrl = publicObjectUrl(undefined, rawPath);
                } catch (e) {
                  console.warn('Errore costruzione URL media:', e);
                }
              }
            } else {
                try {
                  glbUrl = publicObjectUrl(undefined, rawPath);
                } catch (e) {
                  console.warn('Errore costruzione URL GLB:', e);
                }
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
    console.log('🔍 Tipo param:', typeof param);

    // Determina se è un UUID o un codice prodotto
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);
    console.log('🔍 Is UUID:', isUUID);

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
          p.specs_core_json,
          p.specs_extra_json,
          p.images_json,
          p.glb_files_json,
          p.manuals_pdf_json,
          s.sku_code
        FROM products p
        JOIN skus s ON p.id = s.product_id
        WHERE p.id = $1 AND p.status = 'ACTIVE' AND s.status = 'ACTIVE'
        LIMIT 1
      `;
      queryParams = [param];
    } else {
      // Cerca prima per productId degli assets (es. prd_t100), poi per id prodotto, poi per sku_code come fallback
      querySql = `
        SELECT DISTINCT
          p.id,
          p.name,
          p.model,
          p.brand,
          p.product_type,
          p.specs_json,
          p.specs_core_json,
          p.specs_extra_json,
          p.images_json,
          p.glb_files_json,
          p.manuals_pdf_json,
          s.sku_code,
          (
            SELECT a2."productId"
            FROM assets a2
            WHERE a2.sku_id = s.id
              AND a2.asset_status = 'AVAILABLE'
            LIMIT 1
          ) as "productId"
        FROM products p
        JOIN skus s ON p.id = s.product_id
        WHERE (
          EXISTS (SELECT 1 FROM assets a WHERE a.sku_id = s.id AND a."productId" = $1)
          OR p.id = $1
          OR s.sku_code = $1
        )
          AND p.status = 'ACTIVE'
          AND s.status = 'ACTIVE'
        LIMIT 1
      `;
      queryParams = [param];
    }

    const result = await query(querySql, queryParams);

    if (result.rows.length === 0) {
      console.log('❌ Prodotto non trovato per param:', param);
      console.log('🔍 Query eseguita:', querySql);
      console.log('🔍 Parametri:', queryParams);
      return c.json({ error: 'Prodotto non trovato', productId: param }, 404);
    }

    console.log('✅ Prodotto trovato:', result.rows[0].model, 'ID:', result.rows[0].id);

    const row = result.rows[0];

    // Calcola prezzo dalla price list attiva
    let price: number | undefined;
    try {
      const priceResult = await query(`
        SELECT pli.price_cents / 100.0 as price_euros
        FROM price_list_items pli
        JOIN price_lists pl ON pli.price_list_id = pl.id
        WHERE pli.sku_id = (SELECT id FROM skus WHERE product_id = $1 AND status = 'ACTIVE' LIMIT 1)
          AND pl.vendor_org_id = (SELECT vendor_org_id FROM vendor_catalog_items WHERE sku_id = (SELECT id FROM skus WHERE product_id = $1 AND status = 'ACTIVE' LIMIT 1) LIMIT 1)
          AND pl.status = 'ACTIVE'
          AND pl.valid_from <= NOW()
          AND (pl.valid_to IS NULL OR pl.valid_to >= NOW())
        ORDER BY pl.valid_from DESC
        LIMIT 1
      `, [row.id]);

      if (priceResult.rows.length > 0) {
        price = parseFloat(priceResult.rows[0].price_euros);
      }
    } catch (e) {
      console.warn('Errore calcolo prezzo:', e);
    }

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
            // Se il path inizia con /glb/, servilo come file statico locale
            if (rawPath.startsWith('/glb/')) {
              // Costruisci URL locale per file GLB nella cartella DJI KB
              const glbPath = path.join(process.env.HOME || '', 'Desktop', 'DJI KB', rawPath);
              if (fs.existsSync(glbPath)) {
                // Per sviluppo locale, usa un endpoint che serve i file statici
                // rawPath è tipo "/glb/t25p/t25p.glb", quindi rimuoviamo il primo "/glb/"
                const relativePath = rawPath.replace(/^\/glb\//, '');
                glbUrl = `/api/drones/glb/${relativePath}`;
              } else {
                // Fallback a Supabase se il file locale non esiste
                try {
                  glbUrl = publicObjectUrl(undefined, rawPath);
                } catch (e) {
                  console.warn('Errore costruzione URL GLB:', e);
                }
              }
            } else {
              // Altri path, prova Supabase
              try {
                glbUrl = publicObjectUrl(undefined, rawPath);
              } catch (e) {
                console.warn('Errore costruzione URL GLB:', e);
              }
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

    // Usa i veri specs_core_json e specs_extra_json dal database
    // Parse JSON strings se necessario
    let specs_core_json = null;
    let specs_extra_json = null;

    if (row.specs_core_json) {
      try {
        specs_core_json = typeof row.specs_core_json === 'string' 
          ? JSON.parse(row.specs_core_json) 
          : row.specs_core_json;
      } catch (e) {
        console.warn('Errore parsing specs_core_json:', e);
      }
    }

    if (row.specs_extra_json) {
      try {
        specs_extra_json = typeof row.specs_extra_json === 'string' 
          ? JSON.parse(row.specs_extra_json) 
          : row.specs_extra_json;
      } catch (e) {
        console.warn('Errore parsing specs_extra_json:', e);
      }
    }

    // Fallback: trasforma specs_json se specs_core_json è vuoto
    if (!specs_core_json && row.specs_json) {
      const specsJson = typeof row.specs_json === 'string' 
        ? JSON.parse(row.specs_json) 
        : row.specs_json;
      specs_core_json = Object.entries(specsJson).map(([key, value]) => ({
        key,
        value: String(value),
        section: 'general',
        source_text: `${key}: ${value}`
      }));
    }

    // Parse specs_json se è una stringa
    let specs_json = row.specs_json;
    if (specs_json && typeof specs_json === 'string') {
      try {
        specs_json = JSON.parse(specs_json);
      } catch (e) {
        console.warn('Errore parsing specs_json:', e);
      }
    }

    // Parse images_json se è una stringa e converti path locali in URL endpoint
    let images_json = row.images_json;
    if (images_json && typeof images_json === 'string') {
      try {
        images_json = JSON.parse(images_json);
      } catch (e) {
        console.warn('Errore parsing images_json:', e);
      }
    }
    // Converti path locali in URL endpoint per immagini
    if (Array.isArray(images_json)) {
      images_json = images_json.map((img: any) => {
        const imgUrl = typeof img === 'string' ? img : (img.url || img);
        if (typeof imgUrl === 'string' && (imgUrl.startsWith('/images/') || imgUrl.startsWith('/manuals/') || imgUrl.startsWith('/pdf/'))) {
          const localPath = path.join(process.env.HOME || '', 'Desktop', 'DJI KB', imgUrl);
          if (fs.existsSync(localPath)) {
            if (imgUrl.startsWith('/images/')) {
              const relativePath = imgUrl.replace(/^\/images\//, '');
              return typeof img === 'string' ? `/api/drones/images/${relativePath}` : { ...img, url: `/api/drones/images/${relativePath}` };
            } else {
              const relativePath = imgUrl.replace(/^\/(manuals|pdf)\//, '');
              return typeof img === 'string' ? `/api/drones/manuals/${relativePath}` : { ...img, url: `/api/drones/manuals/${relativePath}` };
            }
          }
        }
        return img;
      });
    }

    // Parse manuals_pdf_json se è una stringa e converti path locali in URL endpoint
    let manuals_pdf_json = row.manuals_pdf_json;
    if (manuals_pdf_json && typeof manuals_pdf_json === 'string') {
      try {
        manuals_pdf_json = JSON.parse(manuals_pdf_json);
      } catch (e) {
        console.warn('Errore parsing manuals_pdf_json:', e);
      }
    }
    if (!Array.isArray(manuals_pdf_json)) {
      manuals_pdf_json = [];
    }
    // Converti path locali in URL endpoint per PDF
    manuals_pdf_json = manuals_pdf_json.map((manual: any) => {
      const manualUrl = typeof manual === 'string' ? manual : (manual.url || manual.filename || manual);
      if (typeof manualUrl === 'string' && (manualUrl.startsWith('/manuals/') || manualUrl.startsWith('/pdf/'))) {
        const localPath = path.join(process.env.HOME || '', 'Desktop', 'DJI KB', manualUrl);
        if (fs.existsSync(localPath)) {
          const relativePath = manualUrl.replace(/^\/(manuals|pdf)\//, '');
          return typeof manual === 'string' ? `/api/drones/manuals/${relativePath}` : { ...manual, url: `/api/drones/manuals/${relativePath}` };
        }
      }
      return manual;
    });

    const product = {
      id: row.id,
      name: row.name,
      model: row.model,
      brand: row.brand,
      productType: row.product_type,
      price,
      specs: specs_json,
      specsCore: specs_core_json,
      specsExtra: specs_extra_json,
      manuals: manuals_pdf_json,
      images: images_json,
      imageUrl,
      glbUrl
    };

    return c.json(product);
  } catch (error: any) {
    console.error('Errore get product by id:', error);
    console.error('Stack:', error.stack);
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

// Serve file GLB locali dalla cartella DJI KB
app.get('/glb/*', async (c) => {
  try {
    // Estrai il path dal parametro wildcard
    // In Hono, il wildcard * viene passato come parametro con chiave '*'
    const wildcardParam = c.req.param('*');
    const pathname = c.req.path;
    
    // Se il wildcard non funziona, usa il pathname
    let glbPath = wildcardParam;
    if (!glbPath || glbPath === '*') {
      // Estrai il path dopo /api/drones/glb/
      const match = pathname.match(/\/api\/drones\/glb\/(.+)$/);
      glbPath = match ? match[1] : '';
    }
    
    if (!glbPath) {
      return c.json({ error: 'Invalid path' }, 400);
    }
    
    const fullPath = path.join(process.env.HOME || '', 'Desktop', 'DJI KB', 'glb', glbPath);
    
    console.log('🔍 Serving GLB file:', { glbPath, fullPath, exists: fs.existsSync(fullPath) });
    
    if (!fs.existsSync(fullPath)) {
      console.error('❌ GLB file not found:', fullPath);
      return c.json({ error: 'File not found', path: fullPath }, 404);
    }

    const fileContent = fs.readFileSync(fullPath);
    console.log('✅ Serving GLB file:', { path: fullPath, size: fileContent.length });
    
    return new Response(fileContent, {
      headers: {
        'Content-Type': 'model/gltf-binary',
        'Content-Length': fileContent.length.toString(),
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('❌ Errore servire GLB:', error);
    console.error('❌ Stack:', error.stack);
    return c.json({ error: 'Internal server error', message: error.message }, 500);
  }
});

// GET /api/drones/images/* - Serve immagini locali
app.get('/images/*', async (c) => {
  try {
    const pathname = c.req.path;
    const wildcardParam = c.req.param('*');
    
    let imagePath = wildcardParam;
    if (!imagePath || imagePath === '*') {
      const match = pathname.match(/\/api\/drones\/images\/(.+)$/);
      imagePath = match ? match[1] : '';
    }
    
    if (!imagePath) {
      return c.json({ error: 'Invalid path' }, 400);
    }
    
    // Cerca nelle cartelle comuni per immagini
    const possiblePaths = [
      path.join(process.env.HOME || '', 'Desktop', 'DJI KB', 'images', imagePath),
      path.join(process.env.HOME || '', 'Desktop', 'DJI KB', imagePath),
    ];
    
    let fullPath: string | null = null;
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        fullPath = possiblePath;
        break;
      }
    }
    
    if (!fullPath) {
      console.error('❌ Image file not found:', imagePath);
      return c.json({ error: 'File not found', path: imagePath }, 404);
    }

    const fileContent = fs.readFileSync(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' : 
                        ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 
                        ext === '.webp' ? 'image/webp' : 
                        'image/*';
    
    console.log('✅ Serving image file:', { path: fullPath, size: fileContent.length, contentType });
    
    return new Response(fileContent, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileContent.length.toString(),
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('❌ Errore servire immagine:', error);
    return c.json({ error: 'Internal server error', message: error.message }, 500);
  }
});

// GET /api/drones/manuals/* - Serve PDF manuali locali
app.get('/manuals/*', async (c) => {
  try {
    const pathname = c.req.path;
    const wildcardParam = c.req.param('*');
    
    let manualPath = wildcardParam;
    if (!manualPath || manualPath === '*') {
      const match = pathname.match(/\/api\/drones\/manuals\/(.+)$/);
      manualPath = match ? match[1] : '';
    }
    
    if (!manualPath) {
      return c.json({ error: 'Invalid path' }, 400);
    }
    
    // Cerca nelle cartelle comuni per manuali PDF
    const possiblePaths = [
      path.join(process.env.HOME || '', 'Desktop', 'DJI KB', 'manuals', manualPath),
      path.join(process.env.HOME || '', 'Desktop', 'DJI KB', 'pdf', manualPath),
      path.join(process.env.HOME || '', 'Desktop', 'DJI KB', manualPath),
    ];
    
    let fullPath: string | null = null;
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        fullPath = possiblePath;
        break;
      }
    }
    
    if (!fullPath) {
      console.error('❌ Manual PDF file not found:', manualPath);
      return c.json({ error: 'File not found', path: manualPath }, 404);
    }

    const fileContent = fs.readFileSync(fullPath);
    
    console.log('✅ Serving manual PDF file:', { path: fullPath, size: fileContent.length });
    
    return new Response(fileContent, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': fileContent.length.toString(),
        'Access-Control-Allow-Origin': '*',
        'Content-Disposition': `inline; filename="${path.basename(fullPath)}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('❌ Errore servire manuale PDF:', error);
    return c.json({ error: 'Internal server error', message: error.message }, 500);
  }
});

export default app;
