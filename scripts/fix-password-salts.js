import { Client } from 'pg';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carica .env dalla root del progetto
dotenv.config({ path: join(__dirname, '../.env') });

const client = new Client({
  host: process.env.PGHOST || process.env.DATABASE_URL?.match(/@([^:]+)/)?.[1],
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER || process.env.DATABASE_URL?.match(/:\/\/([^:]+):/)?.[1],
  password: process.env.PGPASSWORD || process.env.DATABASE_URL?.match(/:\/\/[^:]+:([^@]+)@/)?.[1]?.replace(/%5/g, '%'),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000,
});

async function fixPasswordSalts() {
  try {
    await client.connect();
    console.log('✅ Connesso al database\n');

    // Trova utenti con password_hash ma senza password_salt
    console.log('🔍 Cerca utenti con password_hash ma senza password_salt...');
    const usersWithoutSalt = await client.query(`
      SELECT id, email, first_name, last_name, password_hash, password_salt
      FROM users
      WHERE password_hash IS NOT NULL AND (password_salt IS NULL OR password_salt = '')
    `);

    if (usersWithoutSalt.rows.length === 0) {
      console.log('✅ Nessun utente con problema password_salt');
      return;
    }

    console.log(`⚠️  Trovati ${usersWithoutSalt.rows.length} utenti con password_hash ma senza salt:\n`);

    for (const user of usersWithoutSalt.rows) {
      console.log(`  - ${user.email} (${user.first_name} ${user.last_name})`);
      console.log(`    Password hash presente: ${user.password_hash ? '✅' : '❌'}`);
      console.log(`    Password salt presente: ${user.password_salt ? '✅' : '❌'}`);
      
      // IMPORTANTE: Non possiamo rigenerare l'hash perché non abbiamo la password in chiaro
      // Le password sono state create con il vecchio sistema (Supabase) e non sono compatibili
      // con il nuovo sistema PBKDF2 che richiede salt.
      
      // Opzioni:
      // 1. Impostare salt a NULL (utente dovrà resettare password)
      // 2. Generare un salt placeholder (ma l'hash non funzionerà comunque)
      // 3. Forzare reset password per questi utenti
      
      console.log(`    ⚠️  ATTENZIONE: Questo utente ha una password del vecchio sistema.`);
      console.log(`    ⚠️  Non può fare login finché non resetta la password.`);
      console.log(`    💡 Soluzione: Impostare salt a NULL e forzare reset password\n`);
    }

    // Chiedi conferma prima di procedere
    console.log('📝 AZIONE PROPOSTA:');
    console.log('   - Impostare password_salt = NULL per questi utenti');
    console.log('   - Questo forzerà un reset password al prossimo login');
    console.log('\n⚠️  Questi utenti NON potranno fare login finché non resettano la password!\n');

    // Procedi con la fix (imposta salt a NULL)
    console.log('🔧 Applico fix...');
    for (const user of usersWithoutSalt.rows) {
      await client.query(`
        UPDATE users 
        SET password_salt = NULL
        WHERE id = $1
      `, [user.id]);
      console.log(`  ✅ Aggiornato ${user.email}`);
    }

    console.log('\n✅ Fix applicato!');
    console.log('\n📋 PROSSIMI PASSI:');
    console.log('   1. Gli utenti dovranno usare "Password dimenticata" per resettare');
    console.log('   2. Oppure un admin può resettare manualmente le password');
    console.log('   3. Dopo il reset, le password saranno create con il nuovo sistema PBKDF2 + salt');

  } catch (err) {
    console.error('❌ Errore:', err.message);
    console.error('Stack:', err.stack);
  } finally {
    await client.end();
  }
}

fixPasswordSalts();
