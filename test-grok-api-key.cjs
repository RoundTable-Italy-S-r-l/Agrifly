require('dotenv').config();

async function testGrokAPIKey() {
  console.log('🔑 Test API Key Grok\n');

  const GROK_API_KEY = process.env.GROK_API_KEY;
  
  if (!GROK_API_KEY) {
    console.log('❌ GROK_API_KEY non trovata nell\'ambiente');
    console.log('📝 Assicurati di avere GROK_API_KEY nel file .env');
    return;
  }

  console.log('✅ GROK_API_KEY presente');
  console.log('🔢 Lunghezza chiave:', GROK_API_KEY.length);
  console.log('📋 Prefisso:', GROK_API_KEY.substring(0, 10) + '...');

  try {
    console.log('\n📡 Test chiamata API Grok...');

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-2',
        messages: [{
          role: 'user',
          content: 'Ciolo con "OK" se ricevi questo messaggio.'
        }],
        temperature: 0.1,
        max_tokens: 50
      })
    });

    console.log('📊 Status risposta:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ API funziona correttamente!');
      console.log('🤖 Risposta:', data.choices[0].message.content);
    } else {
      const errorText = await response.text();
      console.log('❌ Errore API:', response.status, response.statusText);
      console.log('📝 Dettagli:', errorText);
    }

  } catch (error) {
    console.log('💥 Errore di connessione:', error.message);
  }
}

testGrokAPIKey().catch(console.error);
