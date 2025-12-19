import { PrismaClient } from '../../generated/prisma/client';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// Path alla cartella DJI KB sul desktop
const DJI_KB_PATH = path.join(process.env.HOME || '', 'Desktop', 'DJI KB');

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
  const folderMap: { [key: string]: string } = {
    'mavic3m': 'mavic-3-m'
  };
  
  const folderName = folderMap[droneId] || droneId;
  const manualsPath = path.join(DJI_KB_PATH, 'manuals', 'pdfs', folderName);
  const manuals: any[] = [];
  
  try {
    if (fs.existsSync(manualsPath)) {
      const files = fs.readdirSync(manualsPath);
      files.forEach(file => {
        if (file.endsWith('.pdf')) {
          // URL relativo per il server Express (usa folderName per il path)
          const url = `/manuals/${folderName}/${file}`;
          manuals.push({
            url,
            filename: file,
            type: 'PDF',
            size: null
          });
        }
      });
    } else {
      console.warn(`⚠️  Manuals folder not found: ${manualsPath}`);
    }
  } catch (error) {
    console.warn(`⚠️  Could not read manuals for ${droneId}:`, error);
  }
  
  return manuals;
}

// Dati droni hardcoded con prezzi Lenzi
const DRONES = [
  {
    id: 't50',
    model: 'DJI Agras T50',
    price: 28500, // Prezzo Lenzi
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
    price: 16500, // Prezzo Lenzi
    category: 'Standard Industry',
    tagline: 'Rapporto Q/P eccellente',
    targetUse: 'Soluzione collaudata per aziende medie.',
    imageUrl: 'https://cdn.builder.io/api/v1/image/assets%2F2465e073f7c94097be8616ce134014fe%2Fd8d2c5c643ae4c44b415ab8d453b6b93?format=webp&width=800',
    glbFile: null, // Non abbiamo GLB per T30
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
    price: 32000, // Prezzo Lenzi
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
    price: 45000, // Prezzo Lenzi
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
    price: 12000, // Prezzo stimato Lenzi
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
    price: 14000, // Prezzo stimato Lenzi
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
    price: 8000, // Prezzo stimato Lenzi
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
  console.log('🌱 Starting drones seeding as Products...');

  // Prima creiamo l'organizzazione Lenzi (vendor)
  const lenziOrg = await prisma.organization.upsert({
    where: { id: 'org_lenzi' },
    update: {
      legal_name: 'Lenzi',
      org_type: 'VENDOR',
      status: 'ACTIVE'
    },
    create: {
      id: 'org_lenzi',
      legal_name: 'Lenzi',
      org_type: 'VENDOR',
      address_line: 'Via Example 1',
      city: 'Trento',
      province: 'TN',
      region: 'Trentino-Alto Adige',
      country: 'IT',
      status: 'ACTIVE'
    }
  });

  console.log('✅ Created/updated Lenzi organization');

  // Creiamo un price list per Lenzi
  const priceList = await prisma.priceList.upsert({
    where: { id: 'pl_lenzi_2025' },
    update: {
      name: 'Listino Lenzi 2025',
      currency: 'EUR',
      valid_from: new Date('2025-01-01'),
      valid_to: new Date('2025-12-31'),
      status: 'ACTIVE'
    },
    create: {
      id: 'pl_lenzi_2025',
      vendor_org_id: lenziOrg.id,
      name: 'Listino Lenzi 2025',
      currency: 'EUR',
      valid_from: new Date('2025-01-01'),
      valid_to: new Date('2025-12-31'),
      status: 'ACTIVE'
    }
  });

  console.log('✅ Created/updated price list');

  // Inseriamo ogni drone come Product + SKU + PriceListItem
  for (const drone of DRONES) {
    // Leggi specifiche core ed extra dai file JSON
    const coreSpecsPath = path.join(DJI_KB_PATH, 'products_specs_core', `${drone.id}.json`);
    const extraSpecsPath = path.join(DJI_KB_PATH, 'products_specs_extra', `${drone.id}.json`);
    const coreSpecs = readJSONFile(coreSpecsPath) || [];
    const extraSpecs = readJSONFile(extraSpecsPath) || [];
    
    // Leggi manuali PDF
    const manuals = readManualsPDFs(drone.id);
    
    // Crea Product
    const product = await prisma.product.upsert({
      where: { id: `prd_${drone.id}` },
      update: {
        product_type: 'DRONE',
        brand: 'DJI',
        model: drone.model,
        name: drone.model,
        specs_json: { ...drone.specs, category: drone.category, tagline: drone.tagline, targetUse: drone.targetUse, roi_months: drone.roi_months, efficiency_ha_per_hour: drone.efficiency_ha_per_hour },
        specs_core_json: coreSpecs,
        specs_extra_json: extraSpecs,
        images_json: drone.imageUrl ? [{ url: drone.imageUrl, alt: drone.model, is_primary: true }] : [],
        glb_files_json: drone.glbFile ? [{ url: drone.glbFile, filename: drone.glbFile.split('/').pop(), size: null }] : null,
        manuals_pdf_json: manuals.length > 0 ? manuals : null,
        status: 'ACTIVE'
      },
      create: {
        id: `prd_${drone.id}`,
        product_type: 'DRONE',
        brand: 'DJI',
        model: drone.model,
        name: drone.model,
        specs_json: { ...drone.specs, category: drone.category, tagline: drone.tagline, targetUse: drone.targetUse, roi_months: drone.roi_months, efficiency_ha_per_hour: drone.efficiency_ha_per_hour },
        specs_core_json: coreSpecs,
        specs_extra_json: extraSpecs,
        images_json: drone.imageUrl ? [{ url: drone.imageUrl, alt: drone.model, is_primary: true }] : [],
        glb_files_json: drone.glbFile ? [{ url: drone.glbFile, filename: drone.glbFile.split('/').pop(), size: null }] : null,
        manuals_pdf_json: manuals.length > 0 ? manuals : null,
        status: 'ACTIVE'
      }
    });

    // Crea SKU
    const sku = await prisma.sku.upsert({
      where: { id: `sku_${drone.id}` },
      update: {
        product_id: product.id,
        sku_code: `DJI_${drone.id.toUpperCase()}`,
        variant_tags: [],
        uom: 'unit',
        status: 'ACTIVE'
      },
      create: {
        id: `sku_${drone.id}`,
        product_id: product.id,
        sku_code: `DJI_${drone.id.toUpperCase()}`,
        variant_tags: [],
        uom: 'unit',
        status: 'ACTIVE'
      }
    });

    // Aggiungi al catalogo Lenzi
    await prisma.vendorCatalogItem.upsert({
      where: {
        vendor_org_id_sku_id: {
          vendor_org_id: lenziOrg.id,
          sku_id: sku.id
        }
      },
      update: {
        is_for_sale: true,
        is_for_rent: false,
        lead_time_days: 7
      },
      create: {
        vendor_org_id: lenziOrg.id,
        sku_id: sku.id,
        is_for_sale: true,
        is_for_rent: false,
        lead_time_days: 7
      }
    });

    // Aggiungi prezzo al listino
    await prisma.priceListItem.upsert({
      where: {
        price_list_id_sku_id: {
          price_list_id: priceList.id,
          sku_id: sku.id
        }
      },
      update: {
        price_cents: drone.price * 100 // Converti in centesimi
      },
      create: {
        price_list_id: priceList.id,
        sku_id: sku.id,
        price_cents: drone.price * 100 // Converti in centesimi
      }
    });

    console.log(`✅ Seeded ${drone.model} (${coreSpecs.length} core specs, ${extraSpecs.length} extra specs, ${manuals.length} manuals)`);
  }

  console.log('🎉 Drones seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding drones:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

