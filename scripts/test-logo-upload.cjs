/**
 * Test script per verificare upload logo
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function testLogoUpload() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'Media FIle';

  console.log('🔍 Configurazione:');
  console.log('  SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.log('  SUPABASE_KEY:', supabaseKey ? '✅ (length: ' + supabaseKey.length + ')' : '❌');
  console.log('  BUCKET_NAME:', bucketName);

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Configurazione Supabase mancante');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Test 1: Verifica bucket esiste
  console.log('\n📦 Test 1: Verifica bucket esiste');
  try {
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) {
      console.error('❌ Errore listando buckets:', bucketsError);
    } else {
      console.log('✅ Buckets disponibili:', buckets.map(b => b.name));
      const bucketExists = buckets.some(b => b.name === bucketName);
      console.log(`  Bucket "${bucketName}" esiste:`, bucketExists ? '✅' : '❌');
    }
  } catch (error) {
    console.error('❌ Errore:', error.message);
  }

  // Test 2: Lista contenuti bucket
  console.log('\n📂 Test 2: Lista contenuti bucket');
  try {
    const { data: files, error: listError } = await supabase.storage
      .from(bucketName)
      .list('', {
        limit: 10,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (listError) {
      console.error('❌ Errore listando bucket:', listError);
    } else {
      console.log('✅ Contenuti bucket (primi 10):');
      if (files && files.length > 0) {
        files.forEach(file => {
          console.log(`  ${file.id === null ? '📁' : '📄'} ${file.name}`);
        });
      } else {
        console.log('  (vuoto)');
      }
    }
  } catch (error) {
    console.error('❌ Errore:', error.message);
  }

  // Test 3: Verifica cartella logos
  console.log('\n📁 Test 3: Verifica cartella logos');
  try {
    const { data: logosFiles, error: logosError } = await supabase.storage
      .from(bucketName)
      .list('logos', {
        limit: 10
      });

    if (logosError) {
      console.log('⚠️  Cartella logos non esiste o errore:', logosError.message);
      console.log('   (verrà creata automaticamente al primo upload)');
    } else {
      console.log('✅ Cartella logos esiste');
      if (logosFiles && logosFiles.length > 0) {
        console.log(`  Contiene ${logosFiles.length} file/cartelle`);
      } else {
        console.log('  (vuota)');
      }
    }
  } catch (error) {
    console.error('❌ Errore:', error.message);
  }

  // Test 4: Prova upload test
  console.log('\n📤 Test 4: Prova upload file di test');
  try {
    // Crea un file di test in memoria
    const testContent = Buffer.from('test logo content');
    const testFileName = `test-logo-${Date.now()}.txt`;
    const testFilePath = `logos/${testFileName}`;

    console.log('  Upload path:', testFilePath);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(testFilePath, testContent, {
        contentType: 'text/plain',
        upsert: true
      });

    if (uploadError) {
      console.error('❌ Errore upload:', uploadError);
      console.error('   Code:', uploadError.statusCode);
      console.error('   Message:', uploadError.message);
      console.error('   Error:', uploadError.error);
    } else {
      console.log('✅ Upload riuscito!');
      console.log('   Path:', uploadData.path);

      // Prova a eliminare il file di test
      const { error: deleteError } = await supabase.storage
        .from(bucketName)
        .remove([testFilePath]);
      
      if (deleteError) {
        console.log('⚠️  Impossibile eliminare file di test:', deleteError.message);
      } else {
        console.log('✅ File di test eliminato');
      }
    }
  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error('   Stack:', error.stack);
  }

  console.log('\n✅ Test completati');
}

testLogoUpload()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Errore fatale:', error);
    process.exit(1);
  });

