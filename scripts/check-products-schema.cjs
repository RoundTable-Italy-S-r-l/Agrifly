#!/usr/bin/env node

/**
 * Script per verificare lo schema della tabella products e il tipo di product_type
 */

const { Client } = require("pg");
require("dotenv").config();

async function checkProductsSchema() {
  const client = new Client({
    host: process.env.PGHOST,
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE || "postgres",
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });

  try {
    await client.connect();
    console.log("✅ Connesso al database Supabase PostgreSQL\n");

    // Verifica se la tabella products esiste
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'products'
      );
    `;
    const tableExists = await client.query(tableExistsQuery);

    if (!tableExists.rows[0].exists) {
      console.log("⚠️  Tabella products non trovata");
      return;
    }

    // Verifica il tipo della colonna product_type
    const columnInfoQuery = `
      SELECT 
        column_name,
        data_type,
        udt_name,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public'
      AND table_name = 'products' 
      AND column_name = 'product_type';
    `;

    const columnInfo = await client.query(columnInfoQuery);

    if (columnInfo.rows.length === 0) {
      console.log(
        "⚠️  Colonna product_type non trovata nella tabella products",
      );
    } else {
      const col = columnInfo.rows[0];
      console.log("📋 Informazioni colonna product_type:");
      console.log(`   - Tipo: ${col.data_type}`);
      console.log(`   - UDT Name: ${col.udt_name}`);
      console.log(`   - Nullable: ${col.is_nullable}`);
      console.log(`   - Default: ${col.column_default || "NULL"}`);

      // Se è un enum, verifica i valori
      if (col.data_type === "USER-DEFINED" || col.udt_name) {
        console.log("\n🔍 Verifica enum...");

        // Prova diversi nomi possibili per l'enum
        const possibleEnumNames = [
          "ProductType",
          "producttype",
          "product_type",
          col.udt_name,
        ];

        for (const enumName of possibleEnumNames) {
          try {
            const enumQuery = `
              SELECT enumlabel 
              FROM pg_enum 
              WHERE enumtypid = $1::regtype
              ORDER BY enumsortorder;
            `;
            const enumResult = await client.query(enumQuery, [enumName]);

            if (enumResult.rows.length > 0) {
              console.log(`\n✅ Enum trovato: "${enumName}"`);
              console.log("   Valori:");
              enumResult.rows.forEach((row, index) => {
                console.log(`     ${index + 1}. "${row.enumlabel}"`);
              });
              break;
            }
          } catch (error) {
            // Continua con il prossimo nome
          }
        }
      }

      // Verifica i valori esistenti nella tabella
      console.log("\n📦 Valori product_type nei prodotti esistenti:");
      const valuesQuery = `
        SELECT DISTINCT product_type, COUNT(*) as count
        FROM products
        GROUP BY product_type
        ORDER BY product_type;
      `;

      try {
        const valuesResult = await client.query(valuesQuery);
        if (valuesResult.rows.length > 0) {
          valuesResult.rows.forEach((row) => {
            console.log(`   - "${row.product_type}": ${row.count} prodotti`);
          });
        } else {
          console.log("   Nessun prodotto trovato");
        }
      } catch (error) {
        console.log(`   ⚠️  Errore: ${error.message}`);
      }
    }

    // Verifica anche tutti gli enum disponibili
    console.log("\n📋 Tutti gli enum disponibili nel database:");
    const allEnumsQuery = `
      SELECT 
        t.typname as enum_name,
        e.enumlabel as enum_value
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid 
      ORDER BY t.typname, e.enumsortorder;
    `;

    try {
      const allEnumsResult = await client.query(allEnumsQuery);
      if (allEnumsResult.rows.length > 0) {
        const enumsByType = {};
        allEnumsResult.rows.forEach((row) => {
          if (!enumsByType[row.enum_name]) {
            enumsByType[row.enum_name] = [];
          }
          enumsByType[row.enum_name].push(row.enum_value);
        });

        Object.keys(enumsByType).forEach((enumName) => {
          console.log(
            `   ${enumName}: [${enumsByType[enumName].map((v) => `"${v}"`).join(", ")}]`,
          );
        });
      } else {
        console.log("   Nessun enum trovato");
      }
    } catch (error) {
      console.log(`   ⚠️  Errore: ${error.message}`);
    }
  } catch (error) {
    console.error("❌ Errore:", error.message);
    console.error("   Stack:", error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkProductsSchema();
