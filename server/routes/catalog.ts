import { RequestHandler } from "express";
import { handlePrismaError } from "../utils/error-handler";
import { prisma } from "../utils/prisma";

// Cache semplice per catalogo pubblico
let catalogCache: any = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti

// Catalogo pubblico - prodotti raggruppati per vendor
export const getPublicCatalog: RequestHandler = async (req, res) => {
  try {
    const now = Date.now();

    // Usa cache se valida
    if (catalogCache && (now - cacheTimestamp) < CACHE_DURATION) {
      return res.json(catalogCache);
    }

    const { category, vendor, minPrice, maxPrice } = req.query;

    // Costruisci filtro base
    const whereClause: any = {
      vendor_catalog_items: {
        some: {
          is_for_sale: true,
          vendor_org: {
            status: 'ACTIVE'
          }
        }
      }
    };

    // Filtro per categoria
    if (category && typeof category === 'string') {
      whereClause.product_type = category.toUpperCase();
    }

    // Filtro per vendor specifico
    if (vendor && typeof vendor === 'string') {
      whereClause.vendor_catalog_items = {
        some: {
          is_for_sale: true,
          vendor_org: {
            id: vendor
          }
        }
      };
    }

    // Filtro prezzo (se fornito)
    if (minPrice || maxPrice) {
      whereClause.vendor_catalog_items = {
        some: {
          is_for_sale: true,
          price_list_items: {
            some: {
              price_list: {
                status: 'ACTIVE'
              },
              price_cents: {
                ...(minPrice && { gte: parseInt(minPrice as string) * 100 }),
                ...(maxPrice && { lte: parseInt(maxPrice as string) * 100 })
              }
            }
          }
        }
      };
    }

    // Trova tutti i prodotti con vendor attivi
    const products = await prisma.sku.findMany({
      where: whereClause,
      include: {
        product: true,
        vendor_catalog_items: {
          where: { is_for_sale: true },
          include: {
            vendor_org: true,
            price_list_items: {
              where: {
                price_list: { status: 'ACTIVE' }
              },
              include: {
                price_list: true
              }
            }
          }
        },
        inventories: {
          include: {
            location: true
          }
        }
      }
    });

    // Raggruppa per vendor
    const vendorGroups: { [key: string]: any } = {};

    for (const sku of products) {
      for (const catalogItem of sku.vendor_catalog_items) {
        const vendor = catalogItem.vendor_org;
        const vendorId = vendor.id;

        if (!vendorGroups[vendorId]) {
          vendorGroups[vendorId] = {
            id: vendor.id,
            name: vendor.legal_name,
            logo: '/placeholder-logo.png', // TODO: aggiungere logo al modello Organization
            description: `Prodotti offerti da ${vendor.legal_name}`,
            products: []
          };
        }

        // Trova prezzo per questo vendor
        const priceItem = catalogItem.price_list_items[0];
        const price = priceItem ? priceItem.price_cents / 100 : 0;

        // Calcola stock totale
        const totalStock = sku.inventories.reduce((sum, inv) => sum + inv.qty_on_hand, 0);

        // Prepara dati prodotto
        const productData = {
          id: sku.id,
          skuCode: sku.sku_code,
          name: sku.product.name,
          model: sku.product.model,
          brand: sku.product.brand,
          category: sku.product.product_type,
          price: price,
          currency: 'EUR',
          stock: totalStock,
          leadTimeDays: catalogItem.lead_time_days,
          imageUrl: sku.product.images_json ? (sku.product.images_json as any)?.[0]?.url : null,
          glbUrl: sku.product.glb_files_json ? (sku.product.glb_files_json as any)?.[0]?.url : null,
          description: sku.product.name,
          specs: sku.product.specs_core_json,
          vendorNotes: catalogItem.notes
        };

        vendorGroups[vendorId].products.push(productData);
      }
    }

    // Converti in array e ordina per numero di prodotti (vendor più grandi prima)
    const vendors = Object.values(vendorGroups)
      .sort((a: any, b: any) => b.products.length - a.products.length);

    // Salva in cache
    catalogCache = { vendors };
    cacheTimestamp = now;

    res.json({ vendors });
  } catch (error: any) {
    console.error('Errore nel recupero catalogo pubblico:', error);

    // In caso di errore database, restituisci dati vuoti invece di errore
    // Questo previene il crash dell'interfaccia utente
    res.json({ vendors: [] });
  }
};

