const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Simula chiamata API come farebbe il frontend
async function simulateFrontendCall() {
  console.log('🔍 SIMULAZIONE CHIAMATA FRONTEND - PERCHÉ "NON SPECIFICATO"?\n');

  // 1. Recupera dati organizzazione come farebbe il backend
  const { data: orgData, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', 'lenzi-org-id')
    .single();

  if (error) {
    console.error('❌ Errore:', error);
    return;
  }

  console.log('1️⃣ DATI ORGANIZZAZIONE DAL DATABASE:');
  console.log(`  type: '${orgData.type}'`);
  console.log(`  org_type: '${orgData.org_type}'`);
  console.log(`  kind: '${orgData.kind}'`);

  // 2. Simula quello che fa il backend endpoint
  const orgType = orgData.type || orgData.org_type || 'buyer';
  console.log(`\n2️⃣ TIPO DETERMINATO DAL BACKEND: '${orgType}'`);

  // 3. Simula quello che fa il frontend
  const frontendOrgType = orgData.type || orgData.org_type;
  console.log(`\n3️⃣ TIPO CHE LEGGE IL FRONTEND DALLA RISPOSTA: '${frontendOrgType}'`);

  let displayText = 'Non specificato';
  if (frontendOrgType === 'vendor' || frontendOrgType === 'operator') {
    displayText = 'Fornitore/Operatore (Vendor/Operator)';
  } else if (frontendOrgType === 'buyer') {
    displayText = 'Cliente (Buyer)';
  }

  console.log(`\n4️⃣ TESTO CHE DOVREBBE MOSTRARE IL FRONTEND: '${displayText}'`);

  // 4. Test della logica frontend con la risposta completa
  const backendResponse = {
    ...orgData,
    org_type: orgType
  };

  console.log('\n5️⃣ RISPOSTA COMPLETA CHE RICEVE IL FRONTEND:');
  console.log(`  type: '${backendResponse.type}'`);
  console.log(`  org_type: '${backendResponse.org_type}'`);

  // Test della lettura frontend dalla risposta
  const frontendReadFromResponse = backendResponse.type || backendResponse.org_type;
  console.log(`\n6️⃣ COSA LEGGE IL FRONTEND DALLA RISPOSTA: '${frontendReadFromResponse}'`);

  // Test finale della condizione
  let finalDisplay = 'Non specificato';
  if (frontendReadFromResponse === 'vendor' || frontendReadFromResponse === 'operator') {
    finalDisplay = 'Fornitore/Operatore (Vendor/Operator)';
  } else if (frontendReadFromResponse === 'buyer') {
    finalDisplay = 'Cliente (Buyer)';
  }

  console.log(`\n7️⃣ DISPLAY FINALE: '${finalDisplay}'`);

  console.log('\n💡 CONCLUSIONI:');
  if (orgData.type === 'vendor' && finalDisplay === 'Non specificato') {
    console.log('🐛 BUG: Database ha type=vendor ma frontend mostra "Non specificato"');
    console.log('🔧 Il problema è nella lettura dei dati nel frontend!');
  } else if (finalDisplay !== 'Non specificato') {
    console.log('✅ Tutto funziona correttamente');
  } else {
    console.log('❓ Caso inaspettato');
  }

  console.log('\n🔍 VERIFICA DA FARE NEL FRONTEND:');
  console.log('Apri console e controlla cosa c\'è in organization.org_type');
  console.log('Il campo potrebbe chiamarsi diversamente nella risposta API');
}

simulateFrontendCall().catch(console.error);
