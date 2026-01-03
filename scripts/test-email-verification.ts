#!/usr/bin/env tsx

/**
 * Script di test per la verifica email
 *
 * Testa il flusso completo:
 * 1. Registrazione utente
 * 2. Verifica codice ricevuto (simula)
 * 3. Verifica email con codice
 * 4. Reinvio codice
 */

import "dotenv/config";

const API_BASE = process.env.API_BASE || "http://localhost:3001/api";

async function testEmailVerification() {
  console.log("🧪 Test Verifica Email\n");
  console.log("API Base:", API_BASE);
  console.log(
    "RESEND_API_KEY:",
    process.env.RESEND_API_KEY ? "✅ Configurato" : "❌ Non configurato\n",
  );

  // Test 1: Registrazione
  console.log("\n📝 Test 1: Registrazione");
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = "password123";

  try {
    const registerResponse = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        firstName: "Test",
        lastName: "User",
        organizationName: "Test Organization",
      }),
    });

    if (!registerResponse.ok) {
      const error = await registerResponse.json();
      throw new Error(`Registrazione fallita: ${error.error}`);
    }

    const registerData = await registerResponse.json();
    console.log("✅ Registrazione completata");
    console.log("   - User ID:", registerData.user?.id);
    console.log("   - Email:", registerData.user?.email);
    console.log("   - Email Verified:", registerData.user?.email_verified);
    console.log(
      "   - Token:",
      registerData.token ? "✅ Ricevuto" : "❌ Mancante",
    );

    if (!registerData.token) {
      throw new Error("Token non ricevuto");
    }

    const token = registerData.token;

    // Test 2: Reinvio codice
    console.log("\n📧 Test 2: Reinvio Codice Verifica");
    const resendResponse = await fetch(`${API_BASE}/auth/resend-verification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.json();
      console.log("⚠️  Reinvio fallito:", error.error);
    } else {
      const resendData = await resendResponse.json();
      console.log("✅ Reinvio completato:", resendData.message);
    }

    // Test 3: Verifica con codice (richiede codice manuale)
    console.log("\n🔐 Test 3: Verifica Email");
    console.log(
      "   ⚠️  Per completare questo test, inserisci il codice ricevuto via email",
    );
    console.log(
      "   📧 Controlla la console del server per vedere il codice generato",
    );
    console.log("   💡 In produzione, il codice verrà inviato via email");

    // Simuliamo un codice valido (in realtà dovrebbe venire dall'email)
    const testCode = "123456";
    console.log(`\n   Tentativo con codice di test: ${testCode}`);

    const verifyResponse = await fetch(`${API_BASE}/auth/verify-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code: testCode }),
    });

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      console.log(
        "   ⚠️  Verifica fallita (previsto per codice di test):",
        error.error,
      );
    } else {
      const verifyData = await verifyResponse.json();
      console.log("✅ Verifica completata:", verifyData.message);
    }

    console.log("\n✅ Test completati!");
    console.log("\n📋 Riepilogo:");
    console.log(`   - Email test: ${testEmail}`);
    console.log(`   - Password: ${testPassword}`);
    console.log("   - Token salvato (puoi usarlo per test manuali)");
  } catch (error: any) {
    console.error("\n❌ Errore durante i test:", error.message);
    if (error.stack) {
      console.error("\nStack trace:", error.stack);
    }
    process.exit(1);
  }
}

// Esegui i test
testEmailVerification().catch(console.error);