// Catalogo vendor - per gestione interna
export const getVendorCatalog: RequestHandler = async (req, res) => {
  try {
    const { orgId } = req.params;

    if (!orgId) {
      return res.status(400).json({ error: 'orgId richiesto' });
    }

    // Trova tutti i prodotti DJI
    const allSkus = await prisma.sku.findMany({
      where: { status: 'ACTIVE' },
      include: {
        product: true,
        vendor_catalog_items: {
          where: { vendor_org_id: orgId },
          include: {
            price_list_items: {
              include: {
                price_list: true
              }
            }
          }
        },
        inventories: {
          where: { vendor_org_id: orgId },
          include: {
            location: true
          }
        }
      }
    });

    // Trasforma per il frontend
    const catalog = allSkus.map(sku => {
      const catalogItem = sku.vendor_catalog_items[0];
      const priceItem = catalogItem?.price_list_items[0];
      const inventory = sku.inventories[0];

      return {
        id: sku.id,
        skuCode: sku.sku_code,
        productName: sku.product.name,
        productModel: sku.product.model,
        productType: sku.product.product_type,
        isActive: catalogItem?.is_for_sale || false,
        isForRent: catalogItem?.is_for_rent || false,
        price: priceItem ? priceItem.price_cents / 100 : null,
        leadTimeDays: catalogItem?.lead_time_days || null,
        stock: inventory?.qty_on_hand || 0,
        location: inventory?.location?.name || null,
        notes: catalogItem?.notes || null
      };
    });

    res.json({ catalog });
  } catch (error: any) {
    console.error('Errore nel recupero catalogo vendor:', error);
    handlePrismaError(error, res, { catalog: [] });
  }
};

// Toggle prodotto on/off per vendor
export const toggleVendorProduct: RequestHandler = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { skuId, isForSale } = req.body;

    if (!orgId || !skuId) {
      return res.status(400).json({ error: 'orgId e skuId richiesti' });
    }

    const catalogItem = await prisma.vendorCatalogItem.upsert({
      where: {
        vendor_org_id_sku_id: {
          vendor_org_id: orgId,
          sku_id: skuId
        }
      },
      update: {
        is_for_sale: isForSale
      },
      create: {
        vendor_org_id: orgId,
        sku_id: skuId,
        is_for_sale: isForSale,
        is_for_rent: false,
        lead_time_days: 7
      }
    });

    res.json({ success: true, catalogItem });
  } catch (error: any) {
    console.error('Errore nel toggle prodotto:', error);
    handlePrismaError(error, res, null);
  }
};

// Aggiorna prezzo e lead time per vendor
export const updateVendorProduct: RequestHandler = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { skuId, price, leadTimeDays, notes } = req.body;

    if (!orgId || !skuId) {
      return res.status(400).json({ error: 'orgId e skuId richiesti' });
    }

    // Prima aggiorna/ottieni catalog item
    const catalogItem = await prisma.vendorCatalogItem.upsert({
      where: {
        vendor_org_id_sku_id: {
          vendor_org_id: orgId,
          sku_id: skuId
        }
      },
      update: {
        lead_time_days: leadTimeDays,
        notes: notes
      },
      create: {
        vendor_org_id: orgId,
        sku_id: skuId,
        is_for_sale: true,
        is_for_rent: false,
        lead_time_days: leadTimeDays || 7,
        notes: notes
      }
    });

    // Poi aggiorna prezzo se fornito
    if (price !== undefined) {
      // Trova price list del vendor
      const priceList = await prisma.priceList.findFirst({
        where: { vendor_org_id: orgId, status: 'ACTIVE' }
      });

      if (priceList) {
        await prisma.priceListItem.upsert({
          where: {
            price_list_id_sku_id: {
              price_list_id: priceList.id,
              sku_id: skuId
            }
          },
          update: {
            price_cents: price * 100 // Converti in centesimi
          },
          create: {
            price_list_id: priceList.id,
            sku_id: skuId,
            price_cents: price * 100,
            tax_code: '22'
          }
        });
      }
    }

    res.json({ success: true, catalogItem });
  } catch (error: any) {
    console.error('Errore nell\'aggiornamento prodotto:', error);
    handlePrismaError(error, res, null);
  }
};

