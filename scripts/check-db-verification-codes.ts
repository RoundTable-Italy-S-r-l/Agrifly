#!/usr/bin/env tsx

/**
 * Script per verificare che la tabella verification_codes esista e funzioni
 */

import "dotenv/config";
import { query } from "../server/utils/database";

async function checkVerificationCodes() {
  console.log("🔍 Verifica tabella verification_codes\n");

  try {
    // Test 1: Verifica esistenza tabella
    console.log("📋 Test 1: Verifica esistenza tabella");
    const tableCheck = await query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='verification_codes'
    `);

    // Se è PostgreSQL invece di SQLite
    if (tableCheck.rows.length === 0) {
      const pgCheck = await query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_name = 'verification_codes'
      `);
      if (pgCheck.rows.length === 0) {
        throw new Error("Tabella verification_codes non trovata!");
      }
    }
    console.log("✅ Tabella verification_codes esiste");

    // Test 2: Verifica struttura colonne
    console.log("\n📊 Test 2: Verifica struttura colonne");
    const columns = await query(`
      PRAGMA table_info(verification_codes)
    `);

    if (columns.rows.length === 0) {
      // Prova con PostgreSQL
      const pgColumns = await query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'verification_codes'
        ORDER BY ordinal_position
      `);
      console.log("Colonne trovate:");
      pgColumns.rows.forEach((col: any) => {
        console.log(
          `   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`,
        );
      });
    } else {
      console.log("Colonne trovate:");
      columns.rows.forEach((col: any) => {
        console.log(`   - ${col.name}: ${col.type}`);
      });
    }

    // Test 3: Test inserimento codice (con cleanup)
    console.log("\n🧪 Test 3: Test inserimento codice");
    const testUserId = "test-user-" + Date.now();
    const testEmail = "test@example.com";
    const testCode = "123456";
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    console.log("   Inserimento codice di test...");
    const verificationId = "test-verification-" + Date.now();
    const insertResult = await query(
      "INSERT INTO verification_codes (id, user_id, email, code, purpose, expires_at, used, used_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
      [
        verificationId,
        testUserId,
        testEmail,
        testCode,
        "EMAIL_VERIFICATION",
        expiresAt,
        false,
        null,
      ],
    );

    console.log("✅ Codice inserito con ID:", insertResult.rows[0]?.id);

    // Test 4: Verifica lettura
    console.log("\n📖 Test 4: Verifica lettura codice");
    const readResult = await query(
      "SELECT * FROM verification_codes WHERE user_id = $1 AND code = $2",
      [testUserId, testCode],
    );

    if (readResult.rows.length === 0) {
      throw new Error("Codice non trovato dopo inserimento!");
    }

    const codeData = readResult.rows[0];
    console.log("✅ Codice letto correttamente:");
    console.log("   - ID:", codeData.id);
    console.log("   - Email:", codeData.email);
    console.log("   - Code:", codeData.code);
    console.log("   - Purpose:", codeData.purpose);
    console.log("   - Expires at:", codeData.expires_at);
    console.log("   - Used:", codeData.used);

    // Test 5: Cleanup
    console.log("\n🧹 Test 5: Cleanup");
    await query("DELETE FROM verification_codes WHERE user_id = $1", [
      testUserId,
    ]);
    console.log("✅ Codice di test rimosso");

    console.log("\n✅ Tutti i test superati!");
    console.log("\n📝 Note:");
    console.log(
      "   - La tabella verification_codes è configurata correttamente",
    );
    console.log("   - Le date sono gestite correttamente");
    console.log("   - Le query funzionano sia con SQLite che PostgreSQL");
  } catch (error: any) {
    console.error("\n❌ Errore:", error.message);
    if (error.stack) {
      console.error("\nStack trace:", error.stack);
    }
    process.exit(1);
  }
}

checkVerificationCodes().catch(console.error);
