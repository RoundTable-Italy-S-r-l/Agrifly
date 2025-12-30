#!/usr/bin/env node

/**
 * Script per verificare i valori dell'enum ProductType nel database PostgreSQL
 */

const { Client } = require('pg');
require('dotenv').config();

async function checkProductTypeEnum() {
  const client = new Client({
    host: process.env.PGHOST,
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE || 'postgres',
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });

  try {
    await client.connect();
    console.log('✅ Connesso al database PostgreSQL\n');

    // Verifica i valori dell'enum ProductType
    const enumQuery = `
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = 'ProductType'::regtype 
      ORDER BY enumsortorder;
    `;

    const result = await client.query(enumQuery);
    
    console.log('📋 Valori enum ProductType:');
    console.log('='.repeat(50));
    if (result.rows.length === 0) {
      console.log('⚠️  Nessun valore trovato per ProductType');
      console.log('   L\'enum potrebbe non esistere o avere un nome diverso');
    } else {
      result.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. "${row.enumlabel}"`);
      });
    }
    console.log('='.repeat(50));

    // Verifica se "drone" (lowercase) esiste
    const hasDroneLowercase = result.rows.some(row => row.enumlabel === 'drone');
    const hasDroneUppercase = result.rows.some(row => row.enumlabel === 'DRONE');
    const hasDroneMixed = result.rows.some(row => row.enumlabel === 'Drone');

    console.log('\n🔍 Verifica valore "drone":');
    console.log(`   lowercase ("drone"): ${hasDroneLowercase ? '✅ Esiste' : '❌ Non esiste'}`);
    console.log(`   UPPERCASE ("DRONE"): ${hasDroneUppercase ? '✅ Esiste' : '❌ Non esiste'}`);
    console.log(`   Mixed ("Drone"): ${hasDroneMixed ? '✅ Esiste' : '❌ Non esiste'}`);

    if (!hasDroneLowercase && !hasDroneUppercase && !hasDroneMixed) {
      console.log('\n⚠️  Nessun valore "drone" trovato nell\'enum');
      console.log('   Il codice cerca "drone" (lowercase) ma potrebbe non esistere');
      console.log('   Soluzione: aggiungi il valore con:');
      console.log('   ALTER TYPE "ProductType" ADD VALUE \'drone\';');
    } else if (!hasDroneLowercase) {
      console.log('\n⚠️  Il valore "drone" (lowercase) non esiste');
      console.log('   Il codice cerca "drone" ma l\'enum ha un altro formato');
      console.log('   Soluzione: aggiungi il valore con:');
      console.log('   ALTER TYPE "ProductType" ADD VALUE \'drone\';');
    }

    // Verifica anche i prodotti esistenti
    console.log('\n📦 Verifica prodotti esistenti:');
    const productsQuery = `
      SELECT DISTINCT product_type, COUNT(*) as count
      FROM products
      GROUP BY product_type
      ORDER BY product_type;
    `;
    
    try {
      const productsResult = await client.query(productsQuery);
      if (productsResult.rows.length > 0) {
        console.log('   Valori product_type nei prodotti:');
        productsResult.rows.forEach(row => {
          console.log(`   - "${row.product_type}": ${row.count} prodotti`);
        });
      } else {
        console.log('   Nessun prodotto trovato');
      }
    } catch (error) {
      console.log('   ⚠️  Impossibile verificare i prodotti:', error.message);
    }

  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkProductTypeEnum();

