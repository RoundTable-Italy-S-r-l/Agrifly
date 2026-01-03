require('dotenv').config();

async function testSimpleGrok() {
  console.log('🧪 Test semplice Grok\n');

  const GROK_API_KEY = process.env.GROK_API_KEY;
  if (!GROK_API_KEY) {
    console.log('❌ No API key');
    return;
  }

  // Test con prompt molto semplice
  const simplePrompt = 'Dimmi solo "ciao" in italiano.';

  try {
    console.log('📡 Test con prompt semplice...');
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [{
          role: 'user',
          content: simplePrompt
        }],
        temperature: 0.1,
        max_tokens: 50
      })
    });

    console.log('📊 Status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Risposta:', data.choices[0].message.content);
    } else {
      const error = await response.text();
      console.log('❌ Errore:', error);
    }

  } catch (error) {
    console.log('💥 Errore:', error.message);
  }
}

testSimpleGrok().catch(console.error);
