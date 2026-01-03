#!/usr/bin/env tsx

/**
 * Script di test per verificare che Resend funzioni correttamente
 */

import "dotenv/config";
import { sendVerificationCodeEmail } from "../server/utils/email";

async function testResendEmail() {
  console.log("🧪 Test invio email con Resend\n");

  // Verifica configurazione
  console.log("📋 Configurazione:");
  console.log(
    "  RESEND_API_KEY:",
    process.env.RESEND_API_KEY ? "✅ Presente" : "❌ Mancante",
  );
  console.log(
    "  RESEND_FROM_EMAIL:",
    process.env.RESEND_FROM_EMAIL || "Usa default",
  );
  console.log("");

  if (!process.env.RESEND_API_KEY) {
    console.error("❌ RESEND_API_KEY non configurato nel file .env");
    process.exit(1);
  }

  // Test invio email (usa un email di test)
  const testEmail = process.argv[2] || "test@example.com";
  const testCode = "123456";

  console.log(`📧 Invio email di test a: ${testEmail}`);
  console.log(`📝 Codice di test: ${testCode}`);
  console.log("");

  try {
    await sendVerificationCodeEmail(testEmail, testCode, 10);
    console.log("✅ Email inviata con successo!");
    console.log(`📬 Controlla la casella email ${testEmail} per il codice`);
  } catch (error: any) {
    console.error("❌ Errore invio email:", error.message);
    if (error.stack) {
      console.error("\nStack trace:", error.stack);
    }
    process.exit(1);
  }
}

testResendEmail().catch(console.error);
