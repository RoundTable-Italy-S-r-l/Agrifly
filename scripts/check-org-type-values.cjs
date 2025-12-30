#!/usr/bin/env node

/**
 * Script per verificare i valori esistenti in organizations.type
 * prima di migrare a enum
 */

const { Client } = require('pg');
require('dotenv').config();

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, ...args) {
  console.log(colors[color] || colors.reset, ...args, colors.reset);
}

async function checkOrgTypeValues() {
  const client = new Client({
    host: process.env.PGHOST,
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE || 'postgres',
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });

  try {
    await client.connect();
    log('green', '✅ Connesso al database Supabase PostgreSQL\n');

    // Verifica valori esistenti
    const valuesQuery = `
      SELECT type, COUNT(*) as count, 
             STRING_AGG(id, ', ') as org_ids
      FROM organizations
      GROUP BY type
      ORDER BY type;
    `;
    
    const result = await client.query(valuesQuery);
    
    log('cyan', '📋 Valori esistenti in organizations.type:\n');
    
    const validValues = ['buyer', 'vendor', 'operator'];
    const enumValues = ['buyer', 'vendor', 'operator', 'FARM', 'VENDOR', 'OPERATOR_PROVIDER'];
    
    let hasInvalid = false;
    let hasNull = false;
    
    result.rows.forEach(row => {
      const value = row.type;
      const count = parseInt(row.count);
      const orgIds = row.org_ids.split(', ').slice(0, 5); // Mostra max 5 ID
      
      if (value === null || value === 'null' || value === 'NULL') {
        hasNull = true;
        log('red', `   ❌ NULL o "null": ${count} organizzazioni`);
        log('blue', `      ID: ${orgIds.join(', ')}${row.org_ids.split(', ').length > 5 ? '...' : ''}`);
      } else if (!enumValues.includes(value) && !validValues.includes(value.toLowerCase())) {
        hasInvalid = true;
        log('red', `   ❌ Valore invalido "${value}": ${count} organizzazioni`);
        log('blue', `      ID: ${orgIds.join(', ')}${row.org_ids.split(', ').length > 5 ? '...' : ''}`);
      } else {
        const normalized = value.toLowerCase();
        const isValid = validValues.includes(normalized);
        log(isValid ? 'green' : 'yellow', `   ${isValid ? '✅' : '⚠️'} "${value}": ${count} organizzazioni`);
        if (!isValid) {
          log('blue', `      (valore legacy: ${value})`);
        }
      }
    });

    // Verifica enum OrgType
    log('cyan', '\n📋 Valori nell\'enum OrgType:\n');
    const enumQuery = `
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'OrgType')
      ORDER BY enumsortorder;
    `;
    const enumResult = await client.query(enumQuery);
    const enumValuesList = enumResult.rows.map(r => r.enumlabel);
    
    enumValuesList.forEach((val, idx) => {
      const isValid = validValues.includes(val.toLowerCase());
      log(isValid ? 'green' : 'yellow', `   ${idx + 1}. "${val}"${isValid ? ' (valido)' : ' (legacy)'}`);
    });

    // Verifica conflitto con OrgRole
    log('cyan', '\n📋 Verifica conflitto vendor (OrgType vs OrgRole)...\n');
    
    const orgRoleQuery = `
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'OrgRole')
      ORDER BY enumsortorder;
    `;
    const orgRoleResult = await client.query(orgRoleQuery);
    const orgRoleValues = orgRoleResult.rows.map(r => r.enumlabel);
    
    log('blue', '   Valori in OrgRole:');
    orgRoleValues.forEach(val => {
      log('blue', `     - "${val}"`);
    });
    
    const hasVendorInRole = orgRoleValues.some(v => v.toLowerCase() === 'vendor');
    const hasVendorInType = enumValuesList.some(v => v.toLowerCase() === 'vendor');
    
    if (hasVendorInRole && hasVendorInType) {
      log('yellow', '\n   ⚠️  "vendor" esiste sia in OrgType che in OrgRole');
      log('yellow', '   Questo NON è un problema perché:');
      log('yellow', '     - organizations.type usa OrgType');
      log('yellow', '     - org_memberships.role usa OrgRole');
      log('yellow', '     - Sono colonne diverse in tabelle diverse');
      log('green', '   ✅ Nessun conflitto tecnico');
    } else {
      log('green', '\n   ✅ Nessun conflitto');
    }

    // Riepilogo
    log('cyan', '\n' + '='.repeat(60));
    log('cyan', '📊 RIEPILOGO');
    log('cyan', '='.repeat(60));
    
    if (hasNull || hasInvalid) {
      log('red', '\n❌ Problemi trovati:');
      if (hasNull) {
        log('red', '   - Organizzazioni con type=NULL o "null" devono essere corrette');
      }
      if (hasInvalid) {
        log('red', '   - Valori invalidi devono essere corretti o rimossi');
      }
      log('yellow', '\n💡 Prima di migrare a enum, correggi questi valori');
    } else {
      log('green', '\n✅ Tutti i valori sono validi per la migrazione a enum');
    }
    
    log('green', '\n✅ Nessun conflitto con "vendor" tra OrgType e OrgRole');

  } catch (error) {
    log('red', `\n❌ Errore: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkOrgTypeValues();

