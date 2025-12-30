const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debugFrontendSettings() {
  console.log('🔍 DEBUG IMPOSTAZIONI FRONTEND\n');

  // 1. Verifica dati organizzazione
  console.log('1️⃣ VERIFICA DATI ORGANIZZAZIONE:');
  const { data: orgData, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', 'lenzi-org-id')
    .single();

  if (orgError) {
    console.error('❌ Errore lettura organizzazione:', orgError);
  } else {
    console.log('✅ Dati organizzazione dal database:');
    console.log(`  ID: ${orgData.id}`);
    console.log(`  Nome: ${orgData.legal_name}`);
    console.log(`  Tipo: ${orgData.type}`);
    console.log(`  Campi presenti: ${Object.keys(orgData).join(', ')}`);

    // Verifica se ci sono campi capabilities (che ora dovrebbero essere rimossi)
    const hasCapabilities = ['can_buy', 'can_sell', 'can_operate', 'can_dispatch'].some(field =>
      orgData[field] !== undefined
    );
    console.log(`  Ha campi capabilities (OBSOLETI): ${hasCapabilities}`);

    if (hasCapabilities) {
      console.log('  ⚠️  TROVATI CAMPI OBSOLETI - dovrebbero essere rimossi dal database');
    }
  }

  // 2. Verifica utenti associati
  console.log('\n2️⃣ VERIFICA UTENTI ASSOCIATI:');
  const { data: memberships, error: memError } = await supabase
    .from('org_memberships')
    .select('user_id, role, is_active')
    .eq('org_id', 'lenzi-org-id');

  if (memError) {
    console.error('❌ Errore lettura memberships:', memError);
  } else {
    console.log(`✅ Membri trovati: ${memberships.length}`);
    memberships.forEach(m => {
      console.log(`  - User ${m.user_id.substring(0,8)}...: ruolo '${m.role}', attivo: ${m.is_active}`);
    });

    const activeMembers = memberships.filter(m => m.is_active);
    console.log(`✅ Membri attivi: ${activeMembers.length}`);
  }

  // 3. Simula chiamata API con token
  console.log('\n3️⃣ TEST CHIAMATA API (con token valido):');

  // Prima ottieni un token valido dal database (simula login)
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, email')
    .limit(1);

  if (userError || !users.length) {
    console.log('❌ Nessun utente trovato per test');
  } else {
    console.log(`Test con utente: ${users[0].email}`);

    // Simula chiamata all'endpoint (senza token reale, solo per vedere se risponde)
    try {
      const response = await fetch('http://localhost:3001/api/settings/organization/general?orgId=lenzi-org-id', {
        headers: {
          'Content-Type': 'application/json',
          // Nota: senza Authorization, dovrebbe dare 401
        }
      });

      console.log(`Risposta status: ${response.status}`);
      if (response.status === 401) {
        console.log('✅ Risposta attesa: endpoint richiede autenticazione');
        console.log('💡 Nel frontend, verifica che localStorage abbia auth_token valido');
      }

    } catch (fetchError) {
      console.log('❌ Errore chiamata HTTP:', fetchError.message);
    }
  }

  console.log('\n💡 CAUSE POSSIBILI PROBLEMA:');
  console.log('1. ❌ Token mancante: localStorage.getItem("auth_token")');
  console.log('2. ❌ Org ID mancante: localStorage.getItem("organization")');
  console.log('3. ❌ Token scaduto o invalido');
  console.log('4. ❌ Utente non membro dell\'organizzazione');
  console.log('5. ❌ Campi capabilities ancora presenti (rimuoverli)');

  console.log('\n🔧 VERIFICHE DA FARE NEL BROWSER:');
  console.log('1. ✅ Apri console dev tools (F12)');
  console.log('2. ✅ Vai in Application > Local Storage');
  console.log('3. ✅ Verifica auth_token e organization');
  console.log('4. ✅ Vai in Network tab e ricarica pagina impostazioni');
  console.log('5. ✅ Cerca chiamate a /api/settings/organization/general');
}

debugFrontendSettings().catch(console.error);
