/**
 * Script per popolare manuals_pdf_json per il T70P
 */

import { query } from '../utils/database.js';

async function populateT70PManuals() {
  try {
    console.log('📝 Popolando manuals_pdf_json per T70P...');

    // Ottieni URL Supabase da variabili d'ambiente
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      console.error('❌ Errore: SUPABASE_URL deve essere configurato nelle variabili d\'ambiente');
      return;
    }

    // Costruisci URL dinamicamente basandoti sulla struttura del bucket
    const buildUrl = (path) => {
      return `${supabaseUrl}/storage/v1/object/public/Media%20FIle/${encodeURIComponent(path)}`;
    };

    // Basandomi sulla struttura del bucket che hai condiviso, provo questi percorsi
    const possibleManuals = [
      // Cartella t70p/
      {
        filename: 'DJI Agras T70P User Manual.pdf',
        url: buildUrl('t70p/DJI_Agras_T70P_User_Manual.pdf'),
        type: 'User Manual'
      },
      {
        filename: 'DJI Agras T70P Quick Start Guide.pdf',
        url: buildUrl('t70p/DJI_Agras_T70P_Quick_Start_Guide.pdf'),
        type: 'Quick Start Guide'
      },
      {
        filename: 'DJI Agras T70P Safety Instructions.pdf',
        url: buildUrl('t70p/DJI_Agras_T70P_Safety_Instructions.pdf'),
        type: 'Safety Instructions'
      },
      {
        filename: 'DJI Agras T70P Maintenance Manual.pdf',
        url: buildUrl('t70p/DJI_Agras_T70P_Maintenance_Manual.pdf'),
        type: 'Maintenance Manual'
      },
      // Cartella pdf/ (come i PDF del T50)
      {
        filename: 'T70P User Manual.pdf',
        url: buildUrl('pdf/T70P_User_Manual.pdf'),
        type: 'User Manual'
      },
      {
        filename: 'T70P Quick Start Guide.pdf',
        url: buildUrl('pdf/T70P_Quick_Start_Guide.pdf'),
        type: 'Quick Start Guide'
      },
      {
        filename: 'T70P Safety Guidelines.pdf',
        url: buildUrl('pdf/T70P_Safety_Guidelines.pdf'),
        type: 'Safety Instructions'
      }
    ];

    // Verifica quali PDF esistono realmente
    console.log('🔍 Verificando quali PDF esistono...');
    const existingManuals = [];

    for (const manual of possibleManuals) {
      try {
        const response = await fetch(manual.url, { method: 'HEAD' });
        if (response.ok) {
          console.log(`✅ ${manual.filename} - ESISTE`);
          existingManuals.push(manual);
        } else {
          console.log(`❌ ${manual.filename} - NON ESISTE (${response.status})`);
        }
      } catch (error) {
        console.log(`❌ ${manual.filename} - ERRORE: ${error.message}`);
      }
    }

    if (existingManuals.length === 0) {
      console.log('❌ Nessuno dei PDF previsti esiste nel bucket.');
      console.log('\n📋 ISTRUZIONI PER CARICARE I PDF:');
      console.log('1. Vai nel tuo bucket Supabase "Media FIle"');
      console.log('2. Crea la cartella "t70p/" se non esiste');
      console.log('3. Carica i PDF del T70P nella cartella "Media FIle/t70p/"');
      console.log('4. Rinomina i file con nomi semplici, ad esempio:');
      console.log('   - DJI_Agras_T70P_User_Manual.pdf');
      console.log('   - DJI_Agras_T70P_Quick_Start_Guide.pdf');
      console.log('   - DJI_Agras_T70P_Safety_Instructions.pdf');
      console.log('5. Ritorna qui e ti aiuto a popolare il database');

      console.log('\n🔧 OPPURE, se hai già gli URL diretti dei PDF, dimmi quali sono e li aggiungo manualmente.');

      return;
    }

    console.log(`📄 Trovati ${existingManuals.length} PDF esistenti`);

    // Aggiorna il database
    const manualsJson = JSON.stringify(existingManuals);
    console.log('💾 Aggiornando database...');

    const updateResult = await query(`
      UPDATE products
      SET manuals_pdf_json = $1
      WHERE id = (SELECT p.id FROM products p JOIN skus s ON p.id = s.product_id WHERE s.sku_code = 't70p' LIMIT 1)
    `, [manualsJson]);

    console.log(`✅ Database aggiornato. Righe modificate: ${updateResult.rowCount}`);

    // Verifica l'aggiornamento
    const verifyResult = await query(`
      SELECT manuals_pdf_json
      FROM products
      WHERE id = (SELECT p.id FROM products p JOIN skus s ON p.id = s.product_id WHERE s.sku_code = 't70p' LIMIT 1)
    `);

    if (verifyResult.rows.length > 0) {
      const manuals = JSON.parse(verifyResult.rows[0].manuals_pdf_json || '[]');
      console.log(`📋 Manuals nel database: ${manuals.length}`);
      manuals.forEach(manual => {
        console.log(`  - ${manual.filename} (${manual.type})`);
      });
    }

  } catch (error) {
    console.error('❌ Errore:', error);
  }
}

populateT70PManuals();
