import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

// Dati estratti da Index.tsx
const GIS_CATEGORIES = [
  {
    id: 'estensive',
    name: 'Seminativi',
    icon: '🌾',
    description: 'Mais, Riso, Grano, Soia'
  },
  {
    id: 'vigna',
    name: 'Vigneto & Frutteto',
    icon: '🍇',
    description: 'Vite, Ulivo, Frutteto'
  },
  {
    id: 'orto',
    name: 'Orticole',
    icon: '🍅',
    description: 'Pomodoro, Serre, Patata'
  }
];

const TREATMENTS = [
  {
    id: 'diserbo-pre',
    name: 'Diserbo Pre-Emergenza',
    categoryId: 'estensive',
    type: 'liquid',
    targetCrops: ['mais-granella', 'mais-trinciato', 'riso'],
    dosage: '30-40 L/ha',
    operatingSpeed: 11,
    marketPriceMin: 45,
    marketPriceMax: 55
  },
  {
    id: 'fungicida-insetticida',
    name: 'Fungicida / Insetticida',
    categoryId: 'estensive',
    type: 'liquid',
    targetCrops: ['grano-tenero', 'mais-granella'],
    dosage: '15-20 L/ha',
    operatingSpeed: 19,
    marketPriceMin: 35,
    marketPriceMax: 45
  },
  {
    id: 'vigneto-peronospora',
    name: 'Trattamento Vigneto (Peronospora)',
    categoryId: 'vigna',
    type: 'liquid',
    targetCrops: ['vigneto'],
    dosage: '40-60 L/ha',
    operatingSpeed: 5,
    marketPriceMin: 80,
    marketPriceMax: 120
  },
  {
    id: 'disseccante',
    name: 'Disseccante',
    categoryId: 'orto',
    type: 'liquid',
    targetCrops: ['pomodoro'],
    dosage: '20 L/ha',
    operatingSpeed: 15,
    marketPriceMin: 40,
    marketPriceMax: 50
  },
  {
    id: 'lotta-biologica',
    name: 'Lotta Biologica (Capsule Piralide)',
    categoryId: 'estensive',
    type: 'solid',
    targetCrops: ['mais-granella', 'mais-trinciato'],
    dosage: '< 1 kg/ha',
    operatingSpeed: 35,
    marketPriceMin: 20,
    marketPriceMax: 25
  },
  {
    id: 'semina-cover',
    name: 'Semina Cover Crops',
    categoryId: 'estensive',
    type: 'solid',
    targetCrops: ['mais-granella', 'grano-tenero'],
    dosage: '20-30 kg/ha',
    operatingSpeed: 15,
    marketPriceMin: 30,
    marketPriceMax: 40
  }
];

const CROPS = [
  {
    id: 'mais-granella',
    name: 'Mais (Granella)',
    yieldPerHa: 13.0,
    marketPrice: 220,
    grossRevenue: 2860,
    tramplingImpact: 0.045,
    tramplingEnabled: true
  },
  {
    id: 'mais-trinciato',
    name: 'Mais (Trinciato)',
    yieldPerHa: 60.0,
    marketPrice: 55,
    grossRevenue: 3300,
    tramplingImpact: 0.045,
    tramplingEnabled: true
  },
  {
    id: 'riso',
    name: 'Riso',
    yieldPerHa: 7.0,
    marketPrice: 450,
    grossRevenue: 3150,
    tramplingImpact: 0.025,
    tramplingEnabled: true
  },
  {
    id: 'grano-tenero',
    name: 'Grano Tenero',
    yieldPerHa: 7.5,
    marketPrice: 230,
    grossRevenue: 1725,
    tramplingImpact: 0.03,
    tramplingEnabled: true
  },
  {
    id: 'vigneto',
    name: 'Vigneto (Collina)',
    yieldPerHa: 10.0,
    marketPrice: 600,
    grossRevenue: 6000,
    tramplingImpact: 0,
    tramplingEnabled: false
  },
  {
    id: 'pomodoro',
    name: 'Pomodoro',
    yieldPerHa: 80.0,
    marketPrice: 110,
    grossRevenue: 8800,
    tramplingImpact: 0.05,
    tramplingEnabled: true
  }
];

