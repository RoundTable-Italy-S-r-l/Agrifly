#!/usr/bin/env node

/**
 * Script per verificare disallineamenti tra codice e database Supabase
 * 
 * Verifica:
 * 1. Enum values usati nel codice vs enum nel DB
 * 2. Tipi di colonne attesi vs tipi reali
 * 3. Colonne che il codice si aspetta vs colonne esistenti
 * 4. Valori hardcoded che potrebbero non esistere nel DB
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Colori per output
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

async function checkCodeVsDatabase() {
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

    const issues = [];

    // ============================================================================
    // 1. VERIFICA ENUM VALUES
    // ============================================================================
    log('cyan', '📋 [1/4] Verifica Enum Values...\n');

    // Estrai tutti gli enum dal database
    const dbEnumsQuery = `
      SELECT 
        t.typname as enum_name,
        e.enumlabel as enum_value
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid 
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

    log('blue', `   Trovati ${Object.keys(dbEnums).length} enum nel database:`);
    Object.keys(dbEnums).forEach(enumName => {
      log('blue', `     - ${enumName}: [${dbEnums[enumName].map(v => `"${v}"`).join(', ')}]`);
    });

    // Cerca enum values nel codice
    const codebasePath = path.join(__dirname, '..');
    const serverPath = path.join(codebasePath, 'server');
    
    const enumPatterns = {
      ProductType: /product_type\s*[=:]\s*['"]([^'"]+)['"]/gi,
      ServiceType: /service_type\s*[=:]\s*['"]([^'"]+)['"]/gi,
      BookingStatus: /status\s*[=:]\s*['"]([^'"]+)['"]/gi,
      OrgType: /type\s*[=:]\s*['"]([^'"]+)['"]/gi,
      OrgRole: /role\s*[=:]\s*['"]([^'"]+)['"]/gi,
    };

    const codeEnumValues = {};
    
    function scanDirectory(dir, relativePath = '') {
      const files = fs.readdirSync(dir);
      
      files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Salta node_modules e altre cartelle non rilevanti
          if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(file)) {
            scanDirectory(fullPath, path.join(relativePath, file));
          }
        } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            
            // Cerca pattern per ProductType
            if (content.includes('product_type') || content.includes('ProductType')) {
              const matches = content.matchAll(/product_type\s*[=:]\s*['"]([^'"]+)['"]/gi);
              for (const match of matches) {
                const value = match[1];
                if (!codeEnumValues.ProductType) codeEnumValues.ProductType = new Set();
                codeEnumValues.ProductType.add(value);
              }
            }
            
            // Cerca pattern per ServiceType
            if (content.includes('service_type') || content.includes('ServiceType')) {
              const matches = content.matchAll(/service_type\s*[=:]\s*['"]([^'"]+)['"]/gi);
              for (const match of matches) {
                const value = match[1];
                if (!codeEnumValues.ServiceType) codeEnumValues.ServiceType = new Set();
                codeEnumValues.ServiceType.add(value);
              }
            }
            
            // Cerca pattern per BookingStatus
            if (content.includes('status') && (content.includes('AWARDED') || content.includes('DONE') || content.includes('CONFIRMED'))) {
              const matches = content.matchAll(/status\s*[=:]\s*['"]([^'"]+)['"]/gi);
              for (const match of matches) {
                const value = match[1];
                if (['AWARDED', 'DONE', 'CONFIRMED', 'IN_PROGRESS', 'CANCELLED', 'OFFERED', 'WITHDRAWN'].includes(value)) {
                  if (!codeEnumValues.BookingStatus) codeEnumValues.BookingStatus = new Set();
                  codeEnumValues.BookingStatus.add(value);
                }
              }
            }
            
            // Cerca pattern per OrgType
            if (content.includes('org_type') || content.includes('orgType') || content.includes('type:') && content.includes('buyer')) {
              const matches = content.matchAll(/(?:org_type|orgType|type)\s*[=:]\s*['"]([^'"]+)['"]/gi);
              for (const match of matches) {
                const value = match[1];
                if (['buyer', 'vendor', 'operator', 'BUYER', 'VENDOR', 'OPERATOR'].includes(value)) {
                  if (!codeEnumValues.OrgType) codeEnumValues.OrgType = new Set();
                  codeEnumValues.OrgType.add(value);
                }
              }
            }
            
            // Cerca pattern per OrgRole
            if (content.includes('role') && (content.includes('admin') || content.includes('operator') || content.includes('dispatcher'))) {
              const matches = content.matchAll(/role\s*[=:]\s*['"]([^'"]+)['"]/gi);
              for (const match of matches) {
                const value = match[1];
                if (['admin', 'vendor', 'operator', 'dispatcher', 'ADMIN', 'VENDOR', 'OPERATOR', 'DISPATCHER'].includes(value)) {
                  if (!codeEnumValues.OrgRole) codeEnumValues.OrgRole = new Set();
                  codeEnumValues.OrgRole.add(value);
                }
              }
            }
          } catch (error) {
            // Ignora errori di lettura file
          }
        }
      });
    }

    scanDirectory(serverPath, 'server');

    // Converti Set in Array per confronto
    Object.keys(codeEnumValues).forEach(key => {
      codeEnumValues[key] = Array.from(codeEnumValues[key]);
    });

    log('blue', '\n   Valori trovati nel codice:');
    Object.keys(codeEnumValues).forEach(enumName => {
      log('blue', `     - ${enumName}: [${codeEnumValues[enumName].map(v => `"${v}"`).join(', ')}]`);
    });

    // Confronta con database
    log('yellow', '\n   🔍 Confronto con database:');
    
    // ProductType
    if (codeEnumValues.ProductType && dbEnums.ProductType) {
      const missing = codeEnumValues.ProductType.filter(v => !dbEnums.ProductType.includes(v));
      if (missing.length > 0) {
        issues.push({
          type: 'enum_value_missing',
          enum: 'ProductType',
          values: missing,
          severity: 'high'
        });
        log('red', `     ❌ ProductType: valori mancanti nel DB: [${missing.map(v => `"${v}"`).join(', ')}]`);
      } else {
        log('green', `     ✅ ProductType: tutti i valori presenti nel DB`);
      }
    }

    // ServiceType
    if (codeEnumValues.ServiceType && dbEnums.ServiceType) {
      const missing = codeEnumValues.ServiceType.filter(v => !dbEnums.ServiceType.includes(v));
      if (missing.length > 0) {
        issues.push({
          type: 'enum_value_missing',
          enum: 'ServiceType',
          values: missing,
          severity: 'high'
        });
        log('red', `     ❌ ServiceType: valori mancanti nel DB: [${missing.map(v => `"${v}"`).join(', ')}]`);
      } else {
        log('green', `     ✅ ServiceType: tutti i valori presenti nel DB`);
      }
    }

    // OrgType
    if (codeEnumValues.OrgType && dbEnums.OrgType) {
      const normalizedCodeValues = codeEnumValues.OrgType.map(v => v.toUpperCase());
      const normalizedDbValues = dbEnums.OrgType.map(v => v.toUpperCase());
      const missing = normalizedCodeValues.filter(v => !normalizedDbValues.includes(v));
      if (missing.length > 0) {
        issues.push({
          type: 'enum_value_missing',
          enum: 'OrgType',
          values: missing,
          severity: 'medium'
        });
        log('yellow', `     ⚠️  OrgType: valori potenzialmente mancanti (case-sensitive): [${missing.map(v => `"${v}"`).join(', ')}]`);
      } else {
        log('green', `     ✅ OrgType: tutti i valori presenti nel DB`);
      }
    }

    // OrgRole
    if (codeEnumValues.OrgRole && dbEnums.OrgRole) {
      const normalizedCodeValues = codeEnumValues.OrgRole.map(v => v.toLowerCase());
      const normalizedDbValues = dbEnums.OrgRole.map(v => v.toLowerCase());
      const missing = normalizedCodeValues.filter(v => !normalizedDbValues.includes(v));
      if (missing.length > 0) {
        issues.push({
          type: 'enum_value_missing',
          enum: 'OrgRole',
          values: missing,
          severity: 'high'
        });
        log('red', `     ❌ OrgRole: valori mancanti nel DB: [${missing.map(v => `"${v}"`).join(', ')}]`);
      } else {
        log('green', `     ✅ OrgRole: tutti i valori presenti nel DB`);
      }
    }

    // ============================================================================
    // 2. VERIFICA COLONNE MANCANTI
    // ============================================================================
    log('cyan', '\n📋 [2/4] Verifica Colonne Mancanti...\n');

    // Cerca riferimenti a colonne nel codice SQL
    const sqlFiles = [];
    function findSqlFiles(dir) {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !['node_modules', '.git', 'dist', 'build'].includes(file)) {
          findSqlFiles(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.js')) {
          sqlFiles.push(fullPath);
        }
      });
    }
    findSqlFiles(serverPath);

    const tableColumnReferences = {};
    
    sqlFiles.forEach(filePath => {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Cerca SELECT, INSERT, UPDATE con riferimenti a colonne
        const selectMatches = content.matchAll(/SELECT\s+([^FROM]+)\s+FROM\s+(\w+)/gi);
        const insertMatches = content.matchAll(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)/gi);
        const updateMatches = content.matchAll(/UPDATE\s+(\w+)\s+SET\s+([^WHERE]+)/gi);
        
        [selectMatches, insertMatches, updateMatches].forEach(matches => {
          for (const match of matches) {
            const tableName = match[2] || match[1];
            const columns = match[1] || match[2];
            
            if (!tableColumnReferences[tableName]) {
              tableColumnReferences[tableName] = new Set();
            }
            
            // Estrai nomi colonne
            columns.split(',').forEach(col => {
              const colName = col.trim().split(/\s+/)[0].replace(/[`"']/g, '');
              if (colName && !colName.includes('(') && !colName.includes('*')) {
                tableColumnReferences[tableName].add(colName);
              }
            });
          }
        });
      } catch (error) {
        // Ignora
      }
    });

    // Verifica colonne nel database
    log('blue', '   Verifica colonne per tabelle:');
    for (const [tableName, codeColumns] of Object.entries(tableColumnReferences)) {
      const dbColumnsQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1;
      `;
      
      try {
        const dbColumnsResult = await client.query(dbColumnsQuery, [tableName]);
        const dbColumns = dbColumnsResult.rows.map(r => r.column_name);
        const codeColsArray = Array.from(codeColumns);
        
        const missing = codeColsArray.filter(col => !dbColumns.includes(col));
        if (missing.length > 0) {
          issues.push({
            type: 'column_missing',
            table: tableName,
            columns: missing,
            severity: 'high'
          });
          log('red', `     ❌ ${tableName}: colonne mancanti: [${missing.join(', ')}]`);
        } else {
          log('green', `     ✅ ${tableName}: tutte le colonne presenti`);
        }
      } catch (error) {
        // Tabella potrebbe non esistere
        log('yellow', `     ⚠️  ${tableName}: tabella non trovata nel DB`);
      }
    }

    // ============================================================================
    // 3. VERIFICA TIPI DI COLONNE
    // ============================================================================
    log('cyan', '\n📋 [3/4] Verifica Tipi di Colonne Critiche...\n');

    const criticalColumns = [
      { table: 'products', column: 'product_type', expectedType: 'USER-DEFINED' },
      { table: 'organizations', column: 'type', expectedType: 'USER-DEFINED' },
      { table: 'org_memberships', column: 'role', expectedType: 'USER-DEFINED' },
      { table: 'job_offers', column: 'status', expectedType: 'character varying' },
      { table: 'bookings', column: 'status', expectedType: 'USER-DEFINED' },
    ];

    for (const { table, column, expectedType } of criticalColumns) {
      const typeQuery = `
        SELECT data_type, udt_name
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1 
        AND column_name = $2;
      `;
      
      try {
        const result = await client.query(typeQuery, [table, column]);
        if (result.rows.length > 0) {
          const actualType = result.rows[0].data_type;
          const udtName = result.rows[0].udt_name;
          
          if (expectedType === 'USER-DEFINED' && actualType !== 'USER-DEFINED') {
            issues.push({
              type: 'column_type_mismatch',
              table,
              column,
              expected: expectedType,
              actual: actualType,
              severity: 'high'
            });
            log('red', `     ❌ ${table}.${column}: atteso USER-DEFINED, trovato ${actualType}`);
          } else {
            log('green', `     ✅ ${table}.${column}: tipo corretto (${actualType}${udtName ? ` / ${udtName}` : ''})`);
          }
        } else {
          log('yellow', `     ⚠️  ${table}.${column}: colonna non trovata`);
        }
      } catch (error) {
        log('yellow', `     ⚠️  ${table}.${column}: errore verifica (${error.message})`);
      }
    }

    // ============================================================================
    // 4. VERIFICA DEFAULT VALUES
    // ============================================================================
    log('cyan', '\n📋 [4/4] Verifica Default Values Critici...\n');

    const criticalDefaults = [
      { table: 'organization_invitations', column: 'id' },
      { table: 'users', column: 'id' },
      { table: 'organizations', column: 'id' },
    ];

    for (const { table, column } of criticalDefaults) {
      const defaultQuery = `
        SELECT column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1 
        AND column_name = $2;
      `;
      
      try {
        const result = await client.query(defaultQuery, [table, column]);
        if (result.rows.length > 0) {
          const defaultValue = result.rows[0].column_default;
          
          if (!defaultValue && column === 'id') {
            issues.push({
              type: 'missing_default',
              table,
              column,
              severity: 'high'
            });
            log('red', `     ❌ ${table}.${column}: manca DEFAULT (potrebbe causare errori INSERT)`);
          } else {
            log('green', `     ✅ ${table}.${column}: DEFAULT presente (${defaultValue ? 'OK' : 'NULL'})`);
          }
        }
      } catch (error) {
        // Ignora
      }
    }

    // ============================================================================
    // RIEPILOGO FINALE
    // ============================================================================
    log('cyan', '\n' + '='.repeat(60));
    log('cyan', '📊 RIEPILOGO FINALE');
    log('cyan', '='.repeat(60));

    if (issues.length === 0) {
      log('green', '\n✅ Nessun disallineamento trovato!');
    } else {
      log('red', `\n❌ Trovati ${issues.length} disallineamenti:\n`);
      
      const highSeverity = issues.filter(i => i.severity === 'high');
      const mediumSeverity = issues.filter(i => i.severity === 'medium');
      
      if (highSeverity.length > 0) {
        log('red', `🔴 Alta priorità (${highSeverity.length}):`);
        highSeverity.forEach(issue => {
          if (issue.type === 'enum_value_missing') {
            log('red', `   - Enum ${issue.enum}: valori mancanti [${issue.values.join(', ')}]`);
          } else if (issue.type === 'column_missing') {
            log('red', `   - Tabella ${issue.table}: colonne mancanti [${issue.columns.join(', ')}]`);
          } else if (issue.type === 'missing_default') {
            log('red', `   - ${issue.table}.${issue.column}: manca DEFAULT`);
          }
        });
      }
      
      if (mediumSeverity.length > 0) {
        log('yellow', `\n🟡 Media priorità (${mediumSeverity.length}):`);
        mediumSeverity.forEach(issue => {
          log('yellow', `   - ${JSON.stringify(issue)}`);
        });
      }
    }

  } catch (error) {
    log('red', `\n❌ Errore: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkCodeVsDatabase();

