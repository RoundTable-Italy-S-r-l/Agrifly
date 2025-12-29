import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path alla cartella DJI KB sul desktop
const DJI_KB_PATH = path.join(process.env.HOME || '', 'Desktop', 'DJI KB');

// Connessione al database SQLite locale
const dbPath = path.join(__dirname, '../../prisma/dev.db');
const db = new Database(dbPath);

// Funzione helper per leggere JSON
function readJSONFile(filePath: string): any[] | null {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn(`⚠️  Could not read ${filePath}:`, error);
  }
  return null;
}

// Funzione helper per leggere manuali PDF
function readManualsPDFs(droneId: string): any[] {
  // Mappa ID drone a nome cartella (alcuni hanno nomi diversi)
  const folderMap: Record<string, string> = {
    't25': 't25',
    't25p': 't25p',
    't30': 't30',
    't50': 't50',
    't70p': 't70p',
    't100': 't100',
    'mavic3m': 'mavic-3-m'
  };

  const folderName = folderMap[droneId] || droneId;
  const manualsPath = path.join(DJI_KB_PATH, 'manuals', 'pdfs', folderName);

  if (!fs.existsSync(manualsPath)) {
    return [];
  }

  const files = fs.readdirSync(manualsPath);
  return files
    .filter(file => file.endsWith('.pdf'))
    .map(file => ({
      url: `/manuals/${folderName}/${file}`,
      filename: file,
      type: 'user_manual',
      size: null
    }));
}

// Dati droni hardcoded con prezzi Lenzi
const DRONES = [
  {
    id: 't50',
    model: 'DJI Agras T50',
    price: 28500,
    category: 'Flagship (Top Gamma)',
    tagline: 'Efficienza massima per grandi estensioni',
    targetUse: 'Grandi estensioni, Cerealicoltura intensiva. Efficienza massima.',
    imageUrl: 'https://cdn.builder.io/api/v1/image/assets%2F2465e073f7c94097be8616ce134014fe%2F58d74d38d1fb4075a2b3a226cc229907?format=webp&width=800',
    glbFile: '/glb/t50/T50.glb',
    specs: {
      tank: '40L (Liq) / 50kg (Sol)',
      battery: 'N/A',
      efficiency: '25 ha/h',
      feature: 'Radar Phased Array + Doppia nebulizzazione centrifuga'
    },
    roi_months: 8,
    efficiency_ha_per_hour: 25
  },
  {
    id: 't30',
    model: 'DJI Agras T30',
    price: 16500,
    category: 'Standard Industry',
    tagline: 'Rapporto Q/P eccellente',
    targetUse: 'Soluzione collaudata per aziende medie.',
    imageUrl: 'https://cdn.builder.io/api/v1/image/assets%2F2465e073f7c94097be8616ce134014fe%2Fd8d2c5c643ae4c44b415ab8d453b6b93?format=webp&width=800',
    glbFile: null,
    specs: {
      tank: '30L',
      battery: 'N/A',
      efficiency: '16 ha/h',
      feature: 'Branch Targeting Tech + Radar Sferico'
    },
    roi_months: 7,
    efficiency_ha_per_hour: 16
  },
  {
    id: 't70p',
    model: 'DJI Agras T70P',
    price: 32000,
    category: 'Heavy Lift (Next Gen)',
    tagline: 'Sostituisce trattori di grandi dimensioni',
    targetUse: 'Trattamenti massivi su pianura.',
    imageUrl: 'https://cdn.builder.io/api/v1/image/assets%2F2465e073f7c94097be8616ce134014fe%2Fbc07e146eb984c448fb3fe46a05699c8?format=webp&width=800',
    glbFile: '/glb/t70p/t70p.glb',
    specs: {
      tank: 'Alta Capacità (70L+)',
      battery: 'N/A',
      efficiency: '30 ha/h',
      feature: 'Aggiornamento recente + Power System potenziato'
    },
    roi_months: 9,
    efficiency_ha_per_hour: 30
  },
  {
    id: 't100',
    model: 'DJI Agras T100',
    price: 45000,
    category: 'Ultra Heavy / Custom',
    tagline: 'Creazione rivoluzionaria',
    targetUse: 'Applicazioni industriali e vaste superfici.',
    imageUrl: 'https://cdn.builder.io/api/v1/image/assets%2F2465e073f7c94097be8616ce134014fe%2Fd5ca49f288ac47d8932ade07a9b066ae?format=webp&width=800',
    glbFile: '/glb/t100/t100.glb',
    specs: {
      tank: 'Capacità Record (100L stima)',
      battery: 'N/A',
      efficiency: '40 ha/h',
      feature: 'Autonomia estesa + Mappatura Cloud integrata'
    },
    roi_months: 10,
    efficiency_ha_per_hour: 40
  },
  {
    id: 't25',
    model: 'DJI Agras T25',
    price: 12000,
    category: 'Entry Level',
    tagline: 'Soluzione entry-level',
    targetUse: 'Piccole e medie aziende agricole.',
    imageUrl: null,
    glbFile: '/glb/t25/T25.glb',
    specs: {
      tank: '20L',
      battery: 'N/A',
      efficiency: '12 ha/h',
      feature: 'Sistema base di irrorazione'
    },
    roi_months: 6,
    efficiency_ha_per_hour: 12
  },
  {
    id: 't25p',
    model: 'DJI Agras T25P',
    price: 14000,
    category: 'Entry Level Pro',
    tagline: 'Versione potenziata T25',
    targetUse: 'Piccole e medie aziende agricole.',
    imageUrl: null,
    glbFile: '/glb/t25p/t25p.glb',
    specs: {
      tank: '20L',
      battery: 'N/A',
      efficiency: '12 ha/h',
      feature: 'Sistema potenziato di irrorazione'
    },
    roi_months: 6,
    efficiency_ha_per_hour: 12
  },
  {
    id: 'mavic3m',
    model: 'DJI Mavic 3M',
    price: 8000,
    category: 'Mapping',
    tagline: 'Drone per mappatura e analisi',
    targetUse: 'Mappatura e analisi agricola.',
    imageUrl: null,
    glbFile: '/glb/mavic3m/Mavic 3 m.glb',
    specs: {
      tank: 'N/A',
      battery: 'N/A',
      efficiency: 'N/A',
      feature: 'Sistema di mappatura avanzato'
    },
    roi_months: 0,
    efficiency_ha_per_hour: 0
  }
];

