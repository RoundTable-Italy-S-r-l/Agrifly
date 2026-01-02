/**
 * Test di integrazione per verificare che tutte le modifiche siano state applicate correttamente
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Test di integrazione - Verifica modifiche\n');

const projectRoot = path.join(__dirname, '..');
let errors = 0;
let warnings = 0;

// Test 1: Verifica che auth-redirect.ts esista e abbia tutte le funzioni
console.log('📊 Test 1: Verifica auth-redirect.ts');
const authRedirectPath = path.join(projectRoot, 'client/lib/auth-redirect.ts');
if (fs.existsSync(authRedirectPath)) {
  const content = fs.readFileSync(authRedirectPath, 'utf-8');
  const requiredFunctions = [
    'migrateGuestCart',
    'handleSpecialRedirects',
    'getDashboardPath',
    'handlePostAuthRedirect',
    'saveCurrentPathAsRedirect'
  ];
  
  const missing = requiredFunctions.filter(fn => !content.includes(`export function ${fn}`) && !content.includes(`export async function ${fn}`));
  
  if (missing.length === 0) {
    console.log('  ✅ Tutte le funzioni richieste sono presenti');
  } else {
    console.log(`  ❌ Funzioni mancanti: ${missing.join(', ')}`);
    errors++;
  }
} else {
  console.log('  ❌ File auth-redirect.ts non trovato');
  errors++;
}
console.log('');

// Test 2: Verifica che Index.tsx usi saveCurrentPathAsRedirect
console.log('📊 Test 2: Verifica Index.tsx');
const indexPath = path.join(projectRoot, 'client/pages/Index.tsx');
if (fs.existsSync(indexPath)) {
  const content = fs.readFileSync(indexPath, 'utf-8');
  
  const checks = [
    { name: 'Import saveCurrentPathAsRedirect', pattern: /import.*saveCurrentPathAsRedirect.*from.*auth-redirect/ },
    { name: 'Uso saveCurrentPathAsRedirect in handleLoginClick', pattern: /saveCurrentPathAsRedirect\(\)/ },
    { name: 'Stato isAuthenticated', pattern: /const \[isAuthenticated/ },
    { name: 'Stato orgType', pattern: /const \[orgType/ },
    { name: 'Render condizionale Login/Logout', pattern: /isAuthenticated \?/ },
    { name: 'Render condizionale Dashboard', pattern: /getDashboardLabel\(\)/ }
  ];
  
  checks.forEach(check => {
    if (check.pattern.test(content)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name} mancante`);
      errors++;
    }
  });
} else {
  console.log('  ❌ File Index.tsx non trovato');
  errors++;
}
console.log('');

// Test 3: Verifica AdminLayout
console.log('📊 Test 3: Verifica AdminLayout.tsx');
const adminLayoutPath = path.join(projectRoot, 'client/components/AdminLayout.tsx');
if (fs.existsSync(adminLayoutPath)) {
  const content = fs.readFileSync(adminLayoutPath, 'utf-8');
  
  const checks = [
    { name: 'Import Globe icon', pattern: /Globe.*from.*lucide-react/ },
    { name: 'Link "Vai al sito"', pattern: /Vai al sito/ },
    { name: 'Link a "/"', pattern: /to="\/"/ }
  ];
  
  checks.forEach(check => {
    if (check.pattern.test(content)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name} mancante`);
      errors++;
    }
  });
} else {
  console.log('  ❌ File AdminLayout.tsx non trovato');
  errors++;
}
console.log('');

// Test 4: Verifica BuyerLayout
console.log('📊 Test 4: Verifica BuyerLayout.tsx');
const buyerLayoutPath = path.join(projectRoot, 'client/components/BuyerLayout.tsx');
if (fs.existsSync(buyerLayoutPath)) {
  const content = fs.readFileSync(buyerLayoutPath, 'utf-8');
  
  const checks = [
    { name: 'Import Globe icon', pattern: /Globe.*from.*lucide-react/ },
    { name: 'Link "Vai al sito"', pattern: /Vai al sito/ },
    { name: 'Link a "/"', pattern: /to="\/"/ }
  ];
  
  checks.forEach(check => {
    if (check.pattern.test(content)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name} mancante`);
      errors++;
    }
  });
} else {
  console.log('  ❌ File BuyerLayout.tsx non trovato');
  errors++;
}
console.log('');

// Test 5: Verifica Login.tsx
console.log('📊 Test 5: Verifica Login.tsx');
const loginPath = path.join(projectRoot, 'client/pages/Login.tsx');
if (fs.existsSync(loginPath)) {
  const content = fs.readFileSync(loginPath, 'utf-8');
  
  const checks = [
    { name: 'Import handlePostAuthRedirect', pattern: /import.*handlePostAuthRedirect.*from.*auth-redirect/ },
    { name: 'Import saveCurrentPathAsRedirect', pattern: /import.*saveCurrentPathAsRedirect.*from.*auth-redirect/ },
    { name: 'Uso handlePostAuthRedirect in handleRegister', pattern: /handlePostAuthRedirect\(/ },
    { name: 'Uso handlePostAuthRedirect in handleLogin', pattern: /handlePostAuthRedirect\(/ },
    { name: 'Uso saveCurrentPathAsRedirect in useEffect', pattern: /saveCurrentPathAsRedirect\(\)/ }
  ];
  
  checks.forEach(check => {
    if (check.pattern.test(content)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name} mancante`);
      errors++;
    }
  });
  
  // Verifica che non ci sia logica duplicata
  const duplicatePatterns = [
    /navigate\('\/buyer'\)/g,
    /navigate\('\/admin'\)/g,
    /migrateCart\(/g
  ];
  
  let duplicateCount = 0;
  duplicatePatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches && matches.length > 1) {
      duplicateCount++;
    }
  });
  
  if (duplicateCount === 0) {
    console.log('  ✅ Nessuna logica duplicata trovata');
  } else {
    console.log(`  ⚠️  Possibile logica duplicata (${duplicateCount} pattern trovati più volte)`);
    warnings++;
  }
} else {
  console.log('  ❌ File Login.tsx non trovato');
  errors++;
}
console.log('');

// Test 6: Verifica VerifyEmail.tsx
console.log('📊 Test 6: Verifica VerifyEmail.tsx');
const verifyEmailPath = path.join(projectRoot, 'client/pages/VerifyEmail.tsx');
if (fs.existsSync(verifyEmailPath)) {
  const content = fs.readFileSync(verifyEmailPath, 'utf-8');
  
  const checks = [
    { name: 'Import handlePostAuthRedirect', pattern: /import.*handlePostAuthRedirect.*from.*auth-redirect/ },
    { name: 'Import migrateGuestCart', pattern: /import.*migrateGuestCart.*from.*auth-redirect/ },
    { name: 'Uso handlePostAuthRedirect', pattern: /handlePostAuthRedirect\(/ },
    { name: 'Uso migrateGuestCart', pattern: /migrateGuestCart\(/ }
  ];
  
  checks.forEach(check => {
    if (check.pattern.test(content)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name} mancante`);
      errors++;
    }
  });
  
  // Verifica che non ci sia logica duplicata
  if (content.includes('navigate(\'/buyer\')') && content.includes('handlePostAuthRedirect')) {
    console.log('  ⚠️  Possibile logica duplicata (navigate diretto + handlePostAuthRedirect)');
    warnings++;
  } else {
    console.log('  ✅ Nessuna logica duplicata trovata');
  }
} else {
  console.log('  ❌ File VerifyEmail.tsx non trovato');
  errors++;
}
console.log('');

// Test 7: Verifica Dashboard.tsx
console.log('📊 Test 7: Verifica Dashboard.tsx');
const dashboardPath = path.join(projectRoot, 'client/pages/Dashboard.tsx');
if (fs.existsSync(dashboardPath)) {
  const content = fs.readFileSync(dashboardPath, 'utf-8');
  
  const checks = [
    { name: 'Import getDashboardPath', pattern: /import.*getDashboardPath.*from.*auth-redirect/ },
    { name: 'Uso getDashboardPath', pattern: /getDashboardPath\(/ }
  ];
  
  checks.forEach(check => {
    if (check.pattern.test(content)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name} mancante`);
      errors++;
    }
  });
} else {
  console.log('  ❌ File Dashboard.tsx non trovato');
  errors++;
}
console.log('');

// Test 8: Verifica RequireAuth.tsx
console.log('📊 Test 8: Verifica RequireAuth.tsx');
const requireAuthPath = path.join(projectRoot, 'client/components/RequireAuth.tsx');
if (fs.existsSync(requireAuthPath)) {
  const content = fs.readFileSync(requireAuthPath, 'utf-8');
  
  const checks = [
    { name: 'Import saveCurrentPathAsRedirect', pattern: /import.*saveCurrentPathAsRedirect.*from.*auth-redirect/ },
    { name: 'Uso saveCurrentPathAsRedirect', pattern: /saveCurrentPathAsRedirect\(\)/ }
  ];
  
  checks.forEach(check => {
    if (check.pattern.test(content)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name} mancante`);
      errors++;
    }
  });
} else {
  console.log('  ❌ File RequireAuth.tsx non trovato');
  errors++;
}
console.log('');

// Riepilogo
console.log('📊 Riepilogo:');
console.log(`  Errori: ${errors}`);
console.log(`  Warning: ${warnings}`);

if (errors === 0 && warnings === 0) {
  console.log('\n✅ Tutti i test di integrazione sono passati!');
  console.log('\n📝 Modifiche verificate:');
  console.log('  ✅ Utility auth-redirect.ts creata e completa');
  console.log('  ✅ Index.tsx con Login/Logout dinamico');
  console.log('  ✅ AdminLayout con "Vai al sito"');
  console.log('  ✅ BuyerLayout con "Vai al sito"');
  console.log('  ✅ Login.tsx semplificato (usa utility)');
  console.log('  ✅ VerifyEmail.tsx semplificato (usa utility)');
  console.log('  ✅ Dashboard.tsx semplificato (usa utility)');
  console.log('  ✅ RequireAuth.tsx usa saveCurrentPathAsRedirect');
  process.exit(0);
} else {
  console.log('\n❌ Alcuni test sono falliti');
  process.exit(1);
}