// Inizializza database con dati di test (solo per sviluppo)
export const setupTestData: RequestHandler = async (req, res) => {
  try {
    console.log("🔄 Creazione dati di test...");

    // 1. Crea organizzazione Lenzi
    const lenziOrg = await prisma.organization.upsert({
      where: { id: "lenzi-org-id" },
      update: {},
      create: {
        id: "lenzi-org-id",
        legal_name: "Lenzi Agricola Srl",
        vat_number: "12345678901",
        org_type: "VENDOR",
        address_line: "Via Roma 123",
        city: "Bologna",
        province: "BO",
        region: "Emilia-Romagna",
        country: "IT",
        status: "ACTIVE"
      }
    });

    // 2. Crea utente admin per Lenzi
    const lenziUser = await prisma.user.upsert({
      where: { email: "admin@lenzi.it" },
      update: {},
      create: {
        email: "admin@lenzi.it",
        first_name: "Mario",
        last_name: "Lenzi",
        password_hash: "$2b$10$dummy.hash.for.testing.purposes.only", // Hash dummy
        status: "ACTIVE",
        email_verified: true
      }
    });

    // 3. Crea membership
    await prisma.orgMembership.upsert({
      where: {
        org_id_user_id: {
          org_id: lenziOrg.id,
          user_id: lenziUser.id
        }
      },
      update: {},
      create: {
        org_id: lenziOrg.id,
        user_id: lenziUser.id,
        role: "VENDOR_ADMIN"
      }
    });

    // 4. Crea prodotti DJI
    const products = [
      {
        id: "t30",
        name: "DJI Agras T30",
        model: "T30",
        product_type: "DRONE",
        specs_core_json: {
          spray_tank_capacity_l: 30,
          max_takeoff_weight_kg: 36.4,
          flight_time_min: 20.5
        },
        images_json: ["/DJI KB/specs core/products_specs_core/t30/image.jpg"],
        glb_files_json: ["/DJI KB/glb/T30.glb"]
      },
      {
        id: "t25",
        name: "DJI Agras T25",
        model: "T25",
        product_type: "DRONE",
        specs_core_json: {
          spray_tank_capacity_l: 20,
          max_takeoff_weight_kg: 25.4,
          flight_time_min: 15.6
        },
        images_json: ["/DJI KB/specs core/products_specs_core/t25/image.jpg"],
        glb_files_json: ["/DJI KB/glb/T25.glb"]
      },
      {
        id: "t50",
        name: "DJI Agras T50",
        model: "T50",
        product_type: "DRONE",
        specs_core_json: {
          spray_tank_capacity_l: 40,
          max_takeoff_weight_kg: 52.2,
          flight_time_min: 18.5
        },
        images_json: ["/DJI KB/specs core/products_specs_core/t50/image.jpg"],
        glb_files_json: ["/DJI KB/glb/T50.glb"]
      }
    ];

    for (const productData of products) {
      await prisma.product.upsert({
        where: { id: productData.id },
        update: {},
        create: productData
      });
    }

    // 5. Crea SKU per ogni prodotto
    const skus = [
      { product_id: "t30", sku_code: "T30-STD", name: "DJI Agras T30 Standard" },
      { product_id: "t25", sku_code: "T25-STD", name: "DJI Agras T25 Standard" },
      { product_id: "t50", sku_code: "T50-STD", name: "DJI Agras T50 Standard" }
    ];

    for (const skuData of skus) {
      await prisma.sku.upsert({
        where: { sku_code: skuData.sku_code },
        update: {},
        create: {
          ...skuData,
          status: "ACTIVE"
        }
      });
    }

    // 6. Crea listino prezzi per Lenzi
    const priceList = await prisma.priceList.upsert({
      where: {
        vendor_org_id_name: {
          vendor_org_id: lenziOrg.id,
          name: "Listino Standard"
        }
      },
      update: {},
      create: {
        vendor_org_id: lenziOrg.id,
        name: "Listino Standard",
        currency: "EUR",
        status: "ACTIVE",
        valid_from: new Date(),
        valid_to: new Date(new Date().getFullYear() + 1, 11, 31)
      }
    });

    // 7. Crea prezzi
    const prices = [
      { sku_code: "T30-STD", price_cents: 1850000 }, // €18,500
      { sku_code: "T25-STD", price_cents: 1280000 }, // €12,800
      { sku_code: "T50-STD", price_cents: 2420000 }  // €24,200
    ];

    for (const priceData of prices) {
      await prisma.priceListItem.upsert({
        where: {
          price_list_id_sku_code: {
            price_list_id: priceList.id,
            sku_code: priceData.sku_code
          }
        },
        update: {},
        create: {
          price_list_id: priceList.id,
          sku_code: priceData.sku_code,
          price_cents: priceData.price_cents,
          tax_code: "22"
        }
      });
    }

    // 8. Crea location
    const location = await prisma.location.upsert({
      where: {
        org_id_name: {
          org_id: lenziOrg.id,
          name: "Magazzino Principale"
        }
      },
      update: {},
      create: {
        org_id: lenziOrg.id,
        name: "Magazzino Principale",
        address: "Via Roma 123",
        city: "Bologna",
        province: "BO",
        country: "IT"
      }
    });

    // 9. Crea VendorCatalogItem (prodotti attivi nel catalogo)
    for (const skuData of skus) {
      await prisma.vendorCatalogItem.upsert({
        where: {
          vendor_org_id_sku_id: {
            vendor_org_id: lenziOrg.id,
            sku_id: skuData.sku_code
          }
        },
        update: {},
        create: {
          vendor_org_id: lenziOrg.id,
          sku_id: skuData.sku_code,
          is_for_sale: true,
          is_for_rent: false,
          lead_time_days: 7,
          notes: `Prodotto ${skuData.name} disponibile`
        }
      });

      // 10. Crea inventory
      await prisma.inventory.upsert({
        where: {
          vendor_org_id_location_id_sku_id: {
            vendor_org_id: lenziOrg.id,
            location_id: location.id,
            sku_id: skuData.sku_code
          }
        },
        update: {},
        create: {
          vendor_org_id: lenziOrg.id,
          location_id: location.id,
          sku_id: skuData.sku_code,
          qty_on_hand: 5, // 5 unità disponibili
          qty_reserved: 0
        }
      });
    }

    res.json({
      success: true,
      message: "Dati di test creati con successo!",
      data: {
        organization: lenziOrg,
        products: products.length,
        skus: skus.length,
        inventory: "5 unità per prodotto"
      }
    });

  } catch (error: any) {
    console.error("❌ Errore nella creazione dei dati:", error);
    handlePrismaError(error, res, null);
  }
};

