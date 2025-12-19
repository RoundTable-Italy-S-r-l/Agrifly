import { PrismaClient } from '../generated/prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function testConnection() {
  console.log('🔌 Testing database connection...');
  console.log('📍 DATABASE_URL:', process.env.DATABASE_URL ? 
    `${process.env.DATABASE_URL.substring(0, 30)}...` : 'NOT SET');
  
  try {
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connection successful!');
    
    // Try to query a table (will fail if table doesn't exist, but connection works)
    try {
      const result = await prisma.$queryRaw`SELECT 1 as test`;
      console.log('✅ Database query successful!');
    } catch (queryError: any) {
      if (queryError?.code === 'P2021' || queryError?.message?.includes('does not exist')) {
        console.log('⚠️  Tables do not exist yet - this is normal!');
        console.log('📝 Next step: Create tables with "npm run db:push"');
      } else {
        throw queryError;
      }
    }
    
    await prisma.$disconnect();
    console.log('🎉 Database is ready!');
    return true;
  } catch (error: any) {
    console.error('❌ Connection failed:', error.message);
    
    if (error?.code === 'P1001') {
      console.log('💡 Tip: Check your DATABASE_URL in .env file');
      console.log('💡 Format: postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres');
    }
    
    await prisma.$disconnect().catch(() => {});
    return false;
  }
}

testConnection()
  .then((success) => process.exit(success ? 0 : 1))
  .catch((err) => {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  });
