import { Hono } from 'hono';
import { query } from '../utils/database';
import { publicObjectUrl, getSupabaseUrl, getStorageBucket } from '../utils/storage';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

import { 
  METRIC_CLUSTERS, 
  CLUSTERS_BY_PURPOSE,
  normalizeProductSpecs, 
  calculateMinMax, 
  normalizeValue,
  METRIC_LABELS 
} from '../utils/product-metrics';

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
              // PRIORITÀ: Usa sempre Supabase Storage (bucket "Media File")
              try {
                const storagePath = rawPath.startsWith('/glb/') 
                  ? rawPath.replace(/^\/glb\//, 'glb/') 
                  : rawPath.startsWith('/') 
                    ? rawPath.substring(1) 
                    : rawPath;
                glbUrl = publicObjectUrl(undefined, storagePath);
                console.log('✅ Using Supabase Storage GLB:', glbUrl);
              } catch (e) {
                // Fallback: solo in sviluppo locale
                if (process.env.NODE_ENV === 'development' && rawPath.startsWith('/glb/')) {
                  const glbPath = path.join(process.env.HOME || '', 'Desktop', 'DJI KB', rawPath);
                  if (fs.existsSync(glbPath)) {
                    const relativePath = rawPath.replace(/^\/glb\//, '');
                    glbUrl = `/api/drones/glb/${relativePath}`;
                    console.log('✅ Using local GLB fallback:', glbUrl);
                  }
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
          COALESCE(p.videos_json, NULL) as videos_json,
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
      // Cerca per product_id (UUID), sku_code, o sku_id
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
          COALESCE(p.videos_json, NULL) as videos_json,
          p.glb_files_json,
          p.manuals_pdf_json,
          s.sku_code,
          p.id as "productId"
        FROM products p
        JOIN skus s ON p.id = s.product_id
        WHERE (
          p.id = $1
          OR s.sku_code = $1
          OR s.id = $1
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
            // URL completo, usa direttamente
            glbUrl = rawPath;
          } else if (typeof rawPath === 'string') {
            // PRIORITÀ: Usa sempre Supabase Storage (bucket "Media File")
            // Fallback a file locale solo in sviluppo se Supabase non disponibile
            try {
              // Costruisci URL Supabase Storage (rimuovi /glb/ iniziale se presente)
              const storagePath = rawPath.startsWith('/glb/') 
                ? rawPath.replace(/^\/glb\//, 'glb/') 
                : rawPath.startsWith('/') 
                  ? rawPath.substring(1) 
                  : rawPath;
              glbUrl = publicObjectUrl(undefined, storagePath);
              console.log('✅ Using Supabase Storage GLB:', glbUrl);
            } catch (e) {
              console.warn('⚠️ Supabase Storage unavailable, trying local file:', e);
              // Fallback: solo in sviluppo locale, controlla file locale
              if (process.env.NODE_ENV === 'development' && rawPath.startsWith('/glb/')) {
                const glbPath = path.join(process.env.HOME || '', 'Desktop', 'DJI KB', rawPath);
                if (fs.existsSync(glbPath)) {
                  const relativePath = rawPath.replace(/^\/glb\//, '');
                  glbUrl = `/api/drones/glb/${relativePath}`;
                  console.log('✅ Using local GLB fallback:', glbUrl);
                }
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

    // Parse images_json se è una stringa e converti path in URL Supabase Storage
    let images_json = row.images_json;
    if (images_json && typeof images_json === 'string') {
      try {
        images_json = JSON.parse(images_json);
      } catch (e) {
        console.warn('Errore parsing images_json:', e);
      }
    }
    
    // Se images_json è vuoto, prova a caricare dinamicamente dal bucket Supabase
    if ((!images_json || (Array.isArray(images_json) && images_json.length === 0)) && row.id) {
      try {
        // Estrai il nome del prodotto dal model o id (es. "t25p" da "prd_t25p" o "DJI Agras T25P")
        const productId = row.id.toLowerCase();
        const modelName = row.model?.toLowerCase() || '';
        
        // Prova diversi pattern per trovare la cartella immagini
        const possiblePaths = [];
        if (productId.includes('t25p')) possiblePaths.push('images/t25p');
        else if (productId.includes('t25')) possiblePaths.push('images/t25');
        else if (productId.includes('t50')) possiblePaths.push('images/t50');
        else if (productId.includes('t70p')) possiblePaths.push('images/t70p');
        else if (productId.includes('t100')) possiblePaths.push('images/t100');
        else if (productId.includes('mavic-3-m') || productId.includes('mavic3m')) possiblePaths.push('images/mavic-3-m');
        
        if (modelName.includes('t25p')) possiblePaths.push('images/t25p');
        else if (modelName.includes('t25') && !modelName.includes('t25p')) possiblePaths.push('images/t25');
        else if (modelName.includes('t50')) possiblePaths.push('images/t50');
        else if (modelName.includes('t70p')) possiblePaths.push('images/t70p');
        else if (modelName.includes('t100')) possiblePaths.push('images/t100');
        else if (modelName.includes('mavic-3-m') || modelName.includes('mavic3m')) possiblePaths.push('images/mavic-3-m');
        
        // Se non trovato, usa il productId senza prefisso
        if (possiblePaths.length === 0) {
          const cleanId = productId.replace(/^prd_/, '').replace(/^product_/, '');
          possiblePaths.push(`images/${cleanId}`);
        }
        
        // Prova a caricare dinamicamente le immagini dal bucket Supabase
        const bucketName = getStorageBucket();
        const supabaseUrl = getSupabaseUrl();
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseKey) {
          console.log('⚠️ SUPABASE_SERVICE_ROLE_KEY non configurata - caricamento dinamico immagini disabilitato per', row.model);
        }

        if (supabaseUrl && supabaseKey && possiblePaths.length > 0) {
          console.log('🔄 Tentativo caricamento dinamico immagini per', row.model);
          try {
            const supabase = createClient(supabaseUrl, supabaseKey);
            
            // Prova ogni path possibile finché non trova immagini
            for (const imgPath of possiblePaths) {
              const { data: files, error } = await supabase.storage
                .from(bucketName)
                .list(imgPath, {
                  limit: 50,
                  sortBy: { column: 'name', order: 'asc' }
                });
              
              if (!error && files && files.length > 0) {
                // Filtra solo file immagine
                const imageFiles = files.filter(f => 
                  f.id !== null && 
                  (f.name.toLowerCase().endsWith('.jpg') || 
                   f.name.toLowerCase().endsWith('.jpeg') || 
                   f.name.toLowerCase().endsWith('.png') || 
                   f.name.toLowerCase().endsWith('.webp'))
                );
                
                if (imageFiles.length > 0) {
                  const dynamicImages = imageFiles.map((file, idx) => {
                    const fullPath = `${imgPath}/${file.name}`;
                    const supabaseUrl = publicObjectUrl(undefined, fullPath);

                    return {
                      url: supabaseUrl,
                      alt: `${row.model} - ${file.name}`,
                      is_primary: idx === 0
                    };
                  });
                  
                  console.log(`✅ Caricate ${dynamicImages.length} immagini dinamicamente per ${row.model} da bucket Supabase (${imgPath})`);
                  images_json = dynamicImages;
                  break; // Usa la prima cartella che ha immagini
                }
              }
            }
          } catch (e) {
            console.warn('Errore caricamento immagini dinamiche dal bucket:', e);
          }
        }
      } catch (e) {
        console.warn('Errore caricamento immagini dinamiche:', e);
      }
    }
    
    // Converti path in URL Supabase Storage (priorità) o endpoint locale (fallback sviluppo)
    if (Array.isArray(images_json)) {
      images_json = images_json.map((img: any) => {
        const imgUrl = typeof img === 'string' ? img : (img.url || img);
        if (typeof imgUrl === 'string' && !imgUrl.startsWith('http://') && !imgUrl.startsWith('https://')) {
          try {
            // PRIORITÀ: Usa Supabase Storage
            const storagePath = imgUrl.startsWith('/images/') 
              ? imgUrl.replace(/^\/images\//, 'images/') 
              : imgUrl.startsWith('/') 
                ? imgUrl.substring(1) 
                : imgUrl;
            const supabaseUrl = publicObjectUrl(undefined, storagePath);
            return typeof img === 'string' ? supabaseUrl : { ...img, url: supabaseUrl };
          } catch (e) {
            // Fallback: solo in sviluppo locale
            if (process.env.NODE_ENV === 'development' && imgUrl.startsWith('/images/')) {
              const localPath = path.join(process.env.HOME || '', 'Desktop', 'DJI KB', imgUrl);
              if (fs.existsSync(localPath)) {
                const relativePath = imgUrl.replace(/^\/images\//, '');
                return typeof img === 'string' ? `/api/drones/images/${relativePath}` : { ...img, url: `/api/drones/images/${relativePath}` };
              }
            }
          }
        }
        return img;
      });
    }
    if (!Array.isArray(images_json)) {
      images_json = [];
    }

    // Parse videos_json se è una stringa e converti path in URL Supabase Storage
    let videos_json = row.videos_json;
    if (videos_json && typeof videos_json === 'string') {
      try {
        videos_json = JSON.parse(videos_json);
      } catch (e) {
        console.warn('Errore parsing videos_json:', e);
      }
    }
    
    // Se videos_json è vuoto, prova a caricare dinamicamente dal bucket Supabase
    if ((!videos_json || (Array.isArray(videos_json) && videos_json.length === 0)) && row.id) {
      try {
        // Estrai il nome del prodotto dal model o id (es. "t25p" da "prd_t25p")
        const productId = row.id.toLowerCase();
        const modelName = row.model?.toLowerCase() || '';
        
        // Prova diversi pattern per trovare la cartella video
        const possiblePaths = [];
        if (productId.includes('t25p')) possiblePaths.push('videos/t25p');
        else if (productId.includes('t25')) possiblePaths.push('videos/t25');
        else if (productId.includes('t50')) possiblePaths.push('videos/t50');
        else if (productId.includes('t70p')) possiblePaths.push('videos/t70p');
        else if (productId.includes('t100')) possiblePaths.push('videos/t100');
        else if (productId.includes('mavic-3-m') || productId.includes('mavic3m')) possiblePaths.push('videos/mavic-3-m');
        
        if (modelName.includes('t25p')) possiblePaths.push('videos/t25p');
        else if (modelName.includes('t25') && !modelName.includes('t25p')) possiblePaths.push('videos/t25');
        else if (modelName.includes('t50')) possiblePaths.push('videos/t50');
        else if (modelName.includes('t70p')) possiblePaths.push('videos/t70p');
        else if (modelName.includes('t100')) possiblePaths.push('videos/t100');
        else if (modelName.includes('mavic-3-m') || modelName.includes('mavic3m')) possiblePaths.push('videos/mavic-3-m');
        
        // Se non trovato, usa il productId senza prefisso
        if (possiblePaths.length === 0) {
          const cleanId = productId.replace(/^prd_/, '').replace(/^product_/, '');
          possiblePaths.push(`videos/${cleanId}`);
        }
        
        // Prova a caricare dinamicamente i video dal bucket Supabase
        const bucketName = getStorageBucket();
        const supabaseUrl = getSupabaseUrl();
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseKey) {
          console.log('⚠️ SUPABASE_SERVICE_ROLE_KEY non configurata - caricamento dinamico video disabilitato per', row.model);
        }

        if (supabaseUrl && supabaseKey && possiblePaths.length > 0) {
          console.log('🔄 Tentativo caricamento dinamico video per', row.model, '- paths:', possiblePaths);
          try {
            const supabase = createClient(supabaseUrl, supabaseKey);
            
            // Prova ogni path possibile finché non trova video
            for (const videoPath of possiblePaths) {
              const { data: files, error } = await supabase.storage
                .from(bucketName)
                .list(videoPath, {
                  limit: 50,
                  sortBy: { column: 'name', order: 'asc' }
                });
              
              if (!error && files && files.length > 0) {
                // Filtra solo file video
                const videoFiles = files.filter(f => 
                  f.id !== null && 
                  (f.name.toLowerCase().endsWith('.mp4') || 
                   f.name.toLowerCase().endsWith('.webm') || 
                   f.name.toLowerCase().endsWith('.mov') ||
                   f.name.toLowerCase().endsWith('.avi'))
                );
                
                if (videoFiles.length > 0) {
                  const dynamicVideos = videoFiles.map((file) => {
                    const fullPath = `${videoPath}/${file.name}`;
                    const supabaseUrl = publicObjectUrl(undefined, fullPath);

                    const mimeType = file.name.toLowerCase().endsWith('.mp4') ? 'video/mp4' :
                                     file.name.toLowerCase().endsWith('.webm') ? 'video/webm' :
                                     file.name.toLowerCase().endsWith('.mov') ? 'video/quicktime' :
                                     'video/*';

                    return {
                      url: supabaseUrl,
                      title: `${row.model} - ${file.name}`,
                      type: mimeType
                    };
                  });
                  
                  console.log(`✅ Caricati ${dynamicVideos.length} video dinamicamente per ${row.model} da bucket Supabase (${videoPath})`);
                  videos_json = dynamicVideos;
                  break; // Usa la prima cartella che ha video
                }
              }
            }
          } catch (e) {
            console.warn('Errore caricamento video dinamici dal bucket:', e);
          }
        }
      } catch (e) {
        console.warn('Errore caricamento video dinamici:', e);
      }
    }
    
    // Converti path in URL Supabase Storage (priorità) o endpoint locale (fallback sviluppo)
    if (Array.isArray(videos_json)) {
      videos_json = videos_json.map((video: any) => {
        const videoUrl = typeof video === 'string' ? video : (video.url || video);
        if (typeof videoUrl === 'string' && !videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
          try {
            // PRIORITÀ: Usa Supabase Storage
            const storagePath = videoUrl.startsWith('/videos/') 
              ? videoUrl.replace(/^\/videos\//, 'videos/') 
              : videoUrl.startsWith('/') 
                ? videoUrl.substring(1) 
                : videoUrl;
            const supabaseUrl = publicObjectUrl(undefined, storagePath);
            return typeof video === 'string' ? supabaseUrl : { ...video, url: supabaseUrl };
          } catch (e) {
            console.warn('Errore conversione video URL:', e);
          }
        }
        return video;
      });
    }
    if (!Array.isArray(videos_json)) {
      videos_json = [];
    }

    // Parse manuals_pdf_json se è una stringa e converti path in URL Supabase Storage
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
    // Converti path in URL Supabase Storage (priorità) o endpoint locale (fallback sviluppo)
    manuals_pdf_json = manuals_pdf_json.map((manual: any) => {
      const manualUrl = typeof manual === 'string' ? manual : (manual.url || manual.filename || manual);
      if (typeof manualUrl === 'string' && !manualUrl.startsWith('http://') && !manualUrl.startsWith('https://')) {
        try {
          // PRIORITÀ: Usa Supabase Storage
          const storagePath = manualUrl.startsWith('/manuals/') || manualUrl.startsWith('/pdf/')
            ? manualUrl.replace(/^\/(manuals|pdf)\//, 'pdf/')
            : manualUrl.startsWith('/')
              ? manualUrl.substring(1)
              : manualUrl;
          const supabaseUrl = publicObjectUrl(undefined, storagePath);
          return typeof manual === 'string' ? supabaseUrl : { ...manual, url: supabaseUrl };
        } catch (e) {
          // Fallback: solo in sviluppo locale
          if (process.env.NODE_ENV === 'development' && (manualUrl.startsWith('/manuals/') || manualUrl.startsWith('/pdf/'))) {
            const localPath = path.join(process.env.HOME || '', 'Desktop', 'DJI KB', manualUrl);
            if (fs.existsSync(localPath)) {
              const relativePath = manualUrl.replace(/^\/(manuals|pdf)\//, '');
              return typeof manual === 'string' ? `/api/drones/manuals/${relativePath}` : { ...manual, url: `/api/drones/manuals/${relativePath}` };
            }
          }
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
      videos: videos_json,
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

// GET /api/drones/:id/metrics - Metriche normalizzate per grafico a ragnatela
app.get('/:id/metrics', async (c) => {
  try {
    const param = c.req.param('id');
    
    // Trova prodotto per product_id o sku_code
    const productResult = await query(`
      SELECT 
        p.id,
        p.name,
        p.specs_core_json,
        array_agg(pp.purpose) as purposes
      FROM products p
      LEFT JOIN product_purposes pp ON p.id = pp.product_id
      WHERE (p.id = $1 OR EXISTS (
        SELECT 1 FROM skus s WHERE s.product_id = p.id AND s.sku_code = $1
      ))
        AND p.status = 'ACTIVE'
      GROUP BY p.id, p.name, p.specs_core_json
      LIMIT 1
    `, [param]);
    
    if (productResult.rows.length === 0) {
      return c.json({ error: 'Product not found' }, 404);
    }
    
    const product = productResult.rows[0];
    const purposes = (product.purposes || []).filter((p: any) => p !== null && p !== undefined);
    
    console.log('🔍 [METRICS] Prodotto:', product.name, 'Purposes:', purposes);
    
    if (purposes.length === 0) {
      console.error('❌ [METRICS] Prodotto senza purpose:', product.id);
      return c.json({ error: 'Product has no purpose defined' }, 400);
    }
    
    // Parse specs_core_json del prodotto corrente (SOLO specs_core_json, non specs_extra_json)
    let specs_core_json = null;
    try {
      specs_core_json = typeof product.specs_core_json === 'string'
        ? JSON.parse(product.specs_core_json)
        : product.specs_core_json;
    } catch (e) {
      console.warn('Errore parsing specs_core_json:', e);
    }
    
    if (!Array.isArray(specs_core_json) || specs_core_json.length === 0) {
      console.error('❌ [METRICS] specs_core_json non disponibile o vuoto per:', product.id);
      return c.json({ error: 'Product specs_core_json not available or empty' }, 400);
    }
    
    console.log('✅ [METRICS] specs_core_json trovato,', specs_core_json.length, 'specs');
    
    // Per ogni purpose, trova prodotti con QUEL purpose specifico (non tutti insieme)
    // Se il prodotto ha SPRAY e SPREAD, facciamo due confronti separati
    const allMetricsByPurpose: Record<string, Array<{ productId: string; metrics: Record<string, number | null> }>> = {};
    
    for (const purpose of purposes) {
      // Trova tutti i prodotti con QUESTO purpose specifico
      const allProductsResult = await query(`
        SELECT DISTINCT
          p.id,
          p.name,
          p.specs_core_json
        FROM products p
        JOIN product_purposes pp ON p.id = pp.product_id
        WHERE pp.purpose = $1::"ServiceType"
          AND p.status = 'ACTIVE'
          AND p.specs_core_json IS NOT NULL
          AND jsonb_array_length(p.specs_core_json::jsonb) > 0
      `, [purpose]);
      
      console.log(`🔍 [METRICS] Trovati ${allProductsResult.rows.length} prodotti con purpose ${purpose}`);
      
      // Normalizza specs_core_json di tutti i prodotti con questo purpose
      allMetricsByPurpose[purpose] = allProductsResult.rows.map(row => {
        let specs = null;
        try {
          specs = typeof row.specs_core_json === 'string'
            ? JSON.parse(row.specs_core_json)
            : row.specs_core_json;
        } catch (e) {
          console.warn(`❌ [METRICS] Errore parsing specs_core_json per ${row.id}:`, e);
        }
        
        return {
          productId: row.id,
          metrics: normalizeProductSpecs(specs || [])
        };
      });
    }
    
    // Se il prodotto ha più purpose, prendiamo il primo per il grafico principale
    // (in futuro si potrebbero fare grafici multipli)
    const primaryPurpose = purposes[0];
    const allProductsMetrics = allMetricsByPurpose[primaryPurpose] || [];
    
    if (allProductsMetrics.length === 0) {
      return c.json({ error: `No products found with purpose ${primaryPurpose} for comparison` }, 404);
    }
    
    // Calcola min/max per ogni metrica
    const minMax = calculateMinMax(allProductsMetrics);
    
    // Normalizza metriche del prodotto corrente
    const currentProductMetrics = normalizeProductSpecs(specs_core_json);
    const normalizedMetrics: Record<string, number> = {};
    
    Object.entries(currentProductMetrics).forEach(([key, value]) => {
      if (value !== null && minMax[key]) {
        normalizedMetrics[key] = normalizeValue(value, minMax[key].min, minMax[key].max);
      }
    });
    
    // Raggruppa per cluster - solo cluster rilevanti per il purpose (max 6)
    const relevantClusters = (CLUSTERS_BY_PURPOSE[primaryPurpose] || Object.keys(METRIC_CLUSTERS)).slice(0, 6);
    const clusterMetrics: Record<string, Array<{ key: string; label: string; value: number; rawValue: number | null; min: number; max: number }>> = {};
    
    relevantClusters.forEach(cluster => {
      const fields = METRIC_CLUSTERS[cluster] || [];
      const clusterMetricData = fields
        .filter(key => normalizedMetrics[key] !== undefined)
        .map(key => ({
          key,
          label: METRIC_LABELS[key] || key,
          value: normalizedMetrics[key],
          rawValue: currentProductMetrics[key],
          min: minMax[key]?.min || 0,
          max: minMax[key]?.max || 100
        }));
      
      // Solo aggiungi cluster se ha almeno una metrica
      if (clusterMetricData.length > 0) {
        clusterMetrics[cluster] = clusterMetricData;
      }
    });
    
    // Prepara dati per il grafico a ragnatela (formato richiesto da ProductRadarChart)
    const radarChartData = Object.entries(clusterMetrics)
      .filter(([_, metrics]) => metrics.length > 0)
      .slice(0, 6) // Massimo 6 cluster
      .map(([cluster, metrics]) => {
        // Calcola media delle metriche per questo cluster
        const avgValue = metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
        return {
          metric: cluster,
          value: avgValue,
          fullMark: 100
        };
      });
    
    return c.json({
      productName: product.name,
      purposes,
      clusters: clusterMetrics,
      radarChartData: radarChartData
    });
    
  } catch (error: any) {
    console.error('Errore get product metrics:', error);
    return c.json({ error: 'Internal server error', message: error.message }, 500);
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
