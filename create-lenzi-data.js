import { PrismaClient } from './generated/prisma/client.js';

const prisma = new PrismaClient();

async function createLenziData() {
  try {
    console.log('🚀 Creazione dati Lenzi nel database SQLite...');

    // 1. Crea organizzazione Lenzi
    const lenziOrg = await prisma.organization.upsert({
      where: { id: 'lenzi-org-id' },
      update: {},
      create: {
        id: 'lenzi-org-id',
        legal_name: 'Lenzi Agricola Srl',
        vat_number: '12345678901',
        org_type: 'VENDOR',
        address_line: 'Via Roma 123',
        city: 'Verona',
        province: 'VR',
        region: 'Veneto',
        country: 'IT',
        status: 'ACTIVE'
      }
    });
    console.log('✅ Organizzazione Lenzi creata:', lenziOrg.legal_name);

    // 2. Crea alcuni prodotti DJI di base
    const products = [
      {
        id: 't30',
        name: 'DJI Agras T30',
        model: 'T30',
        product_type: 'DRONE',
        brand: 'DJI',
        status: 'ACTIVE'
      },
      {
        id: 't25',
        name: 'DJI Agras T25',
        model: 'T25',
        product_type: 'DRONE',
        brand: 'DJI',
        status: 'ACTIVE'
      },
      {
        id: 't50',
        name: 'DJI Agras T50',
        model: 'T50',
        product_type: 'DRONE',
        brand: 'DJI',
        status: 'ACTIVE'
      },
      {
        id: 'battery-t30',
        name: 'Battery DJI Agras T30',
        model: 'TB30',
        product_type: 'BATTERY',
        brand: 'DJI',
        status: 'ACTIVE'
      },
      {
        id: 'battery-t50',
        name: 'Battery DJI Agras T50',
        model: 'TB50',
        product_type: 'BATTERY',
        brand: 'DJI',
        status: 'ACTIVE'
      }
    ];

    for (const product of products) {
      await prisma.product.upsert({
        where: { id: product.id },
        update: {},
        create: product
      });
    }
    console.log('✅ Prodotti DJI creati:', products.length);

    // 3. Crea SKU per ogni prodotto
    const skus = [
      { id: 't30-std', product_id: 't30', sku_code: 'T30-STD' },
      { id: 't25-std', product_id: 't25', sku_code: 'T25-STD' },
      { id: 't50-std', product_id: 't50', sku_code: 'T50-STD' },
      { id: 'tb30-std', product_id: 'battery-t30', sku_code: 'TB30-STD' },
      { id: 'tb50-std', product_id: 'battery-t50', sku_code: 'TB50-STD' }
    ];

    for (const sku of skus) {
      await prisma.sku.upsert({
        where: { sku_code: sku.sku_code },
        update: {},
        create: {
          ...sku,
          status: 'ACTIVE'
        }
      });
    }
    console.log('✅ SKU creati:', skus.length);

    // 4. Crea location per Lenzi
    const location = await prisma.location.upsert({
      where: {
        org_id_name: {
          org_id: lenziOrg.id,
          name: 'Sede Principale'
        }
      },
      update: {},
      create: {
        org_id: lenziOrg.id,
        name: 'Sede Principale',
        address_json: JSON.stringify({
          street: 'Via Roma 123',
          city: 'Verona',
          province: 'VR',
          region: 'Veneto'
        }),
        city: 'Verona',
        province: 'VR',
        region: 'Veneto',
        country: 'IT'
      }
    });
    console.log('✅ Location creata:', location.name);

    // 5. Crea price list per Lenzi
    const priceList = await prisma.priceList.upsert({
      where: {
        vendor_org_id_name: {
          vendor_org_id: lenziOrg.id,
          name: 'Listino Standard 2025'
        }
      },
      update: {},
      create: {
        vendor_org_id: lenziOrg.id,
        name: 'Listino Standard 2025',
        currency: 'EUR',
        valid_from: new Date('2025-01-01'),
        valid_to: new Date('2025-12-31'),
        status: 'ACTIVE'
      }
    });
    console.log('✅ Price list creata:', priceList.name);

    // 6. Aggiungi tutti i prodotti al catalogo vendor (con is_for_sale = true)
    let catalogCount = 0;
    for (const sku of skus) {
      await prisma.vendorCatalogItem.upsert({
        where: {
          vendor_org_id_sku_id: {
            vendor_org_id: lenziOrg.id,
            sku_id: sku.id
          }
        },
        update: {},
        create: {
          vendor_org_id: lenziOrg.id,
          sku_id: sku.id,
          is_for_sale: true,
          is_for_rent: false,
          lead_time_days: 7,
          notes: `Prodotto ${sku.sku_code} disponibile nel catalogo Lenzi`
        }
      });
      catalogCount++;
    }
    console.log('✅ Prodotti aggiunti al catalogo:', catalogCount);

    // 7. Crea inventory con 2 unità per ogni prodotto
    let inventoryCount = 0;
    for (const sku of skus) {
      await prisma.inventory.upsert({
        where: {
          vendor_org_id_location_id_sku_id: {
            vendor_org_id: lenziOrg.id,
            location_id: location.id,
            sku_id: sku.id
          }
        },
        update: {},
        create: {
          vendor_org_id: lenziOrg.id,
          location_id: location.id,
          sku_id: sku.id,
          qty_on_hand: 2,
          qty_reserved: 0
        }
      });
      inventoryCount++;
    }
    console.log('✅ Inventory creato con 2 unità per prodotto:', inventoryCount);

    // 8. Aggiungi prezzi
    const prices = [
      { sku_id: 't30-std', price_cents: 2500000 }, // €25,000
      { sku_id: 't25-std', price_cents: 1800000 }, // €18,000
      { sku_id: 't50-std', price_cents: 3000000 }, // €30,000
      { sku_id: 'tb30-std', price_cents: 150000 }, // €1,500
      { sku_id: 'tb50-std', price_cents: 200000 }  // €2,000
    ];

    let priceCount = 0;
    for (const price of prices) {
      await prisma.priceListItem.upsert({
        where: {
          price_list_id_sku_id: {
            price_list_id: priceList.id,
            sku_id: price.sku_id
          }
        },
        update: {},
        create: {
          price_list_id: priceList.id,
          sku_id: price.sku_id,
          price_cents: price.price_cents,
          tax_code: '22'
        }
      });
      priceCount++;
    }
    console.log('✅ Prezzi aggiunti:', priceCount);

    console.log('\n🎉 Database popolato con successo!');
    console.log('📊 Riepilogo:');
    console.log(`   • Organizzazione: ${lenziOrg.legal_name}`);
    console.log(`   • Prodotti: ${products.length}`);
    console.log(`   • SKU: ${skus.length}`);
    console.log(`   • Catalogo: ${catalogCount} prodotti attivi`);
    console.log(`   • Stock totale: ${inventoryCount * 2} unità`);
    console.log(`   • Prezzi: ${priceCount}`);

  } catch (error) {
    console.error('❌ Errore nella creazione dei dati:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createLenziData();
