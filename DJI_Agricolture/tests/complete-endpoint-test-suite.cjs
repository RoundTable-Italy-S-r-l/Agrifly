const { createClient } = require('@supabase/supabase-js');
const { TestDataFactory } = require('./test-factory-helpers');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE = 'http://localhost:3001/api';

const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

const TEST_ACCOUNTS = {
  vendor: {
    email: 'giacomo.cavalcabo14@gmail.com',
    password: '=Fn4Q8RvehTz7G@'
  },
  buyer: {
    email: 'giacomocavalcabo13@gmail.com',
    password: 'password'
  }
};

let authTokens = {};
let factory = new TestDataFactory();
let results = [];
let totalPassed = 0;
let totalFailed = 0;

function logTest(name, passed, details = '') {
  const icon = passed ? '✅' : '❌';
  const detailsStr = details ? `: ${details}` : '';
  console.log(`${icon} ${name}${detailsStr}`);
  results.push({ name, passed, details });
  if (passed) totalPassed++; else totalFailed++;
}

async function login(accountType) {
  const account = TEST_ACCOUNTS[accountType];
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: account.password })
  });
  if (response.ok) {
    const data = await response.json();
    return data.token || data.accessToken;
  }
  return null;
}

async function testEndpoint(endpoint) {
  const endpointName = `${endpoint.method} ${endpoint.path}`;
  console.log(`\n🔍 Testing ${endpointName}`);

  let endpointPassed = 0;
  let endpointFailed = 0;

  // Test 1: Contract invalid
  if (endpoint.invalidBody) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (endpoint.requiresAuth && authTokens[endpoint.authType || 'vendor']) {
        headers['Authorization'] = `Bearer ${authTokens[endpoint.authType || 'vendor']}`;
      }

      const response = await fetch(`${API_BASE}${endpoint.path}`, {
        method: endpoint.method,
        headers,
        body: JSON.stringify(endpoint.invalidBody)
      });

      if (response.status === 400) {
        endpointPassed++;
        logTest(`${endpointName} - Invalid body`, true, `Status: 400`);
      } else {
        endpointFailed++;
        const errorText = await response.text().catch(() => '');
        logTest(`${endpointName} - Invalid body`, false, `Status: ${response.status} (atteso: 400), Response: ${errorText.substring(0, 100)}`);
      }
    } catch (error) {
      endpointFailed++;
      logTest(`${endpointName} - Invalid body`, false, error.message);
    }
  }

  // Test 2: No auth
  if (endpoint.requiresAuth) {
    try {
      const response = await fetch(`${API_BASE}${endpoint.path}`, {
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' },
        body: endpoint.validBody ? JSON.stringify(endpoint.validBody) : null
      });

      if (response.status === 401) {
        endpointPassed++;
        logTest(`${endpointName} - No auth`, true, `Status: 401`);
      } else {
        endpointFailed++;
        logTest(`${endpointName} - No auth`, false, `Status: ${response.status} (atteso: 401)`);
      }
    } catch (error) {
      endpointFailed++;
      logTest(`${endpointName} - No auth`, false, error.message);
    }
  }

  // Test 3: Valid write + read-back
  if (endpoint.validBody && endpoint.requiresAuth && endpoint.verifyWrite) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authTokens[endpoint.authType || 'vendor']}`
      };

      // Setup se necessario
      if (endpoint.setup) {
        await endpoint.setup(factory);
      }

      // Esegui write
      const writeResponse = await fetch(`${API_BASE}${endpoint.path}`, {
        method: endpoint.method,
        headers,
        body: JSON.stringify(endpoint.validBody)
      });

      if (writeResponse.ok) {
        const writeData = await writeResponse.json();
        const recordId = writeData.id || endpoint.getId?.(writeData);

        // Read-back dal DB
        await new Promise(r => setTimeout(r, 500)); // Attendi sincronizzazione

        const verifyResult = await endpoint.verifyWrite(supabase, recordId, writeData);

        if (verifyResult.match) {
          endpointPassed++;
          logTest(`${endpointName} - Write + read-back`, true, `Record ID: ${recordId}`);
        } else {
          endpointFailed++;
          logTest(`${endpointName} - Write + read-back`, false, 
            `Field ${verifyResult.field}: expected ${verifyResult.expected}, got ${verifyResult.actual}`);
        }

        // Cleanup
        if (endpoint.teardown && recordId) {
          await endpoint.teardown(supabase, recordId);
        }
      } else {
        endpointFailed++;
        const errorText = await writeResponse.text().catch(() => '');
        logTest(`${endpointName} - Valid write`, false, `Status: ${writeResponse.status}, ${errorText.substring(0, 100)}`);
      }
    } catch (error) {
      endpointFailed++;
      logTest(`${endpointName} - Write + read-back`, false, error.message);
    }
  }

  return { passed: endpointPassed, failed: endpointFailed };
}

// Matrice endpoint completa
const endpoints = [
  {
    method: 'POST',
    path: '/offers',
    requiresAuth: true,
    authType: 'vendor',
    invalidBody: { offer_type: 'INVALID', name: '' },
    validBody: {
      offer_type: 'PROMO',
      name: `Test Offer ${Date.now()}`,
      rules_json: { discount_percent: 10 },
      valid_from: new Date().toISOString(),
      valid_to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'ACTIVE'
    },
    verifyWrite: async (db, recordId, writeData) => {
      const { data } = await db.from('offers').select('*').eq('id', recordId).single();
      if (!data) return { match: false, field: 'id', expected: recordId, actual: null };
      if (data.name !== writeData.name) {
        return { match: false, field: 'name', expected: writeData.name, actual: data.name };
      }
      return { match: true };
    },
    teardown: async (db, recordId) => {
      await db.from('offers').delete().eq('id', recordId);
    }
  },
  {
    method: 'PUT',
    path: '/offers/test-offer-id',
    requiresAuth: true,
    authType: 'vendor',
    invalidBody: { name: '' },
    // validBody e verifyWrite richiedono offer esistente
  },
  {
    method: 'PATCH',
    path: '/settings/organization/general',
    requiresAuth: true,
    authType: 'vendor',
    invalidBody: { legal_name: '' },
    validBody: async (factory) => {
      const meResponse = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${authTokens.vendor}` }
      });
      const me = await meResponse.json();
      const orgId = me.organization?.id || me.organizationId;
      return { 
        legal_name: `Test Org ${Date.now()}`,
        _orgId: orgId 
      };
    },
    pathBuilder: (body) => `/settings/organization/general?orgId=${body._orgId}`,
    verifyWrite: async (db, recordId, writeData) => {
      const orgId = writeData._orgId;
      const { data } = await db.from('organizations').select('legal_name').eq('id', orgId).single();
      if (!data) return { match: false, field: 'id', expected: orgId, actual: null };
      if (data.legal_name !== writeData.legal_name) {
        return { match: false, field: 'legal_name', expected: writeData.legal_name, actual: data.legal_name };
      }
      return { match: true };
    }
  },
  {
    method: 'POST',
    path: '/catalog/vendor/org-id/toggle',
    requiresAuth: true,
    authType: 'vendor',
    invalidBody: { isForSale: 'invalid' },
    validBody: async (factory) => {
      const meResponse = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${authTokens.vendor}` }
      });
      const me = await meResponse.json();
      const orgId = me.organization?.id || me.organizationId;

      // Crea setup: prodotto + inventory + catalog item
      const org = await factory.createOrg({ id: orgId });
      const product = await factory.createProduct();
      const inventory = await factory.createInventory(orgId, product.id, { qty_on_hand: 100 });
      const catalogItem = await factory.createVendorCatalogItem(orgId, inventory.sku_id, { is_for_sale: true });

      return {
        skuId: inventory.sku_id,
        isForSale: false,
        _catalogItemId: catalogItem.id,
        _orgId: orgId
      };
    },
    pathBuilder: (body) => `/catalog/vendor/${body._orgId}/toggle`,
    verifyWrite: async (db, recordId, writeData) => {
      const { data } = await db
        .from('vendor_catalog_items')
        .select('is_for_sale')
        .eq('id', writeData._catalogItemId)
        .single();
      
      if (!data) return { match: false, field: 'id', expected: writeData._catalogItemId, actual: null };
      if (data.is_for_sale !== writeData.isForSale) {
        return { match: false, field: 'is_for_sale', expected: writeData.isForSale, actual: data.is_for_sale };
      }
      return { match: true };
    },
    teardown: async (db, recordId, writeData) => {
      if (writeData._catalogItemId) {
        await db.from('vendor_catalog_items').delete().eq('id', writeData._catalogItemId);
      }
      await factory.cleanup();
    }
  }
];

async function runAllTests() {
  console.log('🚀 COMPLETE ENDPOINT TEST SUITE - Write + Read-Back Verification\n');
  console.log('='.repeat(70));

  // Login
  authTokens.vendor = await login('vendor');
  authTokens.buyer = await login('buyer');

  if (!authTokens.vendor) {
    console.error('❌ Cannot login vendor - aborting tests');
    process.exit(1);
  }

  for (const endpoint of endpoints) {
    // Costruisci path dinamico se necessario
    let path = endpoint.path;
    if (endpoint.pathBuilder && endpoint.validBody) {
      const body = typeof endpoint.validBody === 'function' 
        ? await endpoint.validBody(factory)
        : endpoint.validBody;
      path = endpoint.pathBuilder(body);
      endpoint.path = path;
      endpoint.validBody = body;
    }

    const result = await testEndpoint(endpoint);
  }

  // Cleanup finale
  await factory.cleanup();

  console.log('\n' + '='.repeat(70));
  console.log('\n📊 RISULTATI FINALI:\n');
  console.log(`✅ Test passati: ${totalPassed}`);
  console.log(`❌ Test falliti: ${totalFailed}`);
  console.log(`📈 Tasso successo: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);

  if (totalFailed === 0) {
    console.log('\n🎉 TUTTI I TEST SUPERATI!');
    process.exit(0);
  } else {
    console.log('\n⚠️ Alcuni test falliti - deploy bloccato');
    process.exit(1);
  }
}

runAllTests().catch(async (error) => {
  console.error('\n❌ Errore durante i test:', error);
  await factory.cleanup();
  process.exit(1);
});

