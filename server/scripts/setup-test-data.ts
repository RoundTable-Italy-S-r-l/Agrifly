import { PrismaClient } from "../../generated/prisma/client";

const prisma = new PrismaClient();

async function setupTestData() {
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

    console.log("✅ Dati di test creati con successo!");
    console.log("📊 Riepilogo:");
    console.log("- Organizzazione: Lenzi Agricola Srl");
    console.log("- Prodotti: T30, T25, T50");
    console.log("- Prezzi configurati");
    console.log("- Catalogo attivo con 5 unità cadauno");

  } catch (error) {
    console.error("❌ Errore nella creazione dei dati:", error);
  } finally {
    await prisma.$disconnect();
  }
}

setupTestData();
