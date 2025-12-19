import { PrismaClient } from './generated/prisma/client.js';

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('🔌 Testing database connection...');
    
    // Test semplice: conta le organizzazioni
    const orgCount = await prisma.organization.count();
    console.log(`✅ Database connected! Found ${orgCount} organizations.`);
    
    // Test: trova Lenzi
    const lenziOrg = await prisma.organization.findUnique({
      where: { id: 'lenzi-org-id' }
    });
    
    if (lenziOrg) {
      console.log(`✅ Found Lenzi organization: ${lenziOrg.legal_name}`);
    } else {
      console.log('❌ Lenzi organization not found');
    }
    
    // Test: conta i prodotti
    const productCount = await prisma.product.count();
    console.log(`📦 Found ${productCount} products in database`);
    
    // Test: conta gli SKU
    const skuCount = await prisma.sku.count();
    console.log(`🏷️  Found ${skuCount} SKUs in database`);
    
    if (skuCount > 0) {
      console.log('🎉 Database is ready for catalog initialization!');
    } else {
      console.log('⚠️  No SKUs found - need to populate products first');
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