// Inizializza catalogo vendor con tutti i prodotti disponibili
// Endpoint speciale per inizializzare automaticamente il catalogo Lenzi
export const initializeLenziCatalog: RequestHandler = async (req, res) => {
  try {
    // Invece di usare Prisma direttamente, eseguiamo lo script CLI
    const { spawn } = await import('child_process');
    const { promisify } = await import('util');
    const { pipeline } = await import('stream');

    console.log('🚀 Avvio script CLI per inizializzazione Lenzi...');

    // Esegui lo script CLI
    const child = spawn('node', ['scripts/init-lenzi.mjs'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    let stdout = '';
    let stderr = '';

    // Cattura output
    child.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('📄', data.toString().trim());
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error('⚠️', data.toString().trim());
    });

    // Gestisci completamento
    child.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Script completato con successo');
        res.json({
          success: true,
          message: 'Catalogo Lenzi inizializzato con successo',
          output: stdout,
          details: 'Tutti i prodotti DJI sono stati aggiunti al catalogo con 2 unità in stock ciascuno'
        });
      } else {
        console.error('❌ Script fallito con codice:', code);
        res.status(500).json({
          success: false,
          message: 'Errore nell\'inizializzazione del catalogo',
          error: stderr,
          code: code
        });
      }
    });

    child.on('error', (error) => {
      console.error('❌ Errore esecuzione script:', error);
      res.status(500).json({
        success: false,
        message: 'Errore nell\'esecuzione dello script',
        error: error.message
      });
    });

  } catch (error: any) {
    console.error('Errore nell\'endpoint initializeLenziCatalog:', error);
    res.status(500).json({
      success: false,
      message: 'Errore interno del server',
      error: error.message
    });
  }
};

