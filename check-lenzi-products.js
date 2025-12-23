#!/usr/bin/env node

import 'dotenv/config';
import { PrismaClient } from './generated/prisma/client.js';

const prisma = new PrismaClient();

async function checkLenziProducts() {
  try {
    console.log('🔍 Controllo prodotti Lenzi nel database...\n');

    // 1. Verifica se Lenzi esiste
    const lenziOrg = await prisma.organization.findUnique({
      where: { id: 'lenzi-org-id' }
    });

    if (!lenziOrg) {
      console.log('❌ Organizzazione Lenzi non trovata!');
      return;
    }

    console.log('✅ Organizzazione Lenzi trovata:');
    console.log(`   ID: ${lenziOrg.id}`);
    console.log(`   Nome: ${lenziOrg.legal_name}`);
    console.log(`   Tipo: ${lenziOrg.org_type}`);
    console.log(`   Status: ${lenziOrg.status}\n`);

    // 2. Verifica prodotti attivi
    const activeOrgs = await prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, legal_name: true }
    });

    console.log(`📊 Organizzazioni ACTIVE: ${activeOrgs.length}`);
    activeOrgs.forEach(org => {
      console.log(`   - ${org.legal_name} (${org.id})`);
    });
    console.log('');

    // 3. Trova prodotti Lenzi (SKU con vendor_catalog_items)
    const lenziProducts = await prisma.sku.findMany({
      where: {
        vendor_catalog_items: {
          some: {
            vendor_org_id: 'lenzi-org-id',
            is_for_sale: true
          }
        }
      },
      include: {
        product: true,
        vendor_catalog_items: {
          where: { vendor_org_id: 'lenzi-org-id' }
        },
        price_list_items: {
          include: {
            price_list: true
          }
        },
        inventories: {
          where: { vendor_org_id: 'lenzi-org-id' }
        }
      }
    });

    console.log(`🛒 Prodotti Lenzi trovati: ${lenziProducts.length}\n`);

    if (lenziProducts.length === 0) {
      console.log('⚠️  Nessun prodotto trovato per Lenzi. Controlla:');
      console.log('   - Vendor catalog items sono creati?');
      console.log('   - Sono marcati come is_for_sale: true?');
      console.log('   - L\'organizzazione Lenzi ha il price list?');
    } else {
      lenziProducts.forEach((sku, index) => {
        console.log(`${index + 1}. ${sku.product.name} (${sku.product.model})`);
        console.log(`   SKU: ${sku.sku_code}`);
        console.log(`   Tipo: ${sku.product.product_type}`);

        const catalogItem = sku.vendor_catalog_items[0];
        if (catalogItem) {
          console.log(`   In vendita: ${catalogItem.is_for_sale ? '✅' : '❌'}`);
          console.log(`   Noleggio: ${catalogItem.is_for_rent ? '✅' : '❌'}`);
          console.log(`   Lead time: ${catalogItem.lead_time_days || 'N/A'} giorni`);
        }

        const priceItem = sku.price_list_items.find(p => p.price_list.vendor_org_id === 'lenzi-org-id');
        if (priceItem) {
          console.log(`   Prezzo: €${(priceItem.price_cents / 100).toFixed(2)}`);
        }

        const inventory = sku.inventories[0];
        if (inventory) {
          console.log(`   Stock: ${inventory.qty_on_hand} unità`);
          console.log(`   Location: ${inventory.location?.name || 'N/A'}`);
        }

        console.log('');
      });
    }

    // 4. Verifica se Lenzi ha un price list
    const lenziPriceList = await prisma.priceList.findFirst({
      where: {
        vendor_org_id: 'lenzi-org-id',
        status: 'ACTIVE'
      }
    });

    console.log('💰 Price List Lenzi:');
    if (lenziPriceList) {
      console.log('   ✅ Price list attivo trovato');
      console.log(`   Nome: ${lenziPriceList.name}`);
      console.log(`   Valuta: ${lenziPriceList.currency}`);
      console.log(`   Valido da: ${lenziPriceList.valid_from.toISOString().split('T')[0]}`);
      if (lenziPriceList.valid_to) {
        console.log(`   Valido fino: ${lenziPriceList.valid_to.toISOString().split('T')[0]}`);
      }
    } else {
      console.log('   ❌ Nessun price list attivo trovato per Lenzi');
    }

    // 5. Verifica associazione utente Lenzi
    console.log('\n👤 Controllo associazione utente giacomo.cavalcabo14@gmail.com:');
    const user = await prisma.user.findUnique({
      where: { email: 'giacomo.cavalcabo14@gmail.com' },
      include: {
        org_memberships: {
          include: {
            org: true
          }
        }
      }
    });

    if (!user) {
      console.log('   ❌ Utente non trovato!');
    } else {
      console.log('   ✅ Utente trovato');
      console.log(`   Nome: ${user.first_name} ${user.last_name}`);
      console.log(`   Organizzazioni: ${user.org_memberships.length}`);

      const lenziMembership = user.org_memberships.find(m => m.org_id === 'lenzi-org-id');
      if (lenziMembership) {
        console.log('   ✅ Associato a Lenzi!');
        console.log(`   Ruolo: ${lenziMembership.role}`);
        console.log(`   Attivo: ${lenziMembership.is_active ? '✅' : '❌'}`);
      } else {
        console.log('   ❌ NON associato a Lenzi!');
        console.log('   💡 Esegui: npm run db:fix-user-lenzi');
      }
    }

  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error('💡 Possibili cause:');
    console.log('   - Database non raggiungibile');
    console.log('   - Credenziali errate');
    console.log('   - Tabella non popolata');
  } finally {
    await prisma.$disconnect();
  }
}

checkLenziProducts();
