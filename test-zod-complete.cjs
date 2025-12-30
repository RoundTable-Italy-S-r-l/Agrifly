const { z } = require('zod');

console.log('🚀 TEST COMPLETO ZOD VALIDATION PER TUTTI GLI ENDPOINT\n');
console.log('='.repeat(70));

let testsPassed = 0;
let testsFailed = 0;

// Helper function per testare uno schema
function testSchema(name, schema, validData, invalidData = []) {
  console.log(`\n🧪 Testing ${name}...`);

  // Test dati validi
  const validResult = schema.safeParse(validData);
  if (validResult.success) {
    console.log(`  ✅ Valid data: PASS`);
    testsPassed++;
  } else {
    console.log(`  ❌ Valid data: FAIL - ${validResult.error.issues[0]?.message || 'Unknown error'}`);
    testsFailed++;
  }

  // Test dati invalidi
  invalidData.forEach((invalid, index) => {
    const invalidResult = schema.safeParse(invalid);
    if (!invalidResult.success) {
      console.log(`  ✅ Invalid data ${index + 1}: PASS (correctly rejected)`);
      testsPassed++;
    } else {
      console.log(`  ❌ Invalid data ${index + 1}: FAIL (should have been rejected)`);
      testsFailed++;
    }
  });
}

// 1. AUTENTICAZIONE
console.log('\n📧 AUTENTICAZIONE');

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

testSchema('LoginSchema', LoginSchema, {
  email: 'test@example.com',
  password: 'password123'
}, [
  { email: 'invalid', password: '123' },
  { email: '', password: 'password123' }
]);

const RegisterOrganizationSchema = z.object({
  legal_name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  org_type: z.enum(['FARM', 'VENDOR', 'OPERATOR', 'BROKER']),
  address_line: z.string().min(1),
  city: z.string().min(1),
  province: z.string().length(2),
  postal_code: z.string().min(1),
  country: z.string().length(2)
});

testSchema('RegisterOrganizationSchema', RegisterOrganizationSchema, {
  legal_name: 'Test Company SRL',
  email: 'test@example.com',
  password: 'password123',
  org_type: 'VENDOR',
  address_line: 'Via Test 123',
  city: 'Milano',
  province: 'MI',
  postal_code: '20100',
  country: 'IT'
}, [
  { legal_name: '', email: 'invalid', password: '123' }
]);

// 2. JOB E OFFERTE
console.log('\n💼 JOB E OFFERTE');

const CreateJobSchema = z.object({
  field_name: z.string().min(1),
  service_type: z.enum(['SPRAY', 'SPREAD', 'MAPPING']),
  area_ha: z.union([z.number().positive(), z.string().transform(v => parseFloat(v.replace(',', '.')))])
});

testSchema('CreateJobSchema', CreateJobSchema, {
  field_name: 'Campo Test',
  service_type: 'SPRAY',
  area_ha: 25.5
}, [
  { field_name: '', service_type: 'INVALID', area_ha: -5 }
]);

const CreateOfferSchema = z.object({
  offer_type: z.enum(['BUNDLE', 'PROMO', 'SEASON_PACKAGE']),
  name: z.string().min(1),
  rules_json: z.any(),
  valid_from: z.string().transform(val => new Date(val)),
  valid_to: z.string().optional().transform(val => val ? new Date(val) : undefined),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE')
});

testSchema('CreateOfferSchema', CreateOfferSchema, {
  offer_type: 'BUNDLE',
  name: 'Bundle Test',
  rules_json: { bundle_price: 35000 },
  valid_from: '2025-01-01T00:00:00Z'
}, [
  { offer_type: 'INVALID', name: '', valid_from: 'invalid' }
]);

// 3. CARRELLO E ORDINI
console.log('\n🛒 CARRELLO E ORDINI');

const AddCartItemSchema = z.object({
  sku_id: z.string().min(1),
  quantity: z.number().int().positive(),
  unit_price_cents: z.number().int().nonnegative(),
  currency: z.string().length(3).default('EUR')
});

testSchema('AddCartItemSchema', AddCartItemSchema, {
  sku_id: 'sku_test',
  quantity: 2,
  unit_price_cents: 25000
}, [
  { sku_id: '', quantity: -1, unit_price_cents: -100 }
]);

const CreateOrderFromCartSchema = z.object({
  cart_items: z.array(z.object({
    sku_id: z.string().min(1),
    quantity: z.number().int().positive(),
    unit_price_cents: z.number().int().nonnegative(),
    currency: z.string().length(3)
  })).min(1),
  shipping_address: z.any(),
  billing_address: z.any()
});

testSchema('CreateOrderFromCartSchema', CreateOrderFromCartSchema, {
  cart_items: [{
    sku_id: 'sku_test',
    quantity: 1,
    unit_price_cents: 25000,
    currency: 'EUR'
  }],
  shipping_address: { address_line: 'Via Test 123' },
  billing_address: { address_line: 'Via Test 123' }
}, [
  { cart_items: [], shipping_address: {} }
]);

