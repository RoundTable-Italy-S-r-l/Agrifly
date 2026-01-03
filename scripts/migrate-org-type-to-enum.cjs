#!/usr/bin/env node

/**
 * Script per migrare organizations.type da TEXT a enum OrgType
 *
 * Passi:
 * 1. Corregge valori NULL/"null"
 * 2. Normalizza valori legacy (FARM -> buyer, OPERATOR_PROVIDER -> operator)
 * 3. Migra colonna da TEXT a enum OrgType
 */

const { Client } = require("pg");
require("dotenv").config();

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(color, ...args) {
  console.log(colors[color] || colors.reset, ...args, colors.reset);
}

async function migrateOrgTypeToEnum() {
  const client = new Client({
    host: process.env.PGHOST,
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE || "postgres",
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });

  try {
    await client.connect();
    log("green", "✅ Connesso al database Supabase PostgreSQL\n");
    log("cyan", "=".repeat(60));
    log("cyan", "🔄 MIGRAZIONE organizations.type DA TEXT A ENUM");
    log("cyan", "=".repeat(60) + "\n");

    // Verifica enum OrgType
    log("cyan", "📋 [1/4] Verifica enum OrgType...\n");
    const enumQuery = `
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'OrgType')
      ORDER BY enumsortorder;
    `;
    const enumResult = await client.query(enumQuery);
    const enumValues = enumResult.rows.map((r) => r.enumlabel);

    log(
      "blue",
      `   Valori nell'enum: [${enumValues.map((v) => `"${v}"`).join(", ")}]`,
    );

    // Assicurati che i valori necessari esistano (lowercase)
    const requiredValues = ["buyer", "vendor", "operator"];
    const missingValues = requiredValues.filter((v) => !enumValues.includes(v));

    if (missingValues.length > 0) {
      log(
        "yellow",
        `   ⚠️  Valori mancanti (lowercase): [${missingValues.join(", ")}]`,
      );
      log("blue", "   ➕ Aggiungo valori mancanti...");
      for (const val of missingValues) {
        try {
          await client.query(
            `ALTER TYPE "OrgType" ADD VALUE IF NOT EXISTS '${val}';`,
          );
          log("green", `      ✅ Aggiunto "${val}"`);
        } catch (error) {
          if (error.message.includes("IF NOT EXISTS")) {
            try {
              await client.query(`ALTER TYPE "OrgType" ADD VALUE '${val}';`);
              log("green", `      ✅ Aggiunto "${val}"`);
            } catch (error2) {
              if (
                error2.message.includes("already exists") ||
                error2.message.includes("duplicate")
              ) {
                log("yellow", `      ℹ️  "${val}" già presente`);
              } else {
                throw error2;
              }
            }
          } else if (
            error.message.includes("already exists") ||
            error.message.includes("duplicate")
          ) {
            log("yellow", `      ℹ️  "${val}" già presente`);
          } else {
            throw error;
          }
        }
      }

      // Ricarica enum values dopo aggiunta
      const enumResult2 = await client.query(enumQuery);
      enumValues.length = 0;
      enumValues.push(...enumResult2.rows.map((r) => r.enumlabel));
    } else {
      log("green", "   ✅ Tutti i valori necessari presenti");
    }

    // Verifica valori esistenti
    log("cyan", "\n📋 [2/4] Verifica e correzione valori esistenti...\n");
    const valuesQuery = `
      SELECT id, type, legal_name
      FROM organizations
      ORDER BY id;
    `;
    const valuesResult = await client.query(valuesQuery);

    log("blue", `   Trovate ${valuesResult.rows.length} organizzazioni\n`);

    // Mappatura valori legacy
    const valueMapping = {
      null: "buyer", // Default per organizzazioni senza tipo
      NULL: "buyer",
      null: "buyer",
      FARM: "buyer",
      OPERATOR_PROVIDER: "operator",
      VENDOR: "vendor",
    };

    let correctedCount = 0;

    for (const org of valuesResult.rows) {
      const currentValue = org.type;
      const orgId = org.id;
      const orgName = org.legal_name || orgId;

      // Normalizza valore
      let targetValue = currentValue;

      if (!currentValue || currentValue === "null" || currentValue === "NULL") {
        // Se è null o "null", prova a dedurre dal nome
        if (orgId.toLowerCase().includes("buyer")) {
          targetValue = "buyer";
        } else if (orgId.toLowerCase().includes("vendor")) {
          targetValue = "vendor";
        } else if (orgId.toLowerCase().includes("operator")) {
          targetValue = "operator";
        } else {
          targetValue = "buyer"; // Default
        }
        log(
          "yellow",
          `   🔧 ${orgId}: "${currentValue || "NULL"}" → "${targetValue}" (dedotto)`,
        );
      } else if (valueMapping[currentValue]) {
        targetValue = valueMapping[currentValue];
        log(
          "yellow",
          `   🔧 ${orgId}: "${currentValue}" → "${targetValue}" (legacy)`,
        );
      } else {
        // Normalizza case
        const normalized = currentValue.toLowerCase();
        if (["buyer", "vendor", "operator"].includes(normalized)) {
          targetValue = normalized;
          if (currentValue !== normalized) {
            log(
              "yellow",
              `   🔧 ${orgId}: "${currentValue}" → "${targetValue}" (normalizzato)`,
            );
          } else {
            log("green", `   ✅ ${orgId}: "${currentValue}" (già corretto)`);
          }
        } else {
          log("red", `   ❌ ${orgId}: valore invalido "${currentValue}"`);
          continue;
        }
      }

      // Aggiorna se necessario
      if (currentValue !== targetValue) {
        try {
          await client.query(
            "UPDATE organizations SET type = $1 WHERE id = $2",
            [targetValue, orgId],
          );
          correctedCount++;
          log("green", `      ✅ Aggiornato`);
        } catch (error) {
          log("red", `      ❌ Errore: ${error.message}`);
        }
      }
    }

    log("blue", `\n   Totale correzioni: ${correctedCount}`);

    // Verifica che tutti i valori siano validi
    log("cyan", "\n📋 [3/4] Verifica valori finali...\n");
    const finalCheckQuery = `
      SELECT type, COUNT(*) as count
      FROM organizations
      GROUP BY type
      ORDER BY type;
    `;
    const finalCheckResult = await client.query(finalCheckQuery);

    let allValid = true;
    finalCheckResult.rows.forEach((row) => {
      const value = row.type;
      const normalized = value ? value.toLowerCase() : null;
      const isValid =
        normalized && ["buyer", "vendor", "operator"].includes(normalized);

      if (isValid) {
        log("green", `   ✅ "${value}": ${row.count} organizzazioni`);
      } else {
        log("red", `   ❌ "${value}": ${row.count} organizzazioni (INVALIDO)`);
        allValid = false;
      }
    });

    if (!allValid) {
      log(
        "red",
        "\n❌ Ci sono ancora valori invalidi. Correggili prima di continuare.",
      );
      return;
    }

    // Migra colonna da TEXT a enum
    log("cyan", "\n📋 [4/4] Migrazione colonna da TEXT a enum...\n");

    // Verifica tipo attuale
    const currentTypeQuery = `
      SELECT data_type, udt_name
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'organizations' 
      AND column_name = 'type';
    `;
    const currentTypeResult = await client.query(currentTypeQuery);

    if (currentTypeResult.rows.length === 0) {
      log("red", "   ❌ Colonna organizations.type non trovata");
      return;
    }

    const currentDataType = currentTypeResult.rows[0].data_type;
    const currentUdtName = currentTypeResult.rows[0].udt_name;

    log(
      "blue",
      `   Tipo attuale: ${currentDataType} (${currentUdtName || "N/A"})`,
    );

    if (currentDataType === "USER-DEFINED" && currentUdtName === "OrgType") {
      log("green", "   ✅ Colonna già è enum OrgType");
    } else {
      log("blue", "   ➕ Migro da TEXT a enum OrgType...");

      try {
        // PostgreSQL richiede di fare la migrazione in più passi:
        // 1. Crea colonna temporanea con enum
        // 2. Copia dati convertendo
        // 3. Elimina colonna vecchia
        // 4. Rinomina colonna nuova

        await client.query("BEGIN");

        // Crea colonna temporanea
        log("blue", "      Passo 1: Creo colonna temporanea...");
        await client.query(`
          ALTER TABLE organizations 
          ADD COLUMN type_new "OrgType";
        `);

        // Copia e converte dati
        log("blue", "      Passo 2: Copio e converto dati...");
        // Mappa i valori ai valori lowercase nell'enum
        // Verifica se "vendor" esiste nell'enum
        const hasVendorLowercase = enumValues.includes("vendor");
        const vendorTarget = hasVendorLowercase ? "vendor" : "VENDOR";

        log(
          "blue",
          `      Usando "${vendorTarget}" per vendor (${hasVendorLowercase ? "lowercase presente" : "solo uppercase"})`,
        );

        await client.query(
          `
          UPDATE organizations 
          SET type_new = CASE
            WHEN LOWER(type) = 'buyer' THEN 'buyer'::"OrgType"
            WHEN LOWER(type) = 'vendor' THEN $1::"OrgType"
            WHEN LOWER(type) = 'operator' THEN 'operator'::"OrgType"
            WHEN type = 'FARM' THEN 'buyer'::"OrgType"
            WHEN type = 'VENDOR' THEN $1::"OrgType"
            WHEN type = 'OPERATOR_PROVIDER' THEN 'operator'::"OrgType"
            ELSE NULL
          END;
        `,
          [vendorTarget],
        );

        // Verifica che tutti i valori siano stati convertiti
        const nullCheckQuery = `
          SELECT COUNT(*) as null_count
          FROM organizations
          WHERE type_new IS NULL;
        `;
        const nullCheck = await client.query(nullCheckQuery);
        const nullCount = parseInt(nullCheck.rows[0].null_count);

        if (nullCount > 0) {
          log(
            "red",
            `      ❌ ${nullCount} valori non convertiti. Rollback...`,
          );
          await client.query("ROLLBACK");
          return;
        }

        // Elimina colonna vecchia
        log("blue", "      Passo 3: Elimino colonna vecchia...");
        await client.query(`
          ALTER TABLE organizations 
          DROP COLUMN type;
        `);

        // Rinomina colonna nuova
        log("blue", "      Passo 4: Rinomino colonna...");
        await client.query(`
          ALTER TABLE organizations 
          RENAME COLUMN type_new TO type;
        `);

        // Aggiungi NOT NULL se necessario
        log("blue", "      Passo 5: Imposto NOT NULL...");
        await client.query(`
          ALTER TABLE organizations 
          ALTER COLUMN type SET NOT NULL;
        `);

        await client.query("COMMIT");
        log("green", "   ✅ Migrazione completata con successo!");
      } catch (error) {
        await client.query("ROLLBACK");
        log("red", `   ❌ Errore durante migrazione: ${error.message}`);
        log(
          "yellow",
          "   💡 La colonna rimane TEXT. Puoi riprovare dopo aver corretto i problemi.",
        );
        throw error;
      }
    }

    // Verifica finale
    log("cyan", "\n📋 Verifica finale...\n");
    const finalTypeQuery = `
      SELECT data_type, udt_name
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'organizations' 
      AND column_name = 'type';
    `;
    const finalTypeResult = await client.query(finalTypeQuery);

    if (finalTypeResult.rows.length > 0) {
      const finalDataType = finalTypeResult.rows[0].data_type;
      const finalUdtName = finalTypeResult.rows[0].udt_name;

      if (finalDataType === "USER-DEFINED" && finalUdtName === "OrgType") {
        log("green", "✅ organizations.type è ora enum OrgType");
      } else {
        log(
          "yellow",
          `⚠️  organizations.type è ancora ${finalDataType} (${finalUdtName})`,
        );
      }
    }

    log("cyan", "\n" + "=".repeat(60));
    log("green", "✅ Migrazione completata!");
    log("cyan", "=".repeat(60));
  } catch (error) {
    log("red", `\n❌ Errore: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrateOrgTypeToEnum();
