/**
 * Script per testare gli endpoints del sistema DJI Agras
 * Verifica che tutto funzioni correttamente con il nuovo sistema italiano
 */

const { execSync } = require('child_process');

const BASE_URL = 'http://localhost:3001/api';

// Test authentication token (da sostituire con uno valido)
const AUTH_TOKEN = 'test-token-replace-with-real-one';

async function testEndpoint(method, url, body = null, description = '') {
  try {
    console.log(`\n🔍 Test: ${description}`);
    console.log(`📡 ${method} ${url}`);

    let curlCommand = `curl -s -X ${method} "${BASE_URL}${url}"`;

    // Aggiungi headers
    curlCommand += ` -H "Content-Type: application/json"`;
    curlCommand += ` -H "Authorization: Bearer ${AUTH_TOKEN}"`;

    // Aggiungi body se presente
    if (body) {
      const bodyJson = JSON.stringify(body);
      curlCommand += ` -d '${bodyJson}'`;
    }

    // Aggiungi opzioni per ottenere status code
    curlCommand += ` -w "\\nHTTPSTATUS:%{http_code}"`;

    const result = execSync(curlCommand, { encoding: 'utf8' });
    const lines = result.trim().split('\n');
    const statusLine = lines.find(line => line.startsWith('HTTPSTATUS:'));
    const status = statusLine ? parseInt(statusLine.replace('HTTPSTATUS:', '')) : 0;
    const responseBody = lines.filter(line => !line.startsWith('HTTPSTATUS:')).join('\n');

    console.log(`📊 Status: ${status}`);

    let data;
    try {
      data = JSON.parse(responseBody);
    } catch (e) {
      data = responseBody;
    }

    if (status >= 200 && status < 300) {
      console.log('✅ SUCCESS');
      if (typeof data === 'object' && data !== null) {
        console.log('📋 Response:', JSON.stringify(data, null, 2).substring(0, 500) + '...');
      } else {
        console.log('📋 Response:', data);
      }
    } else {
      console.log('❌ ERROR');
      console.log('📋 Error Response:', data);
    }

    return { status, data };
  } catch (error) {
    console.log('❌ EXEC ERROR:', error.message);
    return { status: 0, error: error.message };
  }
}

async function runEndpointTests() {
  console.log('🚀 Test Endpoints Sistema DJI Agras');
  console.log('====================================\n');

  // 1. Test Health Check
  await testEndpoint('GET', '/health', null, 'Health Check');

  // 2. Test Authentication (login)
  console.log('\n🔐 Test Autenticazione');
  console.log('⚠️  NOTA: Per testare login, usa credenziali reali o commenta questo test');

  // Commentato per evitare errori senza credenziali reali
  // await testEndpoint('POST', '/auth/login', {
  //   email: 'operator@droneagri.it',
  //   password: 'password123'
  // }, 'Login Operatore');

  // 3. Test Job Offers (GET)
  await testEndpoint('GET', '/job-offers', null, 'Recupero Offerte di Lavoro');

  // 4. Test Jobs (GET)
  await testEndpoint('GET', '/jobs', null, 'Recupero Job Disponibili');

  // 5. Test Voice Assistant
  console.log('\n🤖 Test Voice Assistant');
  await testEndpoint('POST', '/voice-assistant/analyze', {
    text: "Tratta il vigneto con fungicida in collina"
  }, 'Analisi Testo Voice Assistant');

  // 6. Test Service Types
  await testEndpoint('GET', '/services/types', null, 'Recupero Tipi di Servizio');

  // 7. Test Rate Cards
  await testEndpoint('GET', '/rate-cards', null, 'Recupero Rate Cards');

  // 8. Test Operators
  await testEndpoint('GET', '/operators', null, 'Recupero Operatori');

  // 9. Test Categories/Tags
  await testEndpoint('GET', '/categories', null, 'Recupero Categorie');

  // 10. Test Certified Quotes (il problema dell'utente)
  await testEndpoint('GET', '/certified-quotes?service_type=IRRORAZIONE&area_ha=119.38846976143269&location_lat=46.00673927828152&location_lng=10.892189025878908&terrain_conditions=HILLY&crop_type=OLIVE_GROVE&treatment_type=FUNGICIDE', null, 'Test Certified Quotes IRRORAZIONE');

  console.log('\n📊 Test Endpoints Completato!');
  console.log('====================================');
  console.log('✅ Verifica i risultati sopra per eventuali errori');
  console.log('⚠️  Alcuni endpoint potrebbero richiedere autenticazione');
  console.log('🔧 Per test completi, assicurati che il server sia in esecuzione');
}

// Esegui i test
runEndpointTests()
  .then(() => {
    console.log('\n✅ Test completati');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Errore nei test:', error);
    process.exit(1);
  });
