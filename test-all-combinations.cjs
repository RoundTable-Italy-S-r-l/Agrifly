const https = require('https');

// Configurazione per le chiamate API
const API_BASE = 'https://agrifly.it/api';
const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  // Nota: dovrai aggiungere il token di autenticazione se necessario
};

// Combinazioni da testare
const COMBINATIONS = [
  // SPRAY combinations
  { service_type: 'SPRAY', treatment_type: 'FUNGICIDE' },
  { service_type: 'SPRAY', treatment_type: 'INSECTICIDE' },
  { service_type: 'SPRAY', treatment_type: 'HERBICIDE' },
  { service_type: 'SPRAY', treatment_type: 'FERTILIZER' },
  
  // SPREAD combinations
  { service_type: 'SPREAD', treatment_type: 'ORGANIC_FERTILIZER' },
  { service_type: 'SPREAD', treatment_type: 'CHEMICAL_FERTILIZER' },
  { service_type: 'SPREAD', treatment_type: 'LIME' },
  { service_type: 'SPREAD', treatment_type: 'OTHER' },
  
  // MAPPING combinations
  { service_type: 'MAPPING', treatment_type: 'NDVI' },
  { service_type: 'MAPPING', treatment_type: 'THERMAL' },
  { service_type: 'MAPPING', treatment_type: 'MULTISPECTRAL' },
  { service_type: 'MAPPING', treatment_type: 'ORTHOPHOTO' },
];

// Parametri comuni per tutti i test
const BASE_PARAMS = {
  area_ha: 5.0,
  location_lat: 45.0,
  location_lng: 10.0,
  terrain_conditions: 'FLAT',
  crop_type: 'VINEYARD'
};

function makeRequest(params) {
  return new Promise((resolve, reject) => {
    const queryParams = new URLSearchParams();
    
    // Aggiungi tutti i parametri
    Object.entries({ ...BASE_PARAMS, ...params }).forEach(([key, value]) => {
      queryParams.append(key, String(value));
    });
    
    const url = `${API_BASE}/certified-quotes?${queryParams.toString()}`;
    
    console.log(`🌐 Test: ${params.service_type} + ${params.treatment_type}`);
    console.log(`   URL: ${url}`);
    
    const options = {
      method: 'GET',
      headers: AUTH_HEADERS
    };
    
    const req = https.request(url, options, (res) => {
      let data = '';
    
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: response,
            params
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            data: data,
            params,
            error: 'JSON parse error'
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject({
        params,
        error: error.message
      });
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      reject({
        params,
        error: 'Timeout after 10 seconds'
      });
    });
    
    req.end();
  });
}

async function runAllTests() {
  console.log('🚀 Avvio test combinazioni preventivi certificati\n');
  console.log('📊 Parametri base:');
  console.log(`   Area: ${BASE_PARAMS.area_ha} ha`);
  console.log(`   Location: ${BASE_PARAMS.loca_lat}, ${BASE_PARAMS.location_lng}`);
  console.log(`   Terrain: ${BASE_PARAMS.terrain_conditions}`);
  console.log(`   Crop: ${BASE_PARAMS.crop_type}\n`);
  
  const results = {
    successful: [],
    failed: [],
    errors: []
  };
  
  for (const combination of COMBINATIONS) {
    try {
      const result = await makeRequest(combination);
      
      if (result.status === 200 && result.data.quotes && Array.isArray(result.data.quotes)) {
        const quoteCount = result.data.quotes.length;
        const firstQuote = result.data.quotes[0];
        
        console.log(`✅ SUCCESS: ${quoteCount} preventivo/i trovato/i`);
        if (firstQuote) {
          const totalEuros = (firstQuote.total_cents / 100).toFixed(2);
          console.log(`   💰 Prezzo: €${totalEuros} (${firstQuote.org_name})`);
        }
        
        results.successful.push({
          combination: combination,
          quotes: result.data.quotes
        });
      } else {
        console.log(`❌ FAILED: Status ${result.status}`);
        if (result.data.error) {
          console.log(`   Errore: ${result.data.error}`);
        }
        
        results.failed.push({
          combination: combination,
          status: result.status,
          response: result.data
        });
      }
    } catch (error) {
      console.log(`💥 ERROR: ${error.error || 'Errore sconosciuto'}`);
      
      results.errors.push({
        combination: combination,
        error: error
      });
    }
    
    console.log(''); // Riga vuota tra test
    
    // Pausa tra richieste per non sovraccaricare
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Riepilogo finale
  console.log('📈 RIEPILOGO FINALE');
  console.log('==================');
  console.log(`✅ Successi: ${results.successful.length}`);
  console.log(`❌ Fallimenti: ${results.failed.length}`);
  console.log(`💥 Errori: ${results.errors.length}`);
  
  if (results.successful.length > 0) {
    console.log('\n🎯 Combinazioni funzionanti:');
    results.successfuem => {
      const combo = item.combination;
      const quotes = item.quotes;
      console.log(`   ${combo.service_type} + ${combo.treatment_type}: ${quotes.length} preventivo/i`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log('\n⚠️  Combinazioni fallite:');
    results.failed.forEach(item => {
      const combo = item.combination;
      console.log(`   ${combo.service_type} + ${combo.treatment_type}: Status ${item.status}`);
    });
  }
  
  if (results.errors.length > 0) {
    console.log('\n💥 Combinazioni con errori:');
    results.errors.forEach(item => {
      const combo = item.combination;
      console.log(`   ${combo.service_type} + ${combo.treatment_type}: ${item.error.error}`);
    });
  }
}

runAllTests().catch(console.error);
