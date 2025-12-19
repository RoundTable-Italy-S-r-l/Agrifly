const { PrismaClient } = require('./generated/prisma/client');

async function findLenziId() {
  const prisma = new PrismaClient();
  
  try {
    const lenziOrg = await prisma.organization.findFirst({
      where: { legal_name: { contains: 'Lenzi' } }
    });
    
    if (lenziOrg) {
      console.log(`LENZI_ORG_ID=${lenziOrg.id}`);
      console.log(`LENZI_NAME=${lenziOrg.legal_name}`);
    } else {
      console.log('Nessuna organizzazione Lenzi trovata');
    }
  } catch (error) {
    console.error('Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findLenziId();
