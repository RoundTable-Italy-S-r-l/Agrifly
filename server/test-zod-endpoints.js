#!/usr/bin/env node

/**
 * Test completo di validazione Zod per tutti gli endpoint dell'applicazione
 * Esegue test automatici su ogni schema Zod con dati validi e invalidi
 */

const { z } = require("zod");

// Importa tutti gli schemi Zod
const schemas = require("./schemas/api.schemas.ts");

// Test results
let testsPassed = 0;
let testsFailed = 0;
const failedTests = [];

// Helper function per testare uno schema
function testSchema(schemaName, schema, validData, invalidData = []) {
  console.log(`\n🧪 Testing ${schemaName}...`);

  // Test dati validi
  try {
    const result = schema.safeParse(validData);
    if (result.success) {
      console.log(`  ✅ Valid data: PASSED`);
      testsPassed++;
    } else {
      console.log(`  ❌ Valid data: FAILED - ${result.error.message}`);
      testsFailed++;
      failedTests.push(`${schemaName} - Valid data`);
    }
  } catch (error) {
    console.log(`  ❌ Valid data: ERROR - ${error.message}`);
    testsFailed++;
    failedTests.push(`${schemaName} - Valid data error`);
  }

  // Test dati invalidi
  invalidData.forEach((invalid, index) => {
    try {
      const result = schema.safeParse(invalid);
      if (!result.success) {
        console.log(
          `  ✅ Invalid data ${index + 1}: PASSED (correctly rejected)`,
        );
        testsPassed++;
      } else {
        console.log(
          `  ❌ Invalid data ${index + 1}: FAILED (should have been rejected)`,
        );
        testsFailed++;
        failedTests.push(`${schemaName} - Invalid data ${index + 1}`);
      }
    } catch (error) {
      console.log(`  ❌ Invalid data ${index + 1}: ERROR - ${error.message}`);
      testsFailed++;
      failedTests.push(`${schemaName} - Invalid data ${index + 1} error`);
    }
  });
}

// Test di tutti gli schemi
console.log("🚀 INIZIO TEST VALIDAZIONE ZOD PER TUTTI GLI ENDPOINT\n");
console.log("=".repeat(60));

// 1. Schemi di autenticazione
testSchema(
  "LoginSchema",
  schemas.LoginSchema,
  {
    email: "test@example.com",
    password: "password123",
  },
  [
    { email: "", password: "pass" }, // Email vuota, password troppo corta
    { email: "invalid-email", password: "password123" }, // Email invalida
    { email: "test@example.com" }, // Password mancante
  ],
);

testSchema(
  "RegisterOrganizationSchema",
  schemas.RegisterOrganizationSchema,
  {
    legal_name: "Test Company SRL",
    email: "test@example.com",
    password: "password123",
    phone: "+39 123 456 7890",
    org_type: "VENDOR",
    address_line: "Via Test 123",
    city: "Milano",
    province: "MI",
    postal_code: "20100",
    country: "IT",
  },
  [
    { legal_name: "", email: "test@example.com", password: "pass" }, // Nome vuoto, password corta
    { legal_name: "Test", email: "invalid", password: "password123" }, // Email invalida
  ],
);

// 2. Schemi di job
testSchema(
  "CreateJobSchema",
  schemas.CreateJobSchema,
  {
    field_name: "Campo di Test",
    service_type: "SPRAY",
    area_ha: 25.5,
    location_json: { type: "Point", coordinates: [9.1, 45.5] },
    notes: "Campo di prova",
  },
  [
    { field_name: "", service_type: "INVALID", area_ha: -5 }, // Campo vuoto, servizio invalido, area negativa
    { service_type: "SPRAY", area_ha: 1000 }, // Campo mancante, area troppo grande
  ],
);

testSchema(
  "CreateJobOfferSchema",
  schemas.CreateJobOfferSchema,
  {
    total_cents: 150000,
    currency: "EUR",
    proposed_start: "2025-01-15T08:00:00Z",
    proposed_end: "2025-01-15T12:00:00Z",
    provider_note: "Offerta di test",
  },
  [
    { total_cents: -1000 }, // Prezzo negativo
    { total_cents: 0 }, // Prezzo zero
  ],
);