export const initializeVendorCatalog: RequestHandler = async (req, res) => {
  try {
    const { orgId } = req.params;

    if (!orgId) {
      return res.status(400).json({ error: 'orgId richiesto' });
    }

    // Trova tutti gli SKU attivi
    const allSkus = await prisma.sku.findMany({
      where: { status: 'ACTIVE' },
      include: { product: true }
    });

    // Crea price list se non esiste
    let priceList = await prisma.priceList.findFirst({
      where: {
        vendor_org_id: orgId,
        name: 'Listino Standard',
        status: 'ACTIVE'
      }
    });

    if (!priceList) {
      priceList = await prisma.priceList.create({
        data: {
          vendor_org_id: orgId,
          name: 'Listino Standard',
          currency: 'EUR',
          status: 'ACTIVE',
          valid_from: new Date(),
          valid_to: new Date(new Date().getFullYear() + 1, 11, 31) // Fine anno prossimo
        }
      });
    }

    // Crea location se non esiste
    let location = await prisma.location.findFirst({
      where: {
        org_id: orgId,
        name: 'Magazzino Principale'
      }
    });

    if (!location) {
      location = await prisma.location.create({
        data: {
          org_id: orgId,
          name: 'Magazzino Principale',
          address_json: {
            address_line: 'Via del Magazzino 1',
            city: 'Città',
            province: 'XX',
            country: 'IT'
          }
        }
      });
    }

    // Per ogni SKU, inizializza catalog item, price e inventory
    const results = [];
    for (const sku of allSkus) {
      // 1. VendorCatalogItem
      const catalogItem = await prisma.vendorCatalogItem.upsert({
        where: {
          vendor_org_id_sku_id: {
            vendor_org_id: orgId,
            sku_id: sku.id
          }
        },
        update: {},
        create: {
          vendor_org_id: orgId,
          sku_id: sku.id,
          is_for_sale: true, // Tutti i prodotti attivi per Lenzi
          is_for_rent: false,
          lead_time_days: sku.product.model?.includes('T30') ? 7 :
                         sku.product.model?.includes('T25') ? 5 :
                         sku.product.model?.includes('T50') ? 10 : 3,
          notes: `Prodotto ${sku.product.name} - ${sku.product.model}`
        }
      });

      // 2. PriceListItem con prezzi di default
      const basePrice = sku.product.model?.includes('T30') ? 18500 :
                       sku.product.model?.includes('T25') ? 12800 :
                       sku.product.model?.includes('T50') ? 24200 :
                       sku.product.name?.toLowerCase().includes('batter') ? 850 :
                       sku.product.name?.toLowerCase().includes('accessor') ? 1200 : 1500;

      const priceItem = await prisma.priceListItem.upsert({
        where: {
          price_list_id_sku_id: {
            price_list_id: priceList.id,
            sku_id: sku.id
          }
        },
        update: {},
        create: {
          price_list_id: priceList.id,
          sku_id: sku.id,
          price_cents: basePrice * 100,
          tax_code: '22'
        }
      });

      // 3. Inventory con stock 0 iniziale
      const inventory = await prisma.inventory.upsert({
        where: {
          vendor_org_id_location_id_sku_id: {
            vendor_org_id: orgId,
            location_id: location.id,
            sku_id: sku.id
          }
        },
        update: {},
        create: {
          vendor_org_id: orgId,
          location_id: location.id,
          sku_id: sku.id,
          qty_on_hand: 2, // 2 unità per prodotto come richiesto
          qty_reserved: 0
        }
      });

      results.push({
        sku: sku.sku_code,
        product: sku.product.name,
        catalogItem,
        priceItem,
        inventory
      });
    }

    res.json({
      success: true,
      message: `Catalogo inizializzato con ${allSkus.length} prodotti`,
      results
    });
  } catch (error: any) {
    console.error('Errore nell\'inizializzazione catalogo:', error);
    handlePrismaError(error, res, null);
  }
};

// Endpoint semplice per creare solo le vendor_catalog_items mancanti
export const createVendorCatalogItems: RequestHandler = async (req, res) => {
  try {
    const { orgId } = req.params;

    if (!orgId) {
      return res.status(400).json({ error: 'orgId richiesto' });
    }

    // Trova tutti gli SKU attivi
    const allSkus = await prisma.sku.findMany({
      where: { status: 'ACTIVE' },
      include: { product: true }
    });

    const results = [];
    for (const sku of allSkus) {
      // Crea vendor_catalog_item se non esiste
      const catalogItem = await prisma.vendorCatalogItem.upsert({
        where: {
          vendor_org_id_sku_id: {
            vendor_org_id: orgId,
            sku_id: sku.id
          }
        },
        update: {},
        create: {
          vendor_org_id: orgId,
          sku_id: sku.id,
          is_for_sale: true,
          is_for_rent: false,
          lead_time_days: 7,
          notes: `Prodotto ${sku.product.name} - ${sku.product.model}`
        }
      });

      results.push({
        sku: sku.sku_code,
        product: sku.product.name,
        catalogItem
      });
    }

    res.json({
      success: true,
      message: `Creati ${results.length} catalog items`,
      results
    });
  } catch (error: any) {
    console.error('Errore nella creazione catalog items:', error);
    handlePrismaError(error, res, null);
  }
};
