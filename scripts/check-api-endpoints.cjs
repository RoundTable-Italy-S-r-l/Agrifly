const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// Estrai tutti gli endpoint chiamati dal frontend
async function extractFrontendEndpoints() {
  const clientDir = path.join(__dirname, '..', 'client');
  const files = await glob('**/*.{ts,tsx}', { cwd: clientDir, absolute: true });
  
  const endpoints = new Set();
  
  // Pattern per trovare chiamate API
  const patterns = [
    /apiRequest<[^>]+>\(['"]([^'"]+)['"]/g,
    /fetch\(['"]\/api\/([^'"?]+)/g,
    /fetch\(`\/api\/([^`]+)`/g,
    /`\/api\/([^`]+)`/g,
  ];
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const endpoint = match[1];
          // Rimuovi query params e variabili template
          const cleanEndpoint = endpoint.split('?')[0].split('${')[0].replace(/`/g, '');
          if (cleanEndpoint && !cleanEndpoint.includes('${') && !cleanEndpoint.includes('`')) {
            endpoints.add(cleanEndpoint);
          }
        }
      }
    } catch (err) {
      console.error(`Error reading ${file}:`, err.message);
    }
  }
  
  return Array.from(endpoints).sort();
}

// Estrai tutte le route definite nel backend
async function extractBackendRoutes() {
  const serverDir = path.join(__dirname, '..', 'server');
  const routeFiles = await glob('**/*-hono.ts', { cwd: serverDir, absolute: true });
  
  const routes = new Set();
  
  // Leggi hono-app.ts per vedere come sono montate le route
  const honoAppPath = path.join(serverDir, 'hono-app.ts');
  const honoAppContent = fs.readFileSync(honoAppPath, 'utf-8');
  
  // Estrai app.route('/api/...', ...)
  const routeMounts = honoAppContent.match(/app\.route\(['"]\/api\/([^'"]+)['"]/g) || [];
  for (const mount of routeMounts) {
    const mountPath = mount.match(/['"]\/api\/([^'"]+)['"]/)[1];
    routes.add(mountPath);
  }
  
  // Estrai app.get('/api/...', ...) e altri metodi diretti
  const directRoutes = honoAppContent.match(/app\.(get|post|put|delete)\(['"]\/api\/([^'"]+)['"]/g) || [];
  for (const route of directRoutes) {
    const routePath = route.match(/['"]\/api\/([^'"]+)['"]/)[1];
    routes.add(routePath);
  }
  
  // Analizza ogni file di route per vedere le route definite
  for (const routeFile of routeFiles) {
    try {
      const content = fs.readFileSync(routeFile, 'utf-8');
      
      // Estrai app.get('/...', ...), app.post('/...', ...), etc.
      const routePatterns = [
        /app\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g,
        /app\.(get|post|put|delete|patch)\(`([^`]+)`/g,
      ];
      
      for (const pattern of routePatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const routePath = match[2];
          // Aggiungi la route (senza parametri dinamici per ora)
          if (routePath && !routePath.includes('${')) {
            routes.add(routePath);
          }
        }
      }
    } catch (err) {
      console.error(`Error reading ${routeFile}:`, err.message);
    }
  }
  
  return Array.from(routes).sort();
}

// Verifica se un endpoint frontend corrisponde a una route backend
function findMatchingBackendRoute(frontendEndpoint, backendRoutes) {
  // Rimuovi il primo slash se presente
  const cleanEndpoint = frontendEndpoint.startsWith('/') ? frontendEndpoint.slice(1) : frontendEndpoint;
  
  // Cerca corrispondenze esatte o parziali
  for (const backendRoute of backendRoutes) {
    const cleanBackendRoute = backendRoute.startsWith('/') ? backendRoute.slice(1) : backendRoute;
    
    // Match esatto
    if (cleanEndpoint === cleanBackendRoute) {
      return backendRoute;
    }
    
    // Match con parametri (es: /jobs/:jobId vs /jobs/123)
    const backendPattern = cleanBackendRoute.replace(/:[^/]+/g, '[^/]+');
    const regex = new RegExp(`^${backendPattern}$`);
    if (regex.test(cleanEndpoint)) {
      return backendRoute;
    }
  }
  
  // Cerca match parziali (es: jobs/operator/jobs vs operator/jobs quando montato su /api/jobs)
  const endpointParts = cleanEndpoint.split('/');
  for (const backendRoute of backendRoutes) {
    const cleanBackendRoute = backendRoute.startsWith('/') ? backendRoute.slice(1) : backendRoute;
    const routeParts = cleanBackendRoute.split('/');
    
    // Se l'endpoint inizia con le parti della route
    if (endpointParts.length >= routeParts.length) {
      const match = routeParts.every((part, i) => {
        if (part.startsWith(':')) return true; // Parametro dinamico
        return endpointParts[i] === part;
      });
      if (match) {
        return backendRoute;
      }
    }
  }
  
  return null;
}

async function main() {
  console.log('🔍 Analisi endpoint frontend e backend...\n');
  
  const frontendEndpoints = await extractFrontendEndpoints();
  const backendRoutes = await extractBackendRoutes();
  
  console.log('📋 Endpoint chiamati dal frontend:');
  frontendEndpoints.forEach(ep => console.log(`  - /api/${ep}`));
  
  console.log('\n📋 Route definite nel backend:');
  backendRoutes.forEach(r => console.log(`  - /api/${r}`));
  
  console.log('\n🔍 Verifica corrispondenze...\n');
  
  const missing = [];
  const warnings = [];
  
  for (const frontendEndpoint of frontendEndpoints) {
    const match = findMatchingBackendRoute(frontendEndpoint, backendRoutes);
    
    if (!match) {
      missing.push(frontendEndpoint);
      console.log(`❌ /api/${frontendEndpoint} - NON TROVATO nel backend`);
    } else if (match !== frontendEndpoint) {
      warnings.push({ frontend: frontendEndpoint, backend: match });
      console.log(`⚠️  /api/${frontendEndpoint} - corrisponde a /api/${match} (potenziale discrepanza)`);
    } else {
      console.log(`✅ /api/${frontendEndpoint} - OK`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 RIEPILOGO');
  console.log('='.repeat(80));
  console.log(`\n✅ Endpoint trovati: ${frontendEndpoints.length - missing.length - warnings.length}`);
  console.log(`⚠️  Endpoint con discrepanze: ${warnings.length}`);
  console.log(`❌ Endpoint mancanti: ${missing.length}`);
  
  if (missing.length > 0) {
    console.log('\n❌ ENDPOINT MANCANTI:');
    missing.forEach(ep => console.log(`  - /api/${ep}`));
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  DISCREPANZE TROVATE:');
    warnings.forEach(w => console.log(`  Frontend: /api/${w.frontend} → Backend: /api/${w.backend}`));
  }
  
  return { missing, warnings };
}

main().catch(console.error);