// 3. Schemi di offerte
testSchema(
  "CreateOfferSchema",
  schemas.CreateOfferSchema,
  {
    offer_type: "BUNDLE",
    name: "Bundle Promozionale",
    rules_json: { bundle_price: 45000, products: [] },
    valid_from: "2025-01-01T00:00:00Z",
    valid_to: "2025-12-31T23:59:59Z",
    status: "ACTIVE",
  },
  [
    { offer_type: "INVALID", name: "", rules_json: null }, // Tipo invalido, nome vuoto, rules null
    { offer_type: "BUNDLE", name: "Test", valid_from: "invalid-date" }, // Data invalida
  ],
);

testSchema(
  "UpdateOfferSchema",
  schemas.UpdateOfferSchema,
  {
    name: "Bundle Aggiornato",
    rules_json: { bundle_price: 40000 },
    valid_to: "2025-11-30T23:59:59Z",
    status: "INACTIVE",
  },
  [
    { name: "", status: "INVALID" }, // Nome vuoto, status invalido
  ],
);

// 4. Schemi di ordini e carrello
testSchema(
  "CreateOrderFromCartSchema",
  schemas.CreateOrderFromCartSchema,
  {
    cart_items: [
      {
        sku_id: "sku_test",
        quantity: 2,
        unit_price_cents: 25000,
        currency: "EUR",
      },
    ],
    shipping_address: {
      address_line: "Via Test 123",
      city: "Milano",
      province: "MI",
      postal_code: "20100",
      country: "IT",
    },
    billing_address: {
      address_line: "Via Test 123",
      city: "Milano",
      province: "MI",
      postal_code: "20100",
      country: "IT",
    },
  },
  [
    { cart_items: [] }, // Carrello vuoto
    { cart_items: [{ sku_id: "", quantity: 0 }] }, // Item invalido
  ],
);

testSchema(
  "AddCartItemSchema",
  schemas.AddCartItemSchema,
  {
    sku_id: "sku_t50",
    quantity: 1,
    unit_price_cents: 285000,
    currency: "EUR",
  },
  [
    { sku_id: "", quantity: -1 }, // SKU vuoto, quantità negativa
    { sku_id: "sku_test", quantity: 1000 }, // Quantità troppo alta
  ],
);

// 5. Schemi di operatori
testSchema(
  "CreateOperatorSchema",
  schemas.CreateOperatorSchema,
  {
    first_name: "Mario",
    last_name: "Rossi",
    email: "mario.rossi@example.com",
    phone: "+39 333 123 4567",
    license_number: "LIC123456",
    certifications: ["Spray License", "Drone Pilot"],
    experience_years: 5,
  },
  [
    { first_name: "", last_name: "", email: "invalid" }, // Campi vuoti, email invalida
    {
      first_name: "Mario",
      last_name: "Rossi",
      email: "mario@example.com",
      experience_years: -1,
    }, // Esperienza negativa
  ],
);

// 6. Schemi di servizi
testSchema(
  "CreateServiceSchema",
  schemas.CreateServiceSchema,
  {
    service_type: "SPRAY",
    base_price_per_ha_cents: 15000,
    currency: "EUR",
    description: "Servizio di irrorazione standard",
    min_area_ha: 1,
    max_area_ha: 100,
  },
  [
    { service_type: "INVALID", base_price_per_ha_cents: -1000 }, // Tipo invalido, prezzo negativo
    { service_type: "SPRAY", min_area_ha: 100, max_area_ha: 50 }, // Area minima > massima
  ],
);

// 7. Schemi di indirizzi
testSchema(
  "CreateAddressSchema",
  schemas.CreateAddressSchema,
  {
    address_line: "Via Roma 123",
    city: "Milano",
    province: "MI",
    postal_code: "20100",
    country: "IT",
    is_default: false,
  },
  [
    { address_line: "", city: "", postal_code: "invalid" }, // Campi vuoti, CAP invalido
    { address_line: "Via Roma 123", city: "Milano", postal_code: "123" }, // CAP troppo corto
  ],
);

// 8. Schemi di inviti
testSchema(
  "CreateInvitationSchema",
  schemas.CreateInvitationSchema,
  {
    email: "invite@example.com",
    role: "OPERATOR",
    message: "Benvenuto nel team!",
  },
  [
    { email: "invalid-email", role: "INVALID" }, // Email invalida, ruolo invalido
    { email: "", role: "OPERATOR" }, // Email vuota
  ],
);

