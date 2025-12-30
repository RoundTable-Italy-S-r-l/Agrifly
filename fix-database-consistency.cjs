#!/usr/bin/env node

/**
 * Script per sistemare la consistenza del database delle organizzazioni
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configurazione Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY non trovati');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDatabaseConsistency() {
  console.log('🔧 Sistemando consistenza database organizzazioni...');

  try {
    // 1. Sistemare kind di Lenzi da 'FARM' a 'BUSINESS'
    console.log('📝 Sistemando Lenzi...');
    const { error: lenziError } = await supabase
      .from('organizations')
      .update({
        kind: 'BUSINESS',
        updated_at: new Date().toISOString()
      })
      .eq('id', 'lenzi-org-id');

    if (lenziError) {
      console.error('❌ Errore aggiornando Lenzi:', lenziError);
    } else {
      console.log('✅ Lenzi kind sistemato da FARM a BUSINESS');
    }

    // 2. Verifica di tutte le organizzazioni
    console.log('\n🔍 Verificando tutte le organizzazioni...');
    const { data, error } = await supabase
      .from('organizations')
      .select('id, legal_name, kind, type, can_buy, can_sell, can_operate, can_dispatch');

    if (error) {
      console.error('❌ Errore nel recupero:', error);
      return;
    }

    console.log('\n=== ORGANIZZAZIONI VERIFICATE ===');
    let buyerCount = 0;
    let vendorOperatorCount = 0;
    let inconsistencies = [];

    data.forEach(org => {
      let determinedType = 'BUYER';
      if (org.can_sell || org.can_operate) {
        determinedType = 'VENDOR_OPERATOR';
      }

      if (determinedType === 'BUYER') buyerCount++;
      else vendorOperatorCount++;

      // Controlla inconsistenze
      if (org.kind !== 'BUSINESS') {
        inconsistencies.push(`${org.legal_name}: kind='${org.kind}' invece di 'BUSINESS'`);
      }

      console.log(`${org.legal_name}: ${determinedType} (kind: ${org.kind})`);
    });

    console.log(`\n📊 RIEPILOGO:`);
    console.log(`   ${buyerCount} organizzazioni BUYER`);
    console.log(`   ${vendorOperatorCount} organizzazioni VENDOR_OPERATOR`);
    console.log(`   Totale: ${data.length} organizzazioni`);

    if (inconsistencies.length > 0) {
      console.log('\n⚠️ Inconsistenze trovate:');
      inconsistencies.forEach(inc => console.log(`   - ${inc}`));
    } else {
      console.log('\n✅ Nessuna inconsistenza trovata!');
    }

    console.log('\n✅ Database verificato e sistemato!');

  } catch (error) {
    console.error('❌ Errore generale:', error);
  }
}

// Esegui lo script
fixDatabaseConsistency();
