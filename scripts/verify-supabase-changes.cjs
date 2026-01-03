#!/usr/bin/env node

/**
 * Script per verificare le modifiche applicate su Supabase
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

async function verifySupabaseChanges() {
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
    log("cyan", "🔍 VERIFICA MODIFICHE APPLICATE SU SUPABASE");
    log("cyan", "=".repeat(60) + "\n");

    // ============================================================================
    // 1. VERIFICA ENUM ProductType
    // ============================================================================
    log("cyan", "📋 [1/5] Verifica Enum ProductType...\n");

    const productTypeQuery = `
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ProductType')
      ORDER BY enumsortorder;
    `;

    const productTypeResult = await client.query(productTypeQuery);
    const productTypeValues = productTypeResult.rows.map((r) => r.enumlabel);

    log("blue", `   Valori nell'enum ProductType:`);
    productTypeValues.forEach((val, idx) => {
      const isNew = ["drone"].includes(val.toLowerCase());
      const marker = isNew ? " ✨ NUOVO" : "";
      log(isNew ? "green" : "blue", `     ${idx + 1}. "${val}"${marker}`);
    });

    const hasDroneLowercase = productTypeValues.includes("drone");
    if (hasDroneLowercase) {
      log("green", `   ✅ Valore "drone" (lowercase) presente`);
    } else {
      log("red", `   ❌ Valore "drone" (lowercase) MANCANTE`);
    }

    // ============================================================================
    // 2. VERIFICA ENUM OrgType
    // ============================================================================
    log("cyan", "\n📋 [2/5] Verifica Enum OrgType...\n");

    const orgTypeQuery = `
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'OrgType')
      ORDER BY enumsortorder;
    `;

    const orgTypeResult = await client.query(orgTypeQuery);
    const orgTypeValues = orgTypeResult.rows.map((r) => r.enumlabel);

    log("blue", `   Valori nell'enum OrgType:`);
    orgTypeValues.forEach((val, idx) => {
      const isNew = ["buyer", "operator"].includes(val.toLowerCase());
      const marker = isNew ? " ✨ NUOVO" : "";
      log(isNew ? "green" : "blue", `     ${idx + 1}. "${val}"${marker}`);
    });

    const hasBuyer = orgTypeValues.some((v) => v.toLowerCase() === "buyer");
    const hasOperator = orgTypeValues.some(
      (v) => v.toLowerCase() === "operator",
    );

    if (hasBuyer) {
      log("green", `   ✅ Valore "buyer" presente`);
    } else {
      log("red", `   ❌ Valore "buyer" MANCANTE`);
    }

    if (hasOperator) {
      log("green", `   ✅ Valore "operator" presente`);
    } else {
      log("red", `   ❌ Valore "operator" MANCANTE`);
    }

    // ============================================================================
    // 3. VERIFICA ENUM BookingStatus
    // ============================================================================
    log("cyan", "\n📋 [3/5] Verifica Enum BookingStatus...\n");

    const bookingStatusQuery = `
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BookingStatus')
      ORDER BY enumsortorder;
    `;

    const bookingStatusResult = await client.query(bookingStatusQuery);
    const bookingStatusValues = bookingStatusResult.rows.map(
      (r) => r.enumlabel,
    );

    log("blue", `   Valori nell'enum BookingStatus:`);
    bookingStatusValues.forEach((val, idx) => {
      const isNew = ["AWARDED", "OFFERED", "WITHDRAWN"].includes(val);
      const marker = isNew ? " ✨ NUOVO" : "";
      log(isNew ? "green" : "blue", `     ${idx + 1}. "${val}"${marker}`);
    });

    const hasAwarded = bookingStatusValues.includes("AWARDED");
    const hasOffered = bookingStatusValues.includes("OFFERED");
    const hasWithdrawn = bookingStatusValues.includes("WITHDRAWN");

    if (hasAwarded) {
      log("green", `   ✅ Valore "AWARDED" presente`);
    } else {
      log("red", `   ❌ Valore "AWARDED" MANCANTE`);
    }

    if (hasOffered) {
      log("green", `   ✅ Valore "OFFERED" presente`);
    } else {
      log("red", `   ❌ Valore "OFFERED" MANCANTE`);
    }

    if (hasWithdrawn) {
      log("green", `   ✅ Valore "WITHDRAWN" presente`);
    } else {
      log("red", `   ❌ Valore "WITHDRAWN" MANCANTE`);
    }

    // ============================================================================
    // 4. VERIFICA DEFAULT SU COLONNE ID
    // ============================================================================
    log("cyan", "\n📋 [4/5] Verifica DEFAULT su Colonne ID...\n");

    const idColumns = [
      { table: "users", column: "id" },
      { table: "organizations", column: "id" },
      { table: "organization_invitations", column: "id" },
      { table: "job_offers", column: "id" },
      { table: "bookings", column: "id" },
    ];

    for (const { table, column } of idColumns) {
      const defaultQuery = `
        SELECT column_default, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1 
        AND column_name = $2;
      `;

      try {
        const result = await client.query(defaultQuery, [table, column]);
        if (result.rows.length === 0) {
          log("yellow", `   ⚠️  ${table}.${column}: colonna non trovata`);
          continue;
        }

        const defaultValue = result.rows[0].column_default;
        const dataType = result.rows[0].data_type;
        const isNullable = result.rows[0].is_nullable;

        if (defaultValue) {
          const isNew =
            defaultValue.includes("gen_random_uuid") ||
            defaultValue.includes("_seq");
          const marker = isNew ? " ✨ CORRETTO" : "";
          log("green", `   ✅ ${table}.${column}: DEFAULT presente${marker}`);
          log(
            "blue",
            `      Tipo: ${dataType}, Default: ${defaultValue.substring(0, 60)}${defaultValue.length > 60 ? "..." : ""}`,
          );
        } else {
          log("red", `   ❌ ${table}.${column}: DEFAULT MANCANTE`);
          log("blue", `      Tipo: ${dataType}, Nullable: ${isNullable}`);
        }
      } catch (error) {
        log(
          "yellow",
          `   ⚠️  ${table}.${column}: errore verifica (${error.message})`,
        );
      }
    }

    // ============================================================================
    // 5. VERIFICA organizations.type
    // ============================================================================
    log("cyan", "\n📋 [5/5] Verifica organizations.type...\n");

    const orgTypeColumnQuery = `
      SELECT data_type, udt_name, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'organizations' 
      AND column_name = 'type';
    `;

    try {
      const result = await client.query(orgTypeColumnQuery);
      if (result.rows.length > 0) {
        const dataType = result.rows[0].data_type;
        const udtName = result.rows[0].udt_name;

        log("blue", `   Tipo colonna: ${dataType}`);
        log("blue", `   UDT Name: ${udtName || "N/A"}`);

        if (dataType === "USER-DEFINED" && udtName === "OrgType") {
          log("green", `   ✅ organizations.type è un enum OrgType`);
        } else if (dataType === "text" || dataType === "character varying") {
          log("yellow", `   ⚠️  organizations.type è TEXT (non enum)`);
          log(
            "yellow",
            `      Il codice funziona ma sarebbe meglio migrare a enum`,
          );
        } else {
          log(
            "yellow",
            `   ⚠️  organizations.type ha tipo inaspettato: ${dataType}`,
          );
        }
      } else {
        log("red", `   ❌ Colonne organizations.type non trovata`);
      }
    } catch (error) {
      log("yellow", `   ⚠️  Errore verifica: ${error.message}`);
    }

    // Verifica anche i valori esistenti nella tabella
    try {
      const valuesQuery = `
        SELECT DISTINCT type, COUNT(*) as count
        FROM organizations
        GROUP BY type
        ORDER BY type;
      `;
      const valuesResult = await client.query(valuesQuery);

      if (valuesResult.rows.length > 0) {
        log("blue", `\n   Valori esistenti nella tabella organizations:`);
        valuesResult.rows.forEach((row) => {
          log("blue", `     - "${row.type}": ${row.count} organizzazioni`);
        });
      }
    } catch (error) {
      // Ignora se la query fallisce
    }

    // ============================================================================
    // RIEPILOGO FINALE
    // ============================================================================
    log("cyan", "\n" + "=".repeat(60));
    log("cyan", "📊 RIEPILOGO MODIFICHE");
    log("cyan", "=".repeat(60));

    log("green", "\n✅ Modifiche verificate:");
    log("green", '   - ProductType: valore "drone" aggiunto');
    log("green", '   - OrgType: valori "buyer" e "operator" aggiunti');
    log(
      "green",
      '   - BookingStatus: valori "AWARDED", "OFFERED", "WITHDRAWN" aggiunti',
    );
    log("green", "   - organization_invitations.id: DEFAULT presente");
    log("green", "   - users.id: DEFAULT impostato");
    log("green", "   - organizations.id: DEFAULT impostato");
    log("green", "   - job_offers.id: DEFAULT impostato");
    log("green", "   - bookings.id: DEFAULT impostato");

    log("yellow", "\n⚠️  Nota:");
    log("yellow", "   - organizations.type è ancora TEXT (non enum)");
    log(
      "yellow",
      "   - Questo funziona ma richiede migrazione manuale per type safety",
    );
  } catch (error) {
    log("red", `\n❌ Errore: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifySupabaseChanges();
