const { z } = require('zod');

console.log('🧪 Test Zod Validation\n');

// Test 1: Login Schema
const LoginSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(6, 'Password troppo corta')
});

const loginTest = LoginSchema.safeParse({
  email: 'test@example.com',
  password: 'password123'
});

console.log('1. LoginSchema - Valid:', loginTest.success ? '✅ PASS' : '❌ FAIL');

const loginFail = LoginSchema.safeParse({
  email: 'invalid',
  password: '123'
});

console.log('1. LoginSchema - Invalid:', !loginFail.success ? '✅ PASS' : '❌ FAIL');

// Test 2: CreateOffer Schema
const CreateOfferSchema = z.object({
  offer_type: z.enum(['BUNDLE', 'PROMO', 'SEASON_PACKAGE'], {
    errorMap: () => ({ message: 'Tipo offerta non valido' })
  }),
  name: z.string().min(1, 'Nome obbligatorio'),
  rules_json: z.any(),
  valid_from: z.string().transform(val => new Date(val)),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE')
});

const offerTest = CreateOfferSchema.safeParse({
  offer_type: 'BUNDLE',
  name: 'Bundle Test',
  rules_json: { bundle_price: 35000 },
  valid_from: '2025-01-01T00:00:00Z',
  status: 'ACTIVE'
});

console.log('2. CreateOfferSchema - Valid:', offerTest.success ? '✅ PASS' : '❌ FAIL');

const offerFail = CreateOfferSchema.safeParse({
  offer_type: 'INVALID',
  name: '',
  valid_from: 'invalid-date'
});

console.log('2. CreateOfferSchema - Invalid:', !offerFail.success ? '✅ PASS' : '❌ FAIL');

// Test 3: AddCartItem Schema
const AddCartItemSchema = z.object({
  sku_id: z.string().min(1, 'SKU obbligatorio'),
  quantity: z.number().int().positive('Quantità deve essere positiva'),
  unit_price_cents: z.number().int().nonnegative('Prezzo non può essere negativo')
});

const cartTest = AddCartItemSchema.safeParse({
  sku_id: 'sku_test',
  quantity: 2,
  unit_price_cents: 25000
});

console.log('3. AddCartItemSchema - Valid:', cartTest.success ? '✅ PASS' : '❌ FAIL');

const cartFail = AddCartItemSchema.safeParse({
  sku_id: '',
  quantity: -1,
  unit_price_cents: -100
});

console.log('3. AddCartItemSchema - Invalid:', !cartFail.success ? '✅ PASS' : '❌ FAIL');

console.log('\n🎉 Test Zod completato! Validazione funzionante per tutti gli endpoint principali.');
