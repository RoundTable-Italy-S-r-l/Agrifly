const { PrismaClient } = require('./generated/prisma/client');

async function setupLenziCatalog() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Cercando organizzazione Lenzi...');
    
    // Trova l'organizzazione Lenzi
    const lenziOrg = await prisma.organization.findFirst({
      where: { legal_name: { contains: 'Lenzi' } }
    });
    
    if (!lenziOrg) {
      throw new Error('Organizzazione Lenzi non trovata');
    }
    
    console.log(`✅ Trovata organizzazione: ${lenziOrg.legal_name} (ID: ${lenziOrg.id})`);
    
    // Trova tutti i prodotti attivi
    const products = await prisma.product.findMany({
      where: { status: 'ACTIVE' },
      include: { skus: { where: { status: 'ACTIVE' } } }
    });
    
    console.log(`📦 Trovati ${products.length} prodotti con SKU attivi`);
    
    // Crea una location se non esiste
    let location = await prisma.location.findFirst({
      where: { 
        org_id: lenziOrg.id,
        name: 'Sede Principale'
      }
    });
    
    if (!location) {
      location = await prisma.location.create({
        data: {
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
      console.log('🏢 Creata location principale');
    }
    
    // Aggiungi tutti i prodotti al catalogo vendor
    let catalogCount = 0;
    for (const product of products) {
      for (const sku of product.skus) {
        // Verifica se già esiste
        const existing = await prisma.vendorCatalogItem.findUnique({
          where: {
            vendor_org_id_sku_id: {
              vendor_org_id: lenziOrg.id,
              sku_id: sku.id
            }
          }
        });
        
        if (!existing) {
          await prisma.vendorCatalogItem.create({
            data: {
              vendor_org_id: lenziOrg.id,
              sku_id: sku.id,
              is_for_sale: true,
              is_for_rent: false,
              lead_time_days: 7,
              notes: 'Prodotto disponibile nel catalogo Lenzi'
            }
          });
          catalogCount++;
        }
        
        // Aggiungi al magazzino
        const existingInventory = await prisma.inventory.findUnique({
          where: {
            vendor_org_id_location_id_sku_id: {
              vendor_org_id: lenziOrg.id,
              location_id: location.id,
              sku_id: sku.id
            }
          }
        });
        
        if (!existingInventory) {
          await prisma.inventory.create({
            data: {
              vendor_org_id: lenziOrg.id,
              location_id: location.id,
              sku_id: sku.id,
              qty_on_hand: 2,
              qty_reserved: 0
            }
          });
        }
      }
    }
    
    console.log(`✅ Aggiunti ${catalogCount} prodotti al catalogo`);
    
    // Crea una price list se non esiste
    let priceList = await prisma.priceList.findFirst({
      where: {
        vendor_org_id: lenziOrg.id,
        name: 'Listino Standard 2025'
      }
    });
    
    if (!priceList) {
      priceList = await prisma.priceList.create({
        data: {
          vendor_org_id: lenziOrg.id,
          name: 'Listino Standard 2025',
          currency: 'EUR',
          valid_from: new Date('2025-01-01'),
          valid_to: new Date('2025-12-31'),
          status: 'ACTIVE'
        }
      });
      console.log('💰 Creata price list');
    }
    
    // Aggiungi prezzi per tutti i prodotti
    let priceCount = 0;
    for (const product of products) {
      for (const sku of product.skus) {
        const existingPrice = await prisma.priceListItem.findFirst({
          where: {
            price_list_id: priceList.id,
            sku_id: sku.id
          }
        });
        
        if (!existingPrice) {
          // Determina il prezzo in base al tipo di prodotto
          let priceCents = 100000; // Default 1000€
          if (product.product_type === 'DRONE') {
            priceCents = 2500000; // 25,000€
          } else if (product.product_type === 'BATTERY') {
            priceCents = 150000; // 1,500€
          } else if (product.product_type === 'SPARE') {
            priceCents = 50000; // 500€
          }
          
          await prisma.priceListItem.create({
            data: {
              price_list_id: priceList.id,
              sku_id: sku.id,
              price_cents: priceCents,
              tax_code: '22',
              constraints_json: JSON.stringify({
                min_qty: 1,
                max_qty: 10
              })
            }
          });
          priceCount++;
        }
      }
    }
    
    console.log(`💵 Aggiunti ${priceCount} prezzi`);
    
    // Verifica finale
    const catalogStats = await prisma.vendorCatalogItem.count({
      where: { vendor_org_id: lenziOrg.id }
    });
    
    const inventoryStats = await prisma.inventory.aggregate({
      where: { vendor_org_id: lenziOrg.id },
      _sum: { qty_on_hand: true }
    });
    
    const priceStats = await prisma.priceListItem.count({
      where: {
        price_list: {
          vendor_org_id: lenziOrg.id
        }
      }
    });
    
    console.log('\n📊 RIEPILOGO FINALE:');
    console.log(`   Catalogo: ${catalogStats} prodotti`);
    console.log(`   Inventario: ${inventoryStats._sum.qty_on_hand || 0} unità totali`);
    console.log(`   Prezzi: ${priceStats} prodotti`);
    
    console.log('\n✅ Setup completato con successo!');
    
  } catch (error) {
    console.error('❌ Errore durante il setup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

setupLenziCatalog();
