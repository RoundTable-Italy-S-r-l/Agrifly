// Test semplice per trovare l'endpoint corretto di Grok
const https = require('https');

function testEndpoint(url, method = 'POST') {
  return new Promise((resolve) => {
    const req = https.request(url, { method }, (res) => {
      resolve({
        url,
        status: res.statusCode,
        headers: res.headers
      });
    });
    
    req.on('error', (err) => {
      resolve({
        url,
        error: err.message
      });
    });
    
    if (method === 'POST') {
      req.write('{}');
    }
    req.end();
  });
}

async function testGrokEndpoints() {
  const endpoints = [
    'https://api.x.ai/v1/chat/completions',
    'https://api.x.ai/v1/completions', 
    'https://api.grok.x.ai/v1/chat/completions',
    'https://grok.x.ai/api/v1/chat/completions'
  ];
  
  console.log('🔍 Test endpoint Grok API\n');
  
  for (const endpoint of endpoints) {
    console.log(`Test: ${endpoint}`);
    try {
    const result = await testEndpoint(endpoint);
      if (result.status) {
        console.log(`  ✅ Status: ${result.status}`);
      } else if (result.error) {
        console.log(`  ❌ Error: ${result.error}`);
      }
    } catch (error) {
      console.log(`  💥 Exception: ${error.message}`);
    }
    console.log('');
  }
}

testGrokEndpoints();
