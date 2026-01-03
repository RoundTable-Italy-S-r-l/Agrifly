require('dotenv').config();

async function testInnocuo() {
  console.log('🧪 Test con testo innocuo\n');

  const GROK_API_KEY = process.env.GROK_API_KEY;
  if (!GROK_API_KEY) {
    console.log('❌ No API key');
    return;
  }

  // Test con testo completamente innocuo
  const testText = "Ciao, vorrei organizzare una festa di compleanno per bambini";

  const prompt = `Analizza questo testo e dimmi se parla di agricoltura: "${testText}"

Rispondi solo con JSON: {"parla_di_agricoltura": false, "confidence": 0.9}`;

  try {
    console.log('📡 Test con prompt innocuo...');
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
          content: prompt
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

testInnocuo().catch(console.error);
