import { PrismaClient } from '../../generated/prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function createSampleOrders() {
  try {
    console.log("🔄 Creazione ordini fittizi...");

    // 1. Crea organizzazioni buyer se non esistono
    const buyer1 = await prisma.organization.upsert({
      where: { id: "buyer-org-1" },
      update: {},
      create: {
        id: "buyer-org-1",
        legal_name: "Azienda Agricola Rossi S.r.l.",
        org_type: "FARM",
        address_line: "Via Campagna 15",
        city: "Parma",
        province: "PR",
        region: "Emilia-Romagna",
        country: "IT",
        status: "ACTIVE",
      },
    });

    const buyer2 = await prisma.organization.upsert({
      where: { id: "buyer-org-2" },
      update: {},
      create: {
        id: "buyer-org-2",
        legal_name: "Cooperativa Agricola Verdi",
        org_type: "FARM",
        address_line: "Strada dei Campi 42",
        city: "Modena",
        province: "MO",
        region: "Emilia-Romagna",
        country: "IT",
        status: "ACTIVE",
      },
    });

    console.log("✅ Organizzazioni buyer create/trovate");

    // 2. Verifica SKU disponibili
    const skus = await prisma.sku.findMany({
      where: { status: "ACTIVE" },
      take: 7,
    });

    if (skus.length === 0) {
      throw new Error("Nessuno SKU attivo trovato");
    }

    console.log(`✅ Trovati ${skus.length} SKU attivi`);

    // 3. Trova price list attiva di Lenzi
    const priceList = await prisma.priceList.findFirst({
      where: {
        vendor_org_id: "lenzi-org-id",
        status: "ACTIVE",
      },
    });

    if (!priceList) {
      throw new Error("Nessuna price list attiva trovata per Lenzi");
    }

    // 4. Crea Ordine 1: PAID - Azienda Agricola Rossi
    const order1Items = [
      { sku: skus.find(s => s.sku_code === "DJI_T30") || skus[0], qty: 1 },
      { sku: skus.find(s => s.sku_code === "DJI_T25") || skus[1], qty: 2 },
    ].filter(item => item.sku);

    let total1 = 0;
    const orderLines1 = [];

    for (const item of order1Items) {
      const priceItem = await prisma.priceListItem.findFirst({
        where: {
          price_list_id: priceList.id,
          sku_id: item.sku.id,
        },
      });

      const unitPrice = priceItem?.price_cents || 250000; // Default €2500
      const lineTotal = unitPrice * item.qty;
      total1 += lineTotal;

      orderLines1.push({
        sku_id: item.sku.id,
        qty: item.qty,
        unit_price_snapshot_cents: unitPrice,
        line_total_cents: lineTotal,
      });
    }

    const order1 = await prisma.order.create({
      data: {
        buyer_org_id: buyer1.id,
        seller_org_id: "lenzi-org-id",
        order_status: "PAID",
        total_cents: total1,
        currency: "EUR",
        order_lines: {
          create: orderLines1,
        },
      },
    });

    console.log(`✅ Ordine 1 creato: ${order1.id} - Totale: €${total1 / 100}`);

    // 5. Crea Ordine 2: FULFILLED - Cooperativa Agricola Verdi
    const order2Items = [
      { sku: skus.find(s => s.sku_code === "DJI_T50") || skus[2], qty: 1 },
      { sku: skus.find(s => s.sku_code === "DJI_MAVIC3M") || skus[6], qty: 1 },
    ].filter(item => item.sku);

    let total2 = 0;
    const orderLines2 = [];

    for (const item of order2Items) {
      const priceItem = await prisma.priceListItem.findFirst({
        where: {
          price_list_id: priceList.id,
          sku_id: item.sku.id,
        },
      });

      const unitPrice = priceItem?.price_cents || 250000;
      const lineTotal = unitPrice * item.qty;
      total2 += lineTotal;

      orderLines2.push({
        sku_id: item.sku.id,
        qty: item.qty,
        unit_price_snapshot_cents: unitPrice,
        line_total_cents: lineTotal,
      });
    }

    const order2 = await prisma.order.create({
      data: {
        buyer_org_id: buyer2.id,
        seller_org_id: "lenzi-org-id",
        order_status: "FULFILLED",
        total_cents: total2,
        currency: "EUR",
        order_lines: {
          create: orderLines2,
        },
      },
    });

    console.log(`✅ Ordine 2 creato: ${order2.id} - Totale: €${total2 / 100}`);

    console.log("\n🎉 Ordini fittizi creati con successo!");
    console.log(`   Ordine 1: ${order1.id} - ${buyer1.legal_name} - PAID`);
    console.log(`   Ordine 2: ${order2.id} - ${buyer2.legal_name} - FULFILLED`);

    await prisma.$disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Errore:", error.message);
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

createSampleOrders();

