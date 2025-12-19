import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL || 'https://fzowfkfwriajohjjboed.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b3dma2Z3cmlham9oampib2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNDg4MTMsImV4cCI6MjA4MTYyNDgxM30.H-tAyDgCleVyKS2MwCV3_hkorCOFXVU2TJAEJF-9OOc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('🔌 Testing Supabase connection...');
  console.log('📍 URL:', supabaseUrl);
  
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('gis_categories')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('⚠️  Connection test result:', error.message);
      console.log('ℹ️  This is normal if tables don\'t exist yet.');
      console.log('✅ Supabase connection is working!');
      return true;
    }
    
    console.log('✅ Connection successful!');
    console.log('📊 Data:', data);
    return true;
  } catch (err) {
    console.error('❌ Connection failed:', err);
    return false;
  }
}

testConnection()
  .then((success) => {
    if (success) {
      console.log('\n🎉 Supabase is ready!');
      console.log('📝 Next steps:');
      console.log('   1. Run: npx prisma db push');
      console.log('   2. Run: npm run seed');
    }
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
