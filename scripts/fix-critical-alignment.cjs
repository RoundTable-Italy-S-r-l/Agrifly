#!/usr/bin/env node

/**
 * Script per correggere automaticamente i disallineamenti critici trovati
 */

const { Client } = require("pg");
require("dotenv").config();

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(color, ...args) {
  console.log(colors[color] || colors.reset, ...args, colors.reset);
}

async function fixCriticalAlignment() {
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

    // ============================================================================
    // 1. AGGIUNGI VALORI MANCANTI AGLI ENUM
    // ============================================================================
    log("cyan", "📋 [1/3] Aggiunta valori mancanti agli enum...\n");

    // OrgType: aggiungi "buyer" e "operator" se non esistono
    const orgTypeValues = ["buyer", "operator"];
    for (const value of orgTypeValues) {
      try {
        await client.query(
          `ALTER TYPE "OrgType" ADD VALUE IF NOT EXISTS '${value}';`,
        );
        log("green", `   ✅ Aggiunto "${value}" a OrgType`);
      } catch (error) {
        if (error.message.includes("IF NOT EXISTS")) {
          // Prova senza IF NOT EXISTS
          try {
            await client.query(`ALTER TYPE "OrgType" ADD VALUE '${value}';`);
            log("green", `   ✅ Aggiunto "${value}" a OrgType`);
          } catch (error2) {
            if (
              error2.message.includes("already exists") ||
              error2.message.includes("duplicate")
            ) {
              log("yellow", `   ℹ️  "${value}" già presente in OrgType`);
            } else {
              log(
                "yellow",
                `   ⚠️  Errore aggiunta "${value}" a OrgType: ${error2.message}`,
              );
            }
          }
        } else if (
          error.message.includes("already exists") ||
          error.message.includes("duplicate")
        ) {
          log("yellow", `   ℹ️  "${value}" già presente in OrgType`);
        } else {
          log(
            "yellow",
            `   ⚠️  Errore aggiunta "${value}" a OrgType: ${error.message}`,
          );
        }
      }
    }

    // BookingStatus: aggiungi valori mancanti
    const bookingStatusValues = ["AWARDED", "OFFERED", "WITHDRAWN"];
    for (const value of bookingStatusValues) {
      try {
        await client.query(
          `ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS '${value}';`,
        );
        log("green", `   ✅ Aggiunto "${value}" a BookingStatus`);
      } catch (error) {
        if (error.message.includes("IF NOT EXISTS")) {
          try {
            await client.query(
              `ALTER TYPE "BookingStatus" ADD VALUE '${value}';`,
            );
            log("green", `   ✅ Aggiunto "${value}" a BookingStatus`);
          } catch (error2) {
            if (
              error2.message.includes("already exists") ||
              error2.message.includes("duplicate")
            ) {
              log("yellow", `   ℹ️  "${value}" già presente in BookingStatus`);
            } else {
              log(
                "yellow",
                `   ⚠️  Errore aggiunta "${value}" a BookingStatus: ${error2.message}`,
              );
            }
          }
        } else if (
          error.message.includes("already exists") ||
          error.message.includes("duplicate")
        ) {
          log("yellow", `   ℹ️  "${value}" già presente in BookingStatus`);
        } else {
          log(
            "yellow",
            `   ⚠️  Errore aggiunta "${value}" a BookingStatus: ${error.message}`,
          );
        }
      }
    }

    // ============================================================================
    // 2. CORREZIONE DEFAULT SU COLONNE ID
    // ============================================================================
    log("cyan", "\n📋 [2/3] Correzione DEFAULT su colonne ID...\n");

    const idColumns = [
      { table: "users", column: "id" },
      { table: "organizations", column: "id" },
      { table: "job_offers", column: "id" },
      { table: "bookings", column: "id" },
    ];

    for (const { table, column } of idColumns) {
      // Verifica se ha già un default
      const checkQuery = `
        SELECT column_default, data_type
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1 
        AND column_name = $2;
      `;

      try {
        const result = await client.query(checkQuery, [table, column]);
        if (result.rows.length === 0) {
          log("yellow", `   ⚠️  ${table}.${column}: colonna non trovata`);
          continue;
        }

        const defaultValue = result.rows[0].column_default;
        const dataType = result.rows[0].data_type;

        if (!defaultValue) {
          // Crea sequence se non esiste
          const sequenceName = `${table}_${column}_seq`;
          const sequenceExistsQuery = `
            SELECT EXISTS (
              SELECT FROM pg_sequences 
              WHERE sequencename = $1
            );
          `;
          const seqExists = await client.query(sequenceExistsQuery, [
            sequenceName,
          ]);

          if (!seqExists.rows[0].exists) {
            await client.query(`CREATE SEQUENCE ${sequenceName};`);
            log("blue", `   ✅ Sequence ${sequenceName} creata`);
          }

          // Imposta default (per TEXT usiamo gen_random_uuid() se disponibile, altrimenti sequence)
          if (dataType === "text" || dataType === "character varying") {
            // Per TEXT, prova prima con gen_random_uuid()
            try {
              await client.query(`
                ALTER TABLE ${table} 
                ALTER COLUMN ${column} SET DEFAULT gen_random_uuid()::text;
              `);
              log(
                "green",
                `   ✅ ${table}.${column}: DEFAULT impostato (gen_random_uuid())`,
              );
            } catch (error) {
              // Se gen_random_uuid() non funziona, usa la sequence
              await client.query(`
                ALTER TABLE ${table} 
                ALTER COLUMN ${column} SET DEFAULT nextval('${sequenceName}')::text;
              `);
              log(
                "green",
                `   ✅ ${table}.${column}: DEFAULT impostato (sequence)`,
              );
            }
          } else {
            // Per altri tipi, usa la sequence
            await client.query(`
              ALTER TABLE ${table} 
              ALTER COLUMN ${column} SET DEFAULT nextval('${sequenceName}');
            `);
            log("green", `   ✅ ${table}.${column}: DEFAULT impostato`);
          }
        } else {
          log("yellow", `   ℹ️  ${table}.${column}: DEFAULT già presente`);
        }
      } catch (error) {
        log("yellow", `   ⚠️  ${table}.${column}: errore (${error.message})`);
      }
    }

    // ============================================================================
    // 3. NOTA SU organizations.type
    // ============================================================================
    log("cyan", "\n📋 [3/3] Nota su organizations.type...\n");
    log("yellow", "   ⚠️  organizations.type è TEXT invece di enum OrgType");
    log("yellow", "   Questo richiede una migrazione manuale:");
    log(
      "yellow",
      "   1. Verifica che tutti i valori in organizations.type siano validi per OrgType",
    );
    log("yellow", "   2. Crea una colonna temporanea");
    log("yellow", "   3. Migra i dati");
    log("yellow", "   4. Rinomina le colonne");
    log(
      "yellow",
      "   Per ora il codice funziona perché PostgreSQL accetta TEXT per enum",
    );
    log("yellow", "   ma è meglio migrare a enum per type safety");

    log("cyan", "\n" + "=".repeat(60));
    log("green", "✅ Correzioni completate!");
    log("cyan", "=".repeat(60));
  } catch (error) {
    log("red", `\n❌ Errore: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixCriticalAlignment();
