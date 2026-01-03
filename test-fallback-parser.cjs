const { parseVoiceTextSimple } = require('./server/utils/voice-parser.js');

function testFallbackParser() {
  console.log('🧪 Test Parser Fallback\n');

  const testCases = [
    "Voglio trattare il mio vigneto con fungicida in collina",
    "Spandimento concime chimico sui cereali in pianura",
    "Mappatura termografica dell'oliveto montuoso",
    "Trattamento insetticida per ortaggi",
    "Campo Chianti Classico con fertilizzante"
  ];

  testCases.forEach((testText, index) => {
    console.log(`\n📝 Test ${index + 1}: "${testText}"`);
    
    const result = parseVoiceTextSimple(testText);
    
    console.log(`   Service: ${result.service_type || 'null'}`);
    console.log(`   Crop: ${result.crop_type || 'null'}`);
    console.log(`   Treatment: ${result.treatment_type || 'null'}`);
    console.log(`   Terrain: ${result.terrain_conditions || 'null'}`);
    console.log(`   Field: ${result.field_na| 'null'}`);
    console.log(`   Confidence: ${(result.confidence * 100).toFixed(0)}%`);
  });

  console.log('\n✅ Test fallback parser completato');
}

testFallbackParser();
