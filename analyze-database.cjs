const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function analyzeDatabase() {
  console.log('=== ANALISI DATABASE ATTUALE ===\n');

  // 1. Organizzazioni - vediamo quali seguono logica vecchia vs nuova
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('id, legal_name, kind, type, can_buy, can_sell, can_operate, can_dispatch')
    .limit(20);

  if (orgsError) {
    console.error('Errore organizzazioni:', orgsError);
    return;
  }

  console.log('🏢 ORGANIZZAZIONI ATTUALI:');
  console.log('Formato: [Nome] kind=TYPE type=TYPE capabilities=(buy,sell,operate,dispatch)\n');

  let oldLogicCount = 0;
  let newLogicCount = 0;

  orgs.forEach(org => {
    const caps = `(${org.can_buy},${org.can_sell},${org.can_operate},${org.can_dispatch})`;
    console.log(`${org.legal_name}: kind='${org.kind}' type='${org.type}' capabilities=${caps}`);

    // Analizza se capabilities sono coerenti con nuova logica
    const orgType = (org.type || 'buyer').toLowerCase();
    const expected = {
      buyer: { can_buy: true, can_sell: false, can_operate: false, can_dispatch: false },
      vendor: { can_buy: false, can_sell: true, can_operate: false, can_dispatch: false },
      operator: { can_buy: false, can_sell: false, can_operate: true, can_dispatch: false }
    };

    const exp = expected[orgType] || expected.buyer;
    const isOldLogic = org.can_buy !== exp.can_buy || org.can_sell !== exp.can_sell ||
                      org.can_operate !== exp.can_operate || org.can_dispatch !== exp.can_dispatch;

    if (isOldLogic) {
      console.log(`  ❌ VECCHIA LOGICA: expected ${JSON.stringify(exp)}, got ${JSON.stringify({
        can_buy: org.can_buy, can_sell: org.can_sell, can_operate: org.can_operate, can_dispatch: org.can_dispatch
      })}`);
      oldLogicCount++;
    } else {
      console.log(`  ✅ LOGICA COERENTE`);
      newLogicCount++;
    }
  });

  console.log(`\n📊 RIEPILOGO ORGANIZZAZIONI:`);
  console.log(`  Vecchia logica: ${oldLogicCount}`);
  console.log(`  Nuova logica: ${newLogicCount}`);

  // 2. Membri e ruoli
  const { data: members, error: membersError } = await supabase
    .from('org_memberships')
    .select('org_id, user_id, role, is_active')
    .limit(20);

  if (membersError) {
    console.error('Errore membri:', membersError);
    return;
  }

  console.log('\n👥 MEMBRI ORGANIZZAZIONI:');
  const roleStats = {};
  members.forEach(member => {
    const role = member.role || 'null';
    roleStats[role] = (roleStats[role] || 0) + 1;
    console.log(`  Org: ${member.org_id.substring(0,8)}..., User: ${member.user_id.substring(0,8)}..., Role: '${role}', Active: ${member.is_active}`);
  });

  console.log('\n📊 STATISTICHE RUOLI:');
  Object.entries(roleStats).forEach(([role, count]) => {
    console.log(`  ${role}: ${count} utenti`);
  });

  // 3. Raccomandazioni
  console.log('\n💡 RACCOMANDAZIONI MIGRATION:');
  if (oldLogicCount > 0) {
    console.log('⚠️  Ci sono organizzazioni con logica vecchia - vanno aggiornate');
  }
  console.log('✅ Mantenere colonne esistenti per backward compatibility');
  console.log('🔄 Capabilities ora calcolate dinamicamente dal ruolo utente');
}

analyzeDatabase().catch(console.error);
