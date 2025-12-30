#!/usr/bin/env node

/**
 * Script migliorato per verificare disallineamenti CRITICI tra codice e database Supabase
 * 
 * Focus su:
 * 1. Enum values mancanti (case-sensitive)
 * 2. Colonne critiche mancanti
 * 3. Tipi di colonne errati
 * 4. DEFAULT mancanti su colonne id
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

async function checkCriticalAlignment() {
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

    const criticalIssues = [];

    // ============================================================================
    // 1. VERIFICA ENUM VALUES CRITICI
    // ============================================================================
    log('cyan', '📋 [1/3] Verifica Enum Values Critici...\n');

    const criticalEnums = {
      ProductType: {
        codeValues: ['drone', 'DRONE'], // Valori usati nel codice
        description: 'Tipo prodotto'
      },
      ServiceType: {
        codeValues: ['SPRAY', 'SPREAD', 'MAPPING'],
        description: 'Tipo servizio'
      },
      OrgType: {
        codeValues: ['buyer', 'vendor', 'operator', 'BUYER', 'VENDOR', 'OPERATOR', 'FARM', 'OPERATOR_PROVIDER'],
        description: 'Tipo organizzazione',
        caseSensitive: false
      },
      OrgRole: {
        codeValues: ['admin', 'vendor', 'operator', 'dispatcher'],
        description: 'Ruolo utente',
        caseSensitive: false
      },
      BookingStatus: {
        codeValues: ['AWARDED', 'DONE', 'CONFIRMED', 'IN_PROGRESS', 'CANCELLED', 'OFFERED', 'WITHDRAWN'],
        description: 'Stato booking/offerta'
      }
    };

    // Estrai enum dal DB
    const dbEnumsQuery = `
      SELECT 
        t.typname as enum_name,
        e.enumlabel as enum_value
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid 
      WHERE t.typname IN ('ProductType', 'ServiceType', 'OrgType', 'OrgRole', 'BookingStatus')
      ORDER BY t.typname, e.enumsortorder;
    `;
    const dbEnumsResult = await client.query(dbEnumsQuery);
    
    const dbEnums = {};
    dbEnumsResult.rows.forEach(row => {
      if (!dbEnums[row.enum_name]) {
        dbEnums[row.enum_name] = [];
      }
      dbEnums[row.enum_name].push(row.enum_value);
    });

    // Confronta
    for (const [enumName, config] of Object.entries(criticalEnums)) {
      if (!dbEnums[enumName]) {
        log('red', `   ❌ ${enumName}: enum non trovato nel database`);
        criticalIssues.push({
          type: 'enum_missing',
          enum: enumName,
          severity: 'high'
        });
        continue;
      }

      const dbValues = dbEnums[enumName];
      const codeValues = config.codeValues;
      const caseSensitive = config.caseSensitive !== false;

      const missing = codeValues.filter(codeVal => {
        if (caseSensitive) {
          return !dbValues.includes(codeVal);
        } else {
          const codeValLower = codeVal.toLowerCase();
          return !dbValues.some(dbVal => dbVal.toLowerCase() === codeValLower);
        }
      });

      if (missing.length > 0) {
        log('red', `   ❌ ${enumName}: valori mancanti nel DB: [${missing.map(v => `"${v}"`).join(', ')}]`);
        log('blue', `      Valori nel DB: [${dbValues.map(v => `"${v}"`).join(', ')}]`);
        criticalIssues.push({
          type: 'enum_value_missing',
          enum: enumName,
          values: missing,
          dbValues: dbValues,
          severity: 'high'
        });
      } else {
        log('green', `   ✅ ${enumName}: tutti i valori presenti`);
      }
    }

    // ============================================================================
    // 2. VERIFICA TIPI DI COLONNE CRITICHE
    // ============================================================================
    log('cyan', '\n📋 [2/3] Verifica Tipi di Colonne Critiche...\n');

    const criticalColumns = [
      {
        table: 'organizations',
        column: 'type',
        expectedType: 'USER-DEFINED',
        expectedUdt: 'OrgType',
        description: 'Tipo organizzazione dovrebbe essere enum'
      },
      {
        table: 'products',
        column: 'product_type',
        expectedType: 'USER-DEFINED',
        expectedUdt: 'ProductType',
        description: 'Tipo prodotto'
      },
      {
        table: 'org_memberships',
        column: 'role',
        expectedType: 'USER-DEFINED',
        expectedUdt: 'OrgRole',
        description: 'Ruolo utente'
      }
    ];

    for (const { table, column, expectedType, expectedUdt, description } of criticalColumns) {
      const typeQuery = `
        SELECT data_type, udt_name
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1 
        AND column_name = $2;
      `;
      
      try {
        const result = await client.query(typeQuery, [table, column]);
        if (result.rows.length === 0) {
          log('yellow', `   ⚠️  ${table}.${column}: colonna non trovata`);
          continue;
        }

        const actualType = result.rows[0].data_type;
        const actualUdt = result.rows[0].udt_name;

        if (expectedType === 'USER-DEFINED' && actualType !== 'USER-DEFINED') {
          log('red', `   ❌ ${table}.${column}: atteso enum (${expectedUdt}), trovato ${actualType}`);
          log('blue', `      ${description}`);
          criticalIssues.push({
            type: 'column_type_mismatch',
            table,
            column,
            expected: expectedType,
            actual: actualType,
            severity: 'high'
          });
        } else if (actualType === 'USER-DEFINED' && actualUdt !== expectedUdt) {
          log('yellow', `   ⚠️  ${table}.${column}: enum diverso (atteso ${expectedUdt}, trovato ${actualUdt})`);
        } else {
          log('green', `   ✅ ${table}.${column}: tipo corretto (${actualType}${actualUdt ? ` / ${actualUdt}` : ''})`);
        }
      } catch (error) {
        log('yellow', `   ⚠️  ${table}.${column}: errore verifica (${error.message})`);
      }
    }

    // ============================================================================
    // 3. VERIFICA DEFAULT VALUES SU COLONNE ID
    // ============================================================================
    log('cyan', '\n📋 [3/3] Verifica Default Values su Colonne ID...\n');

    const idColumns = [
      { table: 'users', column: 'id' },
      { table: 'organizations', column: 'id' },
      { table: 'organization_invitations', column: 'id' },
      { table: 'jobs', column: 'id' },
      { table: 'job_offers', column: 'id' },
      { table: 'bookings', column: 'id' },
    ];

    for (const { table, column } of idColumns) {
      const defaultQuery = `
        SELECT column_default, is_nullable, data_type
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1 
        AND column_name = $2;
      `;
      
      try {
        const result = await client.query(defaultQuery, [table, column]);
        if (result.rows.length === 0) {
          log('yellow', `   ⚠️  ${table}.${column}: colonna non trovata`);
          continue;
        }

        const defaultValue = result.rows[0].column_default;
        const isNullable = result.rows[0].is_nullable;
        const dataType = result.rows[0].data_type;

        if (!defaultValue && isNullable === 'NO') {
          log('red', `   ❌ ${table}.${column}: manca DEFAULT (tipo: ${dataType}, nullable: NO)`);
          log('blue', `      Potrebbe causare errori INSERT se l'id non viene fornito`);
          criticalIssues.push({
            type: 'missing_default',
            table,
            column,
            dataType,
            severity: 'high'
          });
        } else if (defaultValue) {
          log('green', `   ✅ ${table}.${column}: DEFAULT presente`);
        } else {
          log('yellow', `   ⚠️  ${table}.${column}: nullable ma senza DEFAULT`);
        }
      } catch (error) {
        // Ignora
      }
    }

    // ============================================================================
    // RIEPILOGO
    // ============================================================================
    log('cyan', '\n' + '='.repeat(60));
    log('cyan', '📊 RIEPILOGO FINALE');
    log('cyan', '='.repeat(60));

    if (criticalIssues.length === 0) {
      log('green', '\n✅ Nessun disallineamento critico trovato!');
    } else {
      log('red', `\n❌ Trovati ${criticalIssues.length} problemi critici:\n`);
      
      criticalIssues.forEach((issue, index) => {
        log('red', `${index + 1}. ${issue.type.toUpperCase()}`);
        if (issue.type === 'enum_value_missing') {
          log('red', `   Enum: ${issue.enum}`);
          log('red', `   Valori mancanti: [${issue.values.map(v => `"${v}"`).join(', ')}]`);
          log('blue', `   Valori nel DB: [${issue.dbValues.map(v => `"${v}"`).join(', ')}]`);
        } else if (issue.type === 'column_type_mismatch') {
          log('red', `   Tabella: ${issue.table}.${issue.column}`);
          log('red', `   Atteso: ${issue.expected}, Trovato: ${issue.actual}`);
        } else if (issue.type === 'missing_default') {
          log('red', `   Tabella: ${issue.table}.${issue.column}`);
          log('red', `   Tipo: ${issue.dataType}`);
        }
        log('');
      });

      log('yellow', '\n💡 Suggerimenti:');
      log('yellow', '   - Per enum mancanti: usa ALTER TYPE "EnumName" ADD VALUE \'value\';');
      log('yellow', '   - Per colonne senza DEFAULT: aggiungi DEFAULT o genera ID nel codice');
      log('yellow', '   - Per tipi errati: considera migrazione a enum se appropriato');
    }

  } catch (error) {
    log('red', `\n❌ Errore: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkCriticalAlignment();