// 9. Schemi di campi salvati
testSchema(
  "CreateSavedFieldSchema",
  schemas.CreateSavedFieldSchema,
  {
    name: "Campo Vigneti",
    area_ha: 25.5,
    crop_type: "VINEYARD",
    location_json: { type: "Point", coordinates: [9.1, 45.5] },
    notes: "Campo di vigneti in collina",
  },
  [
    { name: "", area_ha: -5, crop_type: "INVALID" }, // Nome vuoto, area negativa, tipo invalido
    { name: "Campo", area_ha: 10000 }, // Area troppo grande
  ],
);

// 10. Schemi di messaggi
testSchema(
  "CreateMessageSchema",
  schemas.CreateMessageSchema,
  {
    body: "Questo è un messaggio di test per l'offerta.",
    message_type: "OFFER_UPDATE",
  },
  [
    { body: "", message_type: "INVALID" }, // Corpo vuoto, tipo invalido
    { body: "Test", message_type: "OFFER_UPDATE" }, // Dovrebbe essere valido
  ],
);

// 11. Schemi di email
testSchema(
  "VerifyEmailSchema",
  schemas.VerifyEmailSchema,
  {
    token: "abc123def456",
  },
  [
    { token: "" }, // Token vuoto
    { token: "short" }, // Token troppo corto
  ],
);

testSchema(
  "RequestPasswordResetSchema",
  schemas.RequestPasswordResetSchema,
  {
    email: "user@example.com",
  },
  [
    { email: "" }, // Email vuota
    { email: "invalid-email" }, // Email invalida
  ],
);

testSchema(
  "ResetPasswordSchema",
  schemas.ResetPasswordSchema,
  {
    token: "reset123token",
    new_password: "NewSecurePass123!",
  },
  [
    { token: "", new_password: "short" }, // Token vuoto, password corta
    { token: "token", new_password: "" }, // Password vuota
  ],
);

// 12. Schemi di parametri
testSchema(
  "AcceptOfferParamsSchema",
  schemas.AcceptOfferParamsSchema,
  {
    jobId: "job_123456",
    offerId: "offer_789012",
  },
  [
    { jobId: "", offerId: "" }, // ID vuoti
    { jobId: "job_123" }, // offerId mancante
  ],
);

testSchema(
  "CompleteMissionParamsSchema",
  schemas.CompleteMissionParamsSchema,
  {
    offerId: "offer_789012",
  },
  [
    { offerId: "" }, // ID vuoto
  ],
);

// 13. Schemi di richieste speciali
testSchema(
  "CertifiedQuotesRequestSchema",
  schemas.CertifiedQuotesRequestSchema,
  {
    service_type: "SPRAY",
    area_ha: 25.5,
    location_lat: 45.5,
    location_lng: 9.1,
  },
  [
    { service_type: "INVALID", area_ha: -5 }, // Servizio invalido, area negativa
    { service_type: "SPRAY", location_lat: 91, location_lng: 181 }, // Coordinate invalide
  ],
);

testSchema(
  "DirectionsRequestSchema",
  schemas.DirectionsRequestSchema,
  {
    waypoints: [
      { lat: 45.5, lng: 9.1 },
      { lat: 45.6, lng: 9.2 },
    ],
    profile: "driving",
  },
  [
    { waypoints: [] }, // Waypoints vuoti
    { waypoints: [{ lat: 91, lng: 9.1 }], profile: "invalid" }, // Coordinate invalide, profilo invalido
  ],
);

// Risultati finali
console.log("\n" + "=".repeat(60));
console.log("📊 RISULTATI FINALI");
console.log("=".repeat(60));
console.log(`✅ Test passati: ${testsPassed}`);
console.log(`❌ Test falliti: ${testsFailed}`);
console.log(
  `📈 Success rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`,
);

if (failedTests.length > 0) {
  console.log("\n❌ Test falliti:");
  failedTests.forEach((test) => console.log(`  - ${test}`));
}

console.log("\n🎉 Test Zod completato!");
if (testsFailed === 0) {
  console.log("✨ Tutti gli schemi Zod funzionano correttamente!");
} else {
  console.log("⚠️ Alcuni schemi Zod hanno problemi da correggere.");
}
