import { PrismaClient } from '../../generated/prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  console.log('📦 Archiviando T30...');
  
  await prisma.product.update({
    where: { id: 'prd_t30' },
    data: { status: 'ARCHIVED' }
  });
  
  console.log('✅ T30 archiviato (non più visibile nel catalogo)');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

