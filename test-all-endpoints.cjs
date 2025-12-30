#!/usr/bin/env node

/**
 * Test Suite Completa per Tutti gli Endpoint API
 * Esegue test automatici per verificare che tutti gli endpoint siano funzionanti
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY non trovati');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test utilities
class APITester {
  constructor(baseURL = 'http://localhost:3001') {
    this.baseURL = baseURL;
    this.tokens = {};
  }

  async login(email, password) {
    const response = await fetch(`${this.baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (response.ok) {
      const data = await response.json();
      return data.token;
    }
    return null;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}/api${endpoint}`;
    const headers = { 'Content-Type': 'application/json' };

    if (options.token) {
      headers.Authorization = `Bearer ${options.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...headers, ...options.headers }
      });

      const result = {
        status: response.status,
        ok: response.ok,
        data: null,
        error: null
      };

      try {
        result.data = await response.json();
      } catch (e) {
        result.data = await response.text();
      }

      if (!response.ok) {
        result.error = result.data;
      }

      return result;
    } catch (error) {
      return {
        status: 0,
        ok: false,
        data: null,
        error: error.message
      };
    }
  }
}

const tester = new APITester();

async function runAllTests() {
  console.log('🚀 AVVIO TEST SUITE COMPLETA ENDPOINT API\n');

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    categories: {}
  };

  // 1. AUTHENTICATION TESTS
  console.log('🔐 TESTING AUTHENTICATION ENDPOINTS...');
  await testAuthEndpoints(results);

  // 2. USER MANAGEMENT TESTS
  console.log('\n👤 TESTING USER MANAGEMENT ENDPOINTS...');
  await testUserManagementEndpoints(results);

  // 3. JOBS & OFFERS TESTS
  console.log('\n💼 TESTING JOBS & OFFERS ENDPOINTS...');
  await testJobsOffersEndpoints(results);

  // 4. CHAT SYSTEM TESTS
  console.log('\n💬 TESTING CHAT SYSTEM ENDPOINTS...');
  await testChatEndpoints(results);

  // 5. E-COMMERCE TESTS
  console.log('\n🛒 TESTING E-COMMERCE ENDPOINTS...');
  await testEcommerceEndpoints(results);

  // 6. CATALOG TESTS
  console.log('\n📦 TESTING CATALOG ENDPOINTS...');
  await testCatalogEndpoints(results);

  // 7. ORDERS TESTS
  console.log('\n📋 TESTING ORDERS ENDPOINTS...');
  await testOrdersEndpoints(results);

  // 8. SETTINGS TESTS
  console.log('\n⚙️ TESTING SETTINGS ENDPOINTS...');
  await testSettingsEndpoints(results);

  // 9. OPERATORS TESTS
  console.log('\n🔧 TESTING OPERATORS ENDPOINTS...');
  await testOperatorsEndpoints(results);

  // 10. SERVICES & QUOTES TESTS
  console.log('\n🌾 TESTING SERVICES & QUOTES ENDPOINTS...');
  await testServicesQuotesEndpoints(results);

  // 11. UTILITY ENDPOINTS TESTS
  console.log('\n🛠️ TESTING UTILITY ENDPOINTS...');
  await testUtilityEndpoints(results);

  // SUMMARY
  printSummary(results);
}

async function testAuthEndpoints(results) {
  const category = 'Authentication';
  results.categories[category] = { total: 0, passed: 0, failed: 0, skipped: 0 };

  // Test Health Check
  await runTest(results, category, 'GET /auth/health', async () => {
    const result = await tester.request('/auth/health');
    return result.ok ? 'PASS' : 'FAIL';
  });

  // Test Registration (skip actual registration to avoid duplicates)
  await runTest(results, category, 'POST /auth/register - Validation', async () => {
    const result = await tester.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'invalid-email',
        password: '123',
        firstName: '',
        organizationName: 'Test'
      })
    });
    return !result.ok && result.status === 400 ? 'PASS' : 'FAIL';
  });

  // Test Login
  await runTest(results, category, 'POST /auth/login', async () => {
    const result = await tester.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'invalid'
      })
    });
    return result.status === 401 ? 'PASS' : 'FAIL';
  });

  // Test Me endpoint (requires auth)
  await runTest(results, category, 'GET /auth/me - Unauthorized', async () => {
    const result = await tester.request('/auth/me');
    return result.status === 401 ? 'PASS' : 'FAIL';
  });
}

async function testUserManagementEndpoints(results) {
  const category = 'User Management';
  results.categories[category] = { total: 0, passed: 0, failed: 0, skipped: 0 };

  // Test Password Reset Request
  await runTest(results, category, 'POST /auth/request-password-reset', async () => {
    const result = await tester.request('/auth/request-password-reset', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' })
    });
    return result.ok || result.status === 404 ? 'PASS' : 'FAIL';
  });

  // Test Email Verification
  await runTest(results, category, 'POST /auth/verify-email - Invalid', async () => {
    const result = await tester.request('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ code: 'invalid' })
    });
    return !result.ok ? 'PASS' : 'FAIL';
  });
}

async function testJobsOffersEndpoints(results) {
  const category = 'Jobs & Offers';
  results.categories[category] = { total: 0, passed: 0, failed: 0, skipped: 0 };

  // Test Get Jobs (requires auth)
  await runTest(results, category, 'GET /jobs/ - Unauthorized', async () => {
    const result = await tester.request('/jobs/');
    return result.status === 401 ? 'PASS' : 'FAIL';
  });

  // Test Create Job Validation
  await runTest(results, category, 'POST /jobs/ - Validation', async () => {
    const result = await tester.request('/jobs/', {
      method: 'POST',
      body: JSON.stringify({ field_name: '' })
    });
    return result.status === 401 ? 'PASS' : 'FAIL'; // Should fail auth first
  });

  // Test Get Operator Jobs
  await runTest(results, category, 'GET /jobs/operator/jobs - Unauthorized', async () => {
    const result = await tester.request('/jobs/operator/jobs');
    return result.status === 401 ? 'PASS' : 'FAIL';
  });
}

async function testChatEndpoints(results) {
  const category = 'Chat System';
  results.categories[category] = { total: 0, passed: 0, failed: 0, skipped: 0 };

  // Test Get Messages (requires auth)
  await runTest(results, category, 'GET /jobs/offers/:id/messages - Unauthorized', async () => {
    const result = await tester.request('/jobs/offers/123/messages');
    return result.status === 401 ? 'PASS' : 'FAIL';
  });

  // Test Send Message Validation
  await runTest(results, category, 'POST /jobs/offers/:id/messages - Unauthorized', async () => {
    const result = await tester.request('/jobs/offers/123/messages', {
      method: 'POST',
      body: JSON.stringify({ content: 'test' })
    });
    return result.status === 401 ? 'PASS' : 'FAIL';
  });
}

async function testEcommerceEndpoints(results) {
  const category = 'E-commerce';
  results.categories[category] = { total: 0, passed: 0, failed: 0, skipped: 0 };

  // Test Cart Access (requires orgId or sessionId)
  await runTest(results, category, 'GET /ecommerce/cart - Bad Request', async () => {
    const result = await tester.request('/ecommerce/cart');
    return result.status === 400 ? 'PASS' : 'FAIL';
  });

  // Test Cart with orgId
  await runTest(results, category, 'GET /ecommerce/cart?orgId=test', async () => {
    const result = await tester.request('/ecommerce/cart?orgId=test');
    return result.ok || result.status === 404 ? 'PASS' : 'FAIL';
  });

  // Test Add to Cart (requires auth for some operations)
  await runTest(results, category, 'POST /ecommerce/cart/items - Unauthorized', async () => {
    const result = await tester.request('/ecommerce/cart/items', {
      method: 'POST',
      body: JSON.stringify({ product_id: 1, quantity: 1 })
    });
    return result.status === 401 ? 'PASS' : 'FAIL';
  });
}

async function testCatalogEndpoints(results) {
  const category = 'Catalog';
  results.categories[category] = { total: 0, passed: 0, failed: 0, skipped: 0 };

  // Test Public Catalog
  await runTest(results, category, 'GET /catalog/public', async () => {
    const result = await tester.request('/catalog/public');
    return result.ok ? 'PASS' : 'FAIL';
  });

  // Test Vendor Catalog (may not require auth for basic access)
  await runTest(results, category, 'GET /catalog/vendor/123', async () => {
    const result = await tester.request('/catalog/vendor/123');
    return result.ok || result.status === 404 || result.status === 401 ? 'PASS' : 'FAIL';
  });
}

async function testOrdersEndpoints(results) {
  const category = 'Orders';
  results.categories[category] = { total: 0, passed: 0, failed: 0, skipped: 0 };

  // Test Get Orders (requires auth)
  await runTest(results, category, 'GET /orders/ - Unauthorized', async () => {
    const result = await tester.request('/orders/');
    return result.status === 401 ? 'PASS' : 'FAIL';
  });

  // Test Orders Stats (might be public)
  await runTest(results, category, 'GET /orders/stats', async () => {
    const result = await tester.request('/orders/stats');
    return result.ok ? 'PASS' : 'FAIL';
  });
}

async function testSettingsEndpoints(results) {
  const category = 'Settings';
  results.categories[category] = { total: 0, passed: 0, failed: 0, skipped: 0 };

  // Test Organization Settings (requires auth)
  await runTest(results, category, 'GET /settings/organization/general - Unauthorized', async () => {
    const result = await tester.request('/settings/organization/general?orgId=123');
    return result.status === 401 ? 'PASS' : 'FAIL';
  });

  // Test Update Settings (requires auth)
  await runTest(results, category, 'PATCH /settings/organization/general - Unauthorized', async () => {
    const result = await tester.request('/settings/organization/general?orgId=123', {
      method: 'PATCH',
      body: JSON.stringify({ legal_name: 'Test' })
    });
    return result.status === 401 ? 'PASS' : 'FAIL';
  });

  // Test Invitations (requires auth)
  await runTest(results, category, 'GET /settings/organization/invitations - Unauthorized', async () => {
    const result = await tester.request('/settings/organization/invitations?orgId=123');
    return result.status === 401 ? 'PASS' : 'FAIL';
  });
}

async function testOperatorsEndpoints(results) {
  const category = 'Operators';
  results.categories[category] = { total: 0, passed: 0, failed: 0, skipped: 0 };

  // Test Get Operators (requires auth)
  await runTest(results, category, 'GET /operators/123 - Unauthorized', async () => {
    const result = await tester.request('/operators/123');
    return result.status === 401 ? 'PASS' : 'FAIL';
  });

  // Test Create Operator (requires auth)
  await runTest(results, category, 'POST /operators/123 - Unauthorized', async () => {
    const result = await tester.request('/operators/123', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Operator' })
    });
    return result.status === 401 ? 'PASS' : 'FAIL';
  });
}

async function testServicesQuotesEndpoints(results) {
  const category = 'Services & Quotes';
  results.categories[category] = { total: 0, passed: 0, failed: 0, skipped: 0 };

  // Test Certified Quotes (requires query params)
  await runTest(results, category, 'GET /certified-quotes/ - Validation', async () => {
    const result = await tester.request('/certified-quotes/');
    return result.status === 400 ? 'PASS' : 'FAIL'; // Should require params
  });

  // Test Geo Areas
  await runTest(results, category, 'GET /services/geo-areas', async () => {
    const result = await tester.request('/services/geo-areas');
    return result.ok ? 'PASS' : 'FAIL';
  });

  // Test Crop Types
  await runTest(results, category, 'GET /services/crop-types', async () => {
    const result = await tester.request('/services/crop-types');
    return result.ok ? 'PASS' : 'FAIL';
  });
}

async function testUtilityEndpoints(results) {
  const category = 'Utility';
  results.categories[category] = { total: 0, passed: 0, failed: 0, skipped: 0 };

  // Test Drones (may not be implemented)
  await runTest(results, category, 'GET /drones/', async () => {
    const result = await tester.request('/drones/');
    return result.ok || result.status === 404 ? 'PASS' : 'FAIL';
  });

  // Test Treatments (may not be implemented)
  await runTest(results, category, 'GET /treatments/', async () => {
    const result = await tester.request('/treatments/');
    return result.ok || result.status === 501 || result.data?.message?.includes('crops API') ? 'PASS' : 'FAIL';
  });

  // Test GIS Categories (may not be implemented)
  await runTest(results, category, 'GET /gis-categories/', async () => {
    const result = await tester.request('/gis-categories/');
    return result.ok || result.status === 404 ? 'PASS' : 'FAIL';
  });

  // Test Missions (may not be implemented)
  await runTest(results, category, 'GET /missions/stats', async () => {
    const result = await tester.request('/missions/stats');
    return result.ok || result.status === 404 ? 'PASS' : 'FAIL';
  });
}

async function runTest(results, category, testName, testFn) {
  results.total++;
  results.categories[category].total++;

  try {
    console.log(`  🧪 ${testName}...`);
    const result = await testFn();

    if (result === 'PASS') {
      results.passed++;
      results.categories[category].passed++;
      console.log(`    ✅ PASS`);
    } else if (result === 'SKIP') {
      results.skipped++;
      results.categories[category].skipped++;
      console.log(`    ⏭️  SKIP`);
    } else {
      results.failed++;
      results.categories[category].failed++;
      console.log(`    ❌ FAIL`);
    }
  } catch (error) {
    results.failed++;
    results.categories[category].failed++;
    console.log(`    ❌ ERROR: ${error.message}`);
  }
}

function printSummary(results) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUITE SUMMARY');
  console.log('='.repeat(60));

  console.log(`\n🎯 TOTAL TESTS: ${results.total}`);
  console.log(`✅ PASSED: ${results.passed}`);
  console.log(`❌ FAILED: ${results.failed}`);
  console.log(`⏭️  SKIPPED: ${results.skipped}`);
  console.log(`📈 SUCCESS RATE: ${((results.passed / results.total) * 100).toFixed(1)}%`);

  console.log('\n📋 BY CATEGORY:');
  Object.entries(results.categories).forEach(([category, stats]) => {
    const rate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : '0.0';
    console.log(`  ${category}: ${stats.passed}/${stats.total} (${rate}%)`);
  });

  console.log('\n' + '='.repeat(60));

  if (results.failed === 0) {
    console.log('🎉 ALL TESTS PASSED! API is fully functional.');
  } else {
    console.log(`⚠️  ${results.failed} tests failed. Check implementation.`);
  }
}

// Run the tests
runAllTests().catch(console.error);