async function main() {
  console.log('🌱 Starting drones seeding as Products (SQLite local)...');
  console.log(`📁 DJI KB Path: ${DJI_KB_PATH}`);

  // Verifica che la cartella DJI KB esista
  if (!fs.existsSync(DJI_KB_PATH)) {
    console.error(`❌ DJI KB folder not found at: ${DJI_KB_PATH}`);
    process.exit(1);
  }

  // Aggiungi colonne JSON se non esistono
  try {
    db.exec(`
      ALTER TABLE products ADD COLUMN specs_json TEXT;
      ALTER TABLE products ADD COLUMN specs_core_json TEXT;
      ALTER TABLE products ADD COLUMN specs_extra_json TEXT;
      ALTER TABLE products ADD COLUMN images_json TEXT;
      ALTER TABLE products ADD COLUMN glb_files_json TEXT;
      ALTER TABLE products ADD COLUMN manuals_pdf_json TEXT;
    `);
    console.log('✅ Added JSON columns to products table');
  } catch (e: any) {
    if (e.message.includes('duplicate column')) {
      console.log('ℹ️  JSON columns already exist');
    } else {
      console.warn('⚠️  Could not add JSON columns:', e.message);
    }
  }

  // Inseriamo ogni drone come Product + SKU
  for (const drone of DRONES) {
    // Leggi specifiche core ed extra dai file JSON
    const coreSpecsPath = path.join(DJI_KB_PATH, 'products_specs_core', `${drone.id}.json`);
    const extraSpecsPath = path.join(DJI_KB_PATH, 'products_specs_extra', `${drone.id}.json`);
    const coreSpecs = readJSONFile(coreSpecsPath) || [];
    const extraSpecs = readJSONFile(extraSpecsPath) || [];
    
    // Leggi manuali PDF
    const manuals = readManualsPDFs(drone.id);
    
    const productId = `prd_${drone.id}`;
    const skuId = `sku_${drone.id}`;

    // Prepara i dati JSON
    const specsJson = JSON.stringify({
      ...drone.specs,
      category: drone.category,
      tagline: drone.tagline,
      targetUse: drone.targetUse,
      roi_months: drone.roi_months,
      efficiency_ha_per_hour: drone.efficiency_ha_per_hour
    });
    const coreSpecsJson = JSON.stringify(coreSpecs);
    const extraSpecsJson = JSON.stringify(extraSpecs);
    const imagesJson = drone.imageUrl ? JSON.stringify([{ url: drone.imageUrl, alt: drone.model, is_primary: true }]) : null;
    const glbFilesJson = drone.glbFile ? JSON.stringify([{ url: drone.glbFile, filename: drone.glbFile.split('/').pop(), size: null }]) : null;
    const manualsPdfJson = manuals.length > 0 ? JSON.stringify(manuals) : null;

    // Upsert Product
    db.prepare(`
      INSERT INTO products (id, product_type, brand, model, name, specs_json, specs_core_json, specs_extra_json, images_json, glb_files_json, manuals_pdf_json, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        product_type = excluded.product_type,
        brand = excluded.brand,
        model = excluded.model,
        name = excluded.name,
        specs_json = excluded.specs_json,
        specs_core_json = excluded.specs_core_json,
        specs_extra_json = excluded.specs_extra_json,
        images_json = excluded.images_json,
        glb_files_json = excluded.glb_files_json,
        manuals_pdf_json = excluded.manuals_pdf_json,
        status = excluded.status
    `).run(
      productId,
      'DRONE',
      'DJI',
      drone.model,
      drone.model,
      specsJson,
      coreSpecsJson,
      extraSpecsJson,
      imagesJson,
      glbFilesJson,
      manualsPdfJson,
      'ACTIVE'
    );

    // Upsert SKU
    db.prepare(`
      INSERT INTO skus (id, product_id, sku_code, uom, status)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        product_id = excluded.product_id,
        sku_code = excluded.sku_code,
        uom = excluded.uom,
        status = excluded.status
    `).run(
      skuId,
      productId,
      `DJI_${drone.id.toUpperCase()}`,
      'unit',
      'ACTIVE'
    );

    console.log(`✅ Seeded ${drone.model} (${coreSpecs.length} core specs, ${extraSpecs.length} extra specs, ${manuals.length} manuals)`);
  }

  console.log('🎉 Drones seeding completed!');
  db.close();
}

main()
  .catch((e) => {
    console.error('❌ Error seeding drones:', e);
    db.close();
    process.exit(1);
  });

