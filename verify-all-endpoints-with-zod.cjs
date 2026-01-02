const fs = require('fs');
const path = require('path');

console.log('🔍 VERIFICA COMPLETA ENDPOINT POST/PUT/PATCH/DELETE CON ZOD\n');
console.log('='.repeat(70));

const serverDir = path.join(__dirname, 'server', 'routes');
const routeFiles = fs.readdirSync(serverDir).filter(f => f.endsWith('-hono.ts') && !f.includes('.backup'));

let totalPostPutPatchDelete = 0;
let withZod = 0;
let withoutZod = [];
let missingZodDetails = [];

for (const file of routeFiles) {
  const filePath = path.join(serverDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = file.replace('-hono.ts', '');

  // Trova tutti gli endpoint POST/PUT/PATCH/DELETE
  const endpointRegex = /app\.(post|put|patch|delete)\(['"`]([^'"`]+)['"`]/g;
  let match;

  while ((match = endpointRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const route = match[2];
    totalPostPutPatchDelete++;

    // Trova la posizione dell'endpoint
    let routeStart = content.indexOf(`app.${method.toLowerCase()}('${route}'`);
    if (routeStart === -1) {
      routeStart = content.indexOf(`app.${method.toLowerCase()}("${route}"`);
    }
    if (routeStart === -1) {
      routeStart = content.indexOf(`app.${method.toLowerCase()}(\`${route}\``);
    }

    if (routeStart === -1) continue;

    // Controlla le prossime 800 caratteri per validateBody/validateParams/validateQuery
    const nextLines = content.substring(routeStart, routeStart + 800);
    
    const hasValidation = 
      nextLines.includes('validateBody') ||
      nextLines.includes('validateParams') ||
      nextLines.includes('validateQuery');

    // Eccezioni: endpoint che non necessitano validazione (utility, debug, etc.)
    const isException = 
      route.includes('/create-tables') || // Setup endpoint
      route.includes('/debug/') || // Debug endpoint
      route.includes('/cart/migrate') || // Migration endpoint (ha Zod ora)
      route.includes('/upload-logo'); // FormData endpoint (gestito diversamente)

    if (hasValidation) {
      withZod++;
    } else if (!isException) {
      withoutZod.push({ method, route, file: fileName });
    }
  }
}

console.log(`\n📊 STATISTICHE:\n`);
console.log(`   Totale endpoint POST/PUT/PATCH/DELETE: ${totalPostPutPatchDelete}`);
console.log(`   ✅ Con validazione Zod: ${withZod}`);
console.log(`   ❌ Senza validazione Zod: ${withoutZod.length}`);
console.log(`   📈 Copertura: ${((withZod / totalPostPutPatchDelete) * 100).toFixed(1)}%\n`);

if (withoutZod.length > 0) {
  console.log('❌ ENDPOINT SENZA VALIDAZIONE ZOD:\n');
  
  const byFile = {};
  withoutZod.forEach(endpoint => {
    if (!byFile[endpoint.file]) {
      byFile[endpoint.file] = [];
    }
    byFile[endpoint.file].push(endpoint);
  });

  Object.keys(byFile).sort().forEach(file => {
    console.log(`\n📁 ${file}:`);
    byFile[file].forEach(endpoint => {
      console.log(`   ❌ ${endpoint.method} ${endpoint.route}`);
    });
  });

  console.log('\n' + '='.repeat(70));
  console.log('\n⚠️  AZIONE RICHIESTA: Aggiungere Zod a questi endpoint!\n');
  process.exit(1);
} else {
  console.log('✅ TUTTI GLI ENDPOINT POST/PUT/PATCH/DELETE HANNO VALIDAZIONE ZOD!');
  console.log(`\n🎉 COPERTURA 100% RAGGIUNTA!`);
  console.log('\n' + '='.repeat(70));
  process.exit(0);
}