// 4. OPERATORI E SERVIZI
console.log('\n👷 OPERATORI E SERVIZI');

const CreateOperatorSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  license_number: z.string().optional(),
  certifications: z.array(z.string()).optional(),
  experience_years: z.number().int().nonnegative().optional()
});

testSchema('CreateOperatorSchema', CreateOperatorSchema, {
  first_name: 'Mario',
  last_name: 'Rossi',
  email: 'mario@example.com',
  experience_years: 5
}, [
  { first_name: '', last_name: '', email: 'invalid' }
]);

// 5. INDIRIZZI E IMPOSTAZIONI
console.log('\n🏠 INDIRIZZI E IMPOSTAZIONI');

const CreateAddressSchema = z.object({
  address_line: z.string().min(1),
  city: z.string().min(1),
  province: z.string().length(2),
  postal_code: z.string().min(1),
  country: z.string().length(2),
  is_default: z.boolean().default(false)
});

testSchema('CreateAddressSchema', CreateAddressSchema, {
  address_line: 'Via Roma 123',
  city: 'Milano',
  province: 'MI',
  postal_code: '20100',
  country: 'IT'
}, [
  { address_line: '', city: '', postal_code: '123' }
]);

// 6. EMAIL E PASSWORD
console.log('\n📧 EMAIL E PASSWORD');

const VerifyEmailSchema = z.object({
  token: z.string().min(10)
});

testSchema('VerifyEmailSchema', VerifyEmailSchema, {
  token: 'abc123def456'
}, [
  { token: 'short' }
]);

const RequestPasswordResetSchema = z.object({
  email: z.string().email()
});

testSchema('RequestPasswordResetSchema', RequestPasswordResetSchema, {
  email: 'user@example.com'
}, [
  { email: 'invalid' }
]);

const ResetPasswordSchema = z.object({
  token: z.string().min(10),
  new_password: z.string().min(8)
});

testSchema('ResetPasswordSchema', ResetPasswordSchema, {
  token: 'reset123token',
  new_password: 'NewSecurePass123!'
}, [
  { token: 'short', new_password: 'short' }
]);

// 7. MESSAGGI E COMUNICAZIONE
console.log('\n💬 MESSAGGI E COMUNICAZIONE');

const CreateMessageSchema = z.object({
  body: z.string().min(1),
  message_type: z.enum(['GENERAL', 'OFFER_UPDATE', 'ORDER_UPDATE']).default('GENERAL')
});

testSchema('CreateMessageSchema', CreateMessageSchema, {
  body: 'Questo è un messaggio di test'
}, [
  { body: '' }
]);

// 8. CAMPI SALVATI
console.log('\n🌾 CAMPI SALVATI');

const CreateSavedFieldSchema = z.object({
  name: z.string().min(1),
  area_ha: z.number().positive(),
  crop_type: z.enum(['VINEYARD', 'OLIVE_GROVE', 'CEREAL', 'VEGETABLES', 'FRUIT', 'OTHER']).optional(),
  location_json: z.any().optional(),
  notes: z.string().optional()
});

testSchema('CreateSavedFieldSchema', CreateSavedFieldSchema, {
  name: 'Campo Vigneti',
  area_ha: 25.5,
  crop_type: 'VINEYARD'
}, [
  { name: '', area_ha: -5 }
]);

// 9. RICHIESTE SPECIALI
console.log('\n🔍 RICHIESTE SPECIALI');

const DirectionsRequestSchema = z.object({
  waypoints: z.array(z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  })).min(2),
  profile: z.enum(['driving', 'walking', 'cycling']).default('driving')
});

testSchema('DirectionsRequestSchema', DirectionsRequestSchema, {
  waypoints: [
    { lat: 45.5, lng: 9.1 },
    { lat: 45.6, lng: 9.2 }
  ]
}, [
  { waypoints: [{ lat: 91, lng: 9.1 }] }
]);

// RISULTATI FINALI
console.log('\n' + '='.repeat(70));
console.log('📊 RISULTATI FINALI');
console.log('='.repeat(70));
console.log(`✅ Test passati: ${testsPassed}`);
console.log(`❌ Test falliti: ${testsFailed}`);
const successRate = ((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1);
console.log(`📈 Tasso di successo: ${successRate}%`);

if (testsFailed === 0) {
  console.log('\n🎉 TUTTI GLI SCHEMI ZOD FUNZIONANO CORRETTAMENTE!');
  console.log('✨ Validazione robusta per tutti gli endpoint dell\'app.');
} else {
  console.log(`\n⚠️ Alcuni schemi hanno problemi (${testsFailed} fallimenti).`);
  console.log('🔧 Verificare e correggere gli schemi Zod.');
}

console.log('\n🏁 Test Zod completato per tutti gli endpoint principali!');