const DRONES = [
  {
    id: 't50',
    model: 'DJI Agras T50',
    price: 28500,
    category: 'Flagship (Top Gamma)',
    tagline: 'Efficienza massima per grandi estensioni',
    targetUse: 'Grandi estensioni, Cerealicoltura intensiva. Efficienza massima.',
    imageUrl: 'https://cdn.builder.io/api/v1/image/assets%2F2465e073f7c94097be8616ce134014fe%2F58d74d38d1fb4075a2b3a226cc229907?format=webp&width=800',
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
    specs: {
      tank: 'Capacità Record (100L stima)',
      battery: 'N/A',
      efficiency: '40 ha/h',
      feature: 'Autonomia estesa + Mappatura Cloud integrata'
    },
    roi_months: 10,
    efficiency_ha_per_hour: 40
  }
];

const AFFILIATES = [
  { name: 'AgriFly Veneto', region: 'Veneto', zone: 'Nord-Est', status: 'active', jobs_done: 124, rating: 4.9 },
  { name: 'Droni Toscana Srl', region: 'Toscana', zone: 'Centro', status: 'busy', jobs_done: 89, rating: 4.7 },
  { name: 'Sud Tech', region: 'Puglia', zone: 'Sud', status: 'active', jobs_done: 45, rating: 4.5 },
  { name: 'Piemonte Agri Drones', region: 'Piemonte', zone: 'Nord-Ovest', status: 'active', jobs_done: 67, rating: 4.8 },
  { name: 'Emilia Precision', region: 'Emilia-Romagna', zone: 'Nord', status: 'offline', jobs_done: 112, rating: 4.9 },
];

async function main() {
  console.log('🌱 Starting database seeding...');

  // Seed GIS Categories (upsert per evitare duplicati)
  for (const category of GIS_CATEGORIES) {
    await prisma.gisCategory.upsert({
      where: { id: category.id },
      update: {
        name: category.name,
        icon: category.icon,
        description: category.description
      },
      create: {
        id: category.id,
        name: category.name,
        icon: category.icon,
        description: category.description
      }
    });
  }
  console.log('✅ Seeded GIS categories');

  // Seed Crops (prima dei treatments perché sono referenziati)
  for (const crop of CROPS) {
    await prisma.crop.upsert({
      where: { id: crop.id },
      update: {
        name: crop.name,
        yieldPerHa: crop.yieldPerHa,
        marketPrice: crop.marketPrice,
        grossRevenue: crop.grossRevenue,
        tramplingImpact: crop.tramplingImpact,
        tramplingEnabled: crop.tramplingEnabled
      },
      create: {
        id: crop.id,
        name: crop.name,
        yieldPerHa: crop.yieldPerHa,
        marketPrice: crop.marketPrice,
        grossRevenue: crop.grossRevenue,
        tramplingImpact: crop.tramplingImpact,
        tramplingEnabled: crop.tramplingEnabled
      }
    });
  }
  console.log('✅ Seeded crops');

  // Seed Treatments
  for (const treatment of TREATMENTS) {
    await prisma.treatment.upsert({
      where: { id: treatment.id },
      update: {
        name: treatment.name,
        type: treatment.type,
        targetCrops: JSON.stringify(treatment.targetCrops), // JSON array di crop IDs
        dosage: treatment.dosage,
        operatingSpeed: treatment.operatingSpeed,
        marketPriceMin: treatment.marketPriceMin,
        marketPriceMax: treatment.marketPriceMax,
        categoryId: treatment.categoryId
      },
      create: {
        id: treatment.id,
        name: treatment.name,
        type: treatment.type,
        targetCrops: JSON.stringify(treatment.targetCrops), // JSON array di crop IDs
        dosage: treatment.dosage,
        operatingSpeed: treatment.operatingSpeed,
        marketPriceMin: treatment.marketPriceMin,
        marketPriceMax: treatment.marketPriceMax,
        categoryId: treatment.categoryId
      }
    });
  }
  console.log('✅ Seeded treatments');

  // NOTE: Drones e Affiliates ora sono gestiti tramite le nuove tabelle:
  // - Drones → Products/SKUs (da popolare separatamente)
  // - Affiliates → OperatorProfiles (da popolare separatamente)
  console.log('ℹ️  Drones e Affiliates devono essere popolati tramite le nuove tabelle Products/OperatorProfiles');

  console.log('🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
