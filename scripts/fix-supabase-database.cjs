#!/usr/bin/env node

/**
 * Script per correggere i problemi del database Supabase PostgreSQL
 * 
 * Correzioni applicate:
 * 1. Aggiunge 'drone' all'enum ProductType se non esiste
 * 2. Corregge organization_invitations.id aggiungendo DEFAULT con sequence
 */

const { Client } = require('pg');
require('dotenv').config();

async function fixSupabaseDatabase() {
  const client = new Client({
    host: process.env.PGHOST,
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE || 'postgres',
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });

  try {
    await client.connect();
    console.log('✅ Connesso al database Supabase PostgreSQL\n');

    // ============================================================================
    // 1. VERIFICA E CORREZIONE ENUM ProductType
    // ============================================================================
    console.log('📋 [1/2] Verifica enum ProductType...');
    
    // Trova l'OID del tipo ProductType usando il nome esatto
    const findEnumQuery = `
      SELECT oid, typname 
      FROM pg_type 
      WHERE typname = 'ProductType';
    `;
    const enumTypeResult = await client.query(findEnumQuery);
    
    if (enumTypeResult.rows.length === 0) {
      console.log('   ⚠️  Enum ProductType non trovato');
      console.log('   ℹ️  Saltando correzione enum');
    } else {
      const enumOid = enumTypeResult.rows[0].oid;
      
      const enumQuery = `
        SELECT enumlabel 
        FROM pg_enum 
        WHERE enumtypid = $1
        ORDER BY enumsortorder;
      `;
    
      const enumResult = await client.query(enumQuery, [enumOid]);
      console.log('   Valori esistenti:', enumResult.rows.map(r => `"${r.enumlabel}"`).join(', '));
      
      const hasDroneLowercase = enumResult.rows.some(row => row.enumlabel === 'drone');
      const hasDroneUppercase = enumResult.rows.some(row => row.enumlabel === 'DRONE');
      
      if (!hasDroneLowercase) {
        console.log('   ⚠️  Valore "drone" (lowercase) non trovato');
        console.log(`   ℹ️  Valore "DRONE" (uppercase) ${hasDroneUppercase ? 'presente' : 'non presente'}`);
        console.log('   ➕ Aggiungo "drone" (lowercase) all\'enum ProductType...');
        
        try {
          // PostgreSQL richiede che l'ADD VALUE sia in una transazione separata
          // e non può essere fatto in una transazione con altre operazioni
          await client.query('ALTER TYPE "ProductType" ADD VALUE IF NOT EXISTS \'drone\';');
          console.log('   ✅ Valore "drone" aggiunto con successo');
        } catch (error) {
          // IF NOT EXISTS non è supportato in tutte le versioni di PostgreSQL
          // Se fallisce, prova senza IF NOT EXISTS
          if (error.message.includes('already exists') || error.message.includes('duplicate')) {
            console.log('   ℹ️  Valore "drone" già esistente (ignorato)');
          } else if (error.message.includes('IF NOT EXISTS')) {
            // Prova senza IF NOT EXISTS
            try {
              await client.query('ALTER TYPE "ProductType" ADD VALUE \'drone\';');
              console.log('   ✅ Valore "drone" aggiunto con successo');
            } catch (error2) {
              if (error2.message.includes('already exists') || error2.message.includes('duplicate')) {
                console.log('   ℹ️  Valore "drone" già esistente');
              } else {
                throw error2;
              }
            }
          } else {
            throw error;
          }
        }
      } else {
        console.log('   ✅ Valore "drone" già presente');
      }
    }

    // ============================================================================
    // 2. CORREZIONE organization_invitations.id
    // ============================================================================
    console.log('\n📋 [2/2] Verifica organization_invitations.id...');
    
    // Verifica se la tabella esiste
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'organization_invitations'
      );
    `;
    const tableExists = await client.query(tableExistsQuery);
    
    if (!tableExists.rows[0].exists) {
      console.log('   ⚠️  Tabella organization_invitations non trovata');
      console.log('   ℹ️  Saltando correzione (tabella non esiste)');
    } else {
      // Verifica configurazione attuale
      const columnInfoQuery = `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          is_identity
        FROM information_schema.columns 
        WHERE table_name = 'organization_invitations' 
        AND column_name = 'id';
      `;
      
      const columnInfo = await client.query(columnInfoQuery);
      
      if (columnInfo.rows.length === 0) {
        console.log('   ⚠️  Colonna id non trovata');
        console.log('   ℹ️  Saltando correzione (colonna non esiste)');
      } else {
        const col = columnInfo.rows[0];
        console.log('   Configurazione attuale:');
        console.log(`     - Tipo: ${col.data_type}`);
        console.log(`     - Nullable: ${col.is_nullable}`);
        console.log(`     - Default: ${col.column_default || 'NULL'}`);
        console.log(`     - Identity: ${col.is_identity || 'NO'}`);
        
        // Se non ha default e non è identity, aggiungilo
        if (!col.column_default && col.is_identity !== 'YES') {
          console.log('   ⚠️  Colonna id non ha DEFAULT');
          console.log('   ➕ Creo sequence e imposto DEFAULT...');
          
          // Crea sequence se non esiste
          const sequenceExistsQuery = `
            SELECT EXISTS (
              SELECT FROM pg_sequences 
              WHERE sequencename = 'organization_invitations_id_seq'
            );
          `;
          const sequenceExists = await client.query(sequenceExistsQuery);
          
          if (!sequenceExists.rows[0].exists) {
            await client.query('CREATE SEQUENCE organization_invitations_id_seq;');
            console.log('   ✅ Sequence creata');
          } else {
            console.log('   ℹ️  Sequence già esistente');
          }
          
          // Imposta il default
          await client.query(`
            ALTER TABLE organization_invitations 
            ALTER COLUMN id SET DEFAULT nextval('organization_invitations_id_seq');
          `);
          console.log('   ✅ DEFAULT impostato');
          
          // Imposta la sequence al valore max attuale +1
          // Se id è TEXT, non possiamo usare MAX direttamente, quindi iniziamo da 1
          // Se id è INTEGER/NUMERIC, usiamo MAX
          if (col.data_type === 'integer' || col.data_type === 'bigint' || col.data_type === 'numeric') {
            const maxIdQuery = 'SELECT COALESCE(MAX(id), 0)::bigint as max_id FROM organization_invitations;';
            const maxIdResult = await client.query(maxIdQuery);
            const maxId = parseInt(maxIdResult.rows[0].max_id) || 0;
            
            await client.query(`
              SELECT setval('organization_invitations_id_seq', $1);
            `, [maxId + 1]);
            console.log(`   ✅ Sequence impostata a ${maxId + 1}`);
          } else {
            // Per TEXT/UUID, iniziamo la sequence da 1
            await client.query(`
              SELECT setval('organization_invitations_id_seq', 1, false);
            `);
            console.log('   ✅ Sequence inizializzata a 1 (tipo TEXT/UUID)');
            console.log('   ⚠️  ATTENZIONE: La colonna id è di tipo TEXT');
            console.log('      Potresti voler cambiarla a UUID o INTEGER');
          }
          
          // Verifica se è PK, se no aggiungila
          const pkExistsQuery = `
            SELECT EXISTS (
              SELECT FROM information_schema.table_constraints 
              WHERE table_name = 'organization_invitations' 
              AND constraint_type = 'PRIMARY KEY'
            );
          `;
          const pkExists = await client.query(pkExistsQuery);
          
          if (!pkExists.rows[0].exists) {
            await client.query('ALTER TABLE organization_invitations ADD PRIMARY KEY (id);');
            console.log('   ✅ Primary key aggiunta');
          } else {
            console.log('   ℹ️  Primary key già esistente');
          }
        } else {
          console.log('   ✅ Colonna id già configurata correttamente');
        }
      }
    }

    // ============================================================================
    // VERIFICA FINALE
    // ============================================================================
    console.log('\n📊 Verifica finale...');
    
    // Verifica enum finale
    const finalEnumTypeResult = await client.query(findEnumQuery);
    if (finalEnumTypeResult.rows.length > 0) {
      const finalEnumOid = finalEnumTypeResult.rows[0].oid;
      const finalEnumQuery = `
        SELECT enumlabel 
        FROM pg_enum 
        WHERE enumtypid = $1
        ORDER BY enumsortorder;
      `;
      const finalEnumResult = await client.query(finalEnumQuery, [finalEnumOid]);
      console.log('   Enum ProductType:', finalEnumResult.rows.map(r => `"${r.enumlabel}"`).join(', '));
    }
    
    // Verifica organization_invitations
    if (tableExists.rows[0].exists) {
      const finalColumnInfoQuery = `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          is_identity
        FROM information_schema.columns 
        WHERE table_name = 'organization_invitations' 
        AND column_name = 'id';
      `;
      const finalColumnInfo = await client.query(finalColumnInfoQuery);
      if (finalColumnInfo.rows.length > 0) {
        const col = finalColumnInfo.rows[0];
        console.log('   organization_invitations.id:');
        console.log(`     - Default: ${col.column_default || 'NULL'}`);
        console.log(`     - Identity: ${col.is_identity || 'NO'}`);
      }
    }

    console.log('\n✅ Tutte le correzioni completate con successo!');

  } catch (error) {
    console.error('\n❌ Errore durante la correzione:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Esegui solo se chiamato direttamente
if (require.main === module) {
  fixSupabaseDatabase().catch(console.error);
}

module.exports = { fixSupabaseDatabase };

