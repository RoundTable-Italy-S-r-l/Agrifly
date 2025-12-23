import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

// Carica .env dalla root del progetto
config({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Aggiornamento stati ordini...');

  // Aggiorna tutti gli ordini con stato CREATED a PAID
  const result = await prisma.$executeRaw`
    UPDATE orders 
    SET order_status = 'PAID' 
    WHERE order_status = 'CREATED'
  `;

  console.log(`✅ Aggiornati ${result} ordini da CREATED a PAID`);

  // Verifica se ci sono altri stati non validi
  const invalidOrders = await prisma.$queryRaw<Array<{ order_status: string; count: number }>>`
    SELECT order_status, COUNT(*) as count
    FROM orders
    WHERE order_status NOT IN ('PAID', 'SHIPPED', 'FULFILLED', 'CANCELLED', 'PROBLEMATIC')
    GROUP BY order_status
  `;

  if (invalidOrders.length > 0) {
    console.log('⚠️ Stati non validi trovati:');
    invalidOrders.forEach(({ order_status, count }) => {
      console.log(`   ${order_status}: ${count} ordini`);
    });
  } else {
    console.log('✅ Tutti gli ordini hanno stati validi');
  }
}

main()
  .catch((e) => {
    console.error('❌ Errore:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

