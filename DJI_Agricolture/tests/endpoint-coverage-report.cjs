#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('📊 GENERAZIONE REPORT COPERTURA ENDPOINT\n');
console.log('='.repeat(70));

// Endpoint testati nei nostri test suite
const testedEndpoints = new Set([
  // Auth
  'POST /auth/login',
  'POST /auth/register',
  'GET /auth/me',
  
  // Ecommerce
  'POST /ecommerce/cart/items',
  'PUT /ecommerce/cart/items/:itemId',
  'DELETE /ecommerce/cart/items/:itemId',
  
  // Offers
  'POST /offers',
  'PUT /offers/:offerId',
  'DELETE /offers/:offerId',
  'GET /offers/:orgId',
  
  // Catalog
  'GET /catalog/public',
  'GET /catalog/vendor/:orgId',
  'PUT /catalog/vendor/:orgId/product',
  'POST /catalog/vendor/:orgId/toggle',
  
  // Settings
  'PATCH /settings/organization/general',
  
  // Orders
  'POST /orders/create-from-cart',
  'PUT /orders/:orderId/status',
  'POST /orders/:orderId/messages',
  'PUT /orders/:orderId/messages/read',
]);

// Estrai endpoint dalle route files
function extractEndpointsFromFile(filePath, basePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const endpoints = [];
  
  // Pattern per app.method('path', ...)
  const pattern = /app\.(get|post|put|patch|delete)\(['"`]([^'"`]+)['"`]/g;
  let match;
  
  while ((match = pattern.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const routePath = match[2];
    
    // Costruisci path completo usando il basePath mappato
    const fullPath = `${basePath}${routePath.startsWith('/') ? '' : '/'}${routePath}`;
    
    endpoints.push({
      method,
      path: routePath,
      fullPath,
      normalized: `${method} ${fullPath}`
    });
  }
  
  return endpoints;
}

// Mapping file -> base path (da hono-app.ts)
const routeMapping = {
  'auth-hono.ts': '/api/auth',
  'demo-hono.ts': '/api/demo',
  'drones-hono.ts': '/api/drones',
  'crops-hono.ts': '/api/crops',
  'treatments-hono.ts': '/api/treatments',
  'affiliates-hono.ts': '/api/affiliates',
  'fields-hono.ts': '/api/fields',
  'gis-categories-hono.ts': '/api/gis-categories',
  'orders-hono.ts': '/api/orders',
  'order-messages-hono.ts': '/api/orders',
  'missions-hono.ts': '/api/missions',
  'catalog-hono.ts': '/api/catalog',
  'offers-hono.ts': '/api/offers',
  'services-hono.ts': '/api/services',
  'operators-hono.ts': '/api/operators',
  'ecommerce-hono.ts': '/api/ecommerce',
  'routing-hono.ts': '/api/routing',
  'settings-hono.ts': '/api/settings',
  'bookings-hono.ts': '/api/bookings',
  'jobs-hono.ts': '/api/jobs',
  'saved-fields-hono.ts': '/api/saved-fields',
  'quote-estimate-hono.ts': '/api/quote-estimate',
  'certified-quotes-hono.ts': '/api/certified-quotes',
};

// Scansiona tutti i file route
const routesDir = path.join(__dirname, '../../server/routes');
const routeFiles = fs.readdirSync(routesDir)
  .filter(f => f.endsWith('.ts') && !f.includes('.backup'))
  .map(f => path.join(routesDir, f));

const allEndpoints = [];
const endpointsByFile = {};

routeFiles.forEach(file => {
  const fileName = path.basename(file);
  const basePath = routeMapping[fileName] || `/api/${fileName.replace('-hono.ts', '').replace('.ts', '')}`;
  
  const endpoints = extractEndpointsFromFile(file, basePath);
  endpointsByFile[fileName] = endpoints;
  allEndpoints.push(...endpoints.map(e => ({ ...e, file: fileName })));
});

// Categorizza endpoint
const tested = [];
const untested = [];
const mutative = []; // POST, PUT, PATCH, DELETE

// Helper per normalizzare path (rimuovi /api e parametri)
function normalizePathForMatch(path) {
  return path
    .replace(/^\/api/, '')
    .replace(/:[^/]+/g, ':param');
}

allEndpoints.forEach(endpoint => {
  const isMutative = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(endpoint.method);
  
  // Normalizza il path dell'endpoint (rimuovi /api prefix se presente)
  const endpointPath = endpoint.path.startsWith('/') ? endpoint.path : `/${endpoint.path}`;
  const normalizedEndpointPath = normalizePathForMatch(endpointPath);
  
  const isTested = Array.from(testedEndpoints).some(tested => {
    const [method, path] = tested.split(' ');
    if (method !== endpoint.method) return false;
    
    const normalizedTestPath = normalizePathForMatch(path);
    // Match esatto o con parametri
    return normalizedEndpointPath === normalizedTestPath ||
           normalizedEndpointPath.replace(/:param/g, '.*') === normalizedTestPath.replace(/:param/g, '.*');
  });
  
  if (isMutative) mutative.push(endpoint);
  
  if (isTested) {
    tested.push(endpoint);
  } else {
    untested.push(endpoint);
  }
});

// Print report
console.log('\n📋 STATISTICHE:\n');
console.log(`Totale endpoint trovati: ${allEndpoints.length}`);
console.log(`Endpoint testati: ${tested.length}`);
console.log(`Endpoint non testati: ${untested.length}`);
console.log(`Endpoint mutativi (POST/PUT/PATCH/DELETE): ${mutative.length}`);
console.log(`Endpoint mutativi testati: ${mutative.filter(e => tested.includes(e)).length}`);
console.log(`Endpoint mutativi non testati: ${mutative.filter(e => untested.includes(e)).length}`);

console.log('\n❌ ENDPOINT MUTATIVI NON TESTATI (PRIORITÀ ALTA):\n');
const untestedMutative = untested.filter(e => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(e.method));
untestedMutative.forEach(e => {
  console.log(`  ${e.method.padEnd(6)} ${e.normalized.padEnd(60)} [${e.file}]`);
});

console.log('\n📋 ALTRI ENDPOINT NON TESTATI:\n');
const untestedReadOnly = untested.filter(e => e.method === 'GET');
untestedReadOnly.slice(0, 20).forEach(e => {
  console.log(`  ${e.method.padEnd(6)} ${e.normalized.padEnd(60)} [${e.file}]`);
});
if (untestedReadOnly.length > 20) {
  console.log(`  ... e altri ${untestedReadOnly.length - 20} GET endpoints`);
}

console.log('\n✅ ENDPOINT TESTATI:\n');
tested.slice(0, 15).forEach(e => {
  console.log(`  ${e.method.padEnd(6)} ${e.normalized.padEnd(60)} [${e.file}]`);
});
if (tested.length > 15) {
  console.log(`  ... e altri ${tested.length - 15} endpoint`);
}

// Salva report dettagliato
const reportPath = path.join(__dirname, 'endpoint-coverage-report.txt');
const report = `
ENDPOINT COVERAGE REPORT
Generated: ${new Date().toISOString()}

TOTALE: ${allEndpoints.length} endpoint
TESTATI: ${tested.length} (${((tested.length / allEndpoints.length) * 100).toFixed(1)}%)
NON TESTATI: ${untested.length} (${((untested.length / allEndpoints.length) * 100).toFixed(1)}%)

ENDPOINT MUTATIVI NON TESTATI (CRITICI):
${untestedMutative.map(e => `${e.method} ${e.normalized} [${e.file}]`).join('\n')}

ALTRI ENDPOINT NON TESTATI:
${untestedReadOnly.map(e => `${e.method} ${e.normalized} [${e.file}]`).join('\n')}
`;

fs.writeFileSync(reportPath, report);
console.log(`\n📄 Report dettagliato salvato in: ${reportPath}\n`);

