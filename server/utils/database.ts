import { Client } from 'pg';
import Database from 'better-sqlite3';

// Funzione per creare una nuova connessione per ogni richiesta (serverless-friendly)
export const getClient = () => {
  // Usa SQLite per sviluppo locale, PostgreSQL per produzione
  // PRIORITÀ: DATABASE_URL con file: ha sempre la precedenza (sviluppo locale)
  const hasFileDatabase = process.env.DATABASE_URL?.startsWith('file:');
  const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  const hasPostgresConfig = process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD;
  
  // Se DATABASE_URL punta a un file, usa SEMPRE SQLite (sviluppo locale)
  // Altrimenti, se siamo in development senza PGHOST, usa SQLite
  // Solo in produzione (con PGHOST e senza DATABASE_URL file:) usa PostgreSQL
  if (hasFileDatabase || (isDevelopment && !hasPostgresConfig)) {
    const db = new Database(process.env.DATABASE_URL?.replace('file:', '') || './prisma/dev.db');
      return {
      query: (text: string, params?: any[]) => {
        const stmt = db.prepare(text);
        // Determina se è una query che restituisce dati (SELECT) o no (INSERT/UPDATE/DELETE)
        const isSelect = text.trim().toUpperCase().startsWith('SELECT');
        if (isSelect) {
          const result = params ? stmt.all(...params) : stmt.all();
          return { rows: result };
        } else {
          // Per INSERT/UPDATE/DELETE usa run()
          const result = params ? stmt.run(...params) : stmt.run();
          return { rows: [], lastInsertRowid: result.lastInsertRowid, changes: result.changes };
        }
      },
      end: () => db.close()
    };
  }

  // Verifica che tutte le variabili d'ambiente necessarie siano presenti
  if (!process.env.PGHOST || !process.env.PGPORT || !process.env.PGDATABASE || !process.env.PGUSER || !process.env.PGPASSWORD) {
    throw new Error('Missing required PostgreSQL environment variables: PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD');
  }

  const config = {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: { rejectUnauthorized: false }, // Necessario per Supabase
    connectionTimeoutMillis: 10000,
  };
  
  // Log delle credenziali (senza password) per debug
  console.log('🔌 Database config:', {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    hasPassword: !!config.password,
    passwordLength: config.password?.length || 0
  });
  
  return new Client(config);
};

// Utility per query sicure - crea e chiude connessione per ogni query
export const query = async (text: string, params?: any[]) => {
  const client = getClient();

  // Se è un client SQLite (ha metodo query ma non connect)
  if (client.query && !client.connect) {
    try {
      // Converti placeholder PostgreSQL ($1, $2) in placeholder SQLite (?)
      // better-sqlite3 usa placeholder posizionali semplici ?
      let sqliteQuery = text;
      
      // Estrai tutti i placeholder numerati dalla query originale
      const allMatches = Array.from(text.matchAll(/\$(\d+)/g));
      
      // Se la query ha placeholder PostgreSQL ($1, $2, ...), convertili
      if (allMatches.length > 0) {
        // Sostituisci tutti i placeholder con ? (ogni $1 diventa ?, ogni $2 diventa ?, etc.)
        sqliteQuery = text.replace(/\$(\d+)/g, '?');
        
        // Crea array con i parametri nell'ordine in cui appaiono i placeholder
        const orderedParams: any[] = [];
        for (const match of allMatches) {
          const num = parseInt(match[1]);
          const paramValue = params?.[num - 1];
          if (paramValue === undefined) {
            console.error(`⚠️ Parameter $${num} is undefined. Params array:`, params);
          }
          orderedParams.push(paramValue);
        }
        
        console.log(`🔍 SQLite query params: ${orderedParams.length} params for ${allMatches.length} placeholders`);
        
        // Converti funzioni PostgreSQL in SQLite
        sqliteQuery = sqliteQuery.replace(/NOW\(\)/gi, "datetime('now')");
        // Converti virgolette doppie in virgolette singole per valori stringa SQLite
        sqliteQuery = sqliteQuery.replace(/=\s*"([^"]+)"/g, "= '$1'");
        
        // Rimuovi RETURNING * per SQLite (non supportato)
        const hasReturning = /RETURNING\s+\*/i.test(sqliteQuery);
        if (hasReturning) {
          const isInsert = /^INSERT\s+INTO/i.test(sqliteQuery);
          const isUpdate = /^UPDATE/i.test(sqliteQuery);
          const isDelete = /^DELETE\s+FROM/i.test(sqliteQuery);
          
          sqliteQuery = sqliteQuery.replace(/\s+RETURNING\s+\*/i, '');
          
          const result = client.query(sqliteQuery, orderedParams);
          
          if (isInsert) {
            return { rows: [] };
          } else if (isUpdate || isDelete) {
            return { rows: [] };
          }
          
          return result;
        }
        
        return client.query(sqliteQuery, orderedParams);
      } else {
        // La query non ha placeholder PostgreSQL, usa direttamente i params come sono
        // (potrebbe essere già in formato SQLite con ? o senza placeholder)
        // Se la query ha ?, usa i params; altrimenti passa params come sono
        const questionMarkCount = (sqliteQuery.match(/\?/g) || []).length;
        
        if (questionMarkCount > 0) {
          // La query ha già placeholder ?, usa i params direttamente
          console.log(`🔍 SQLite query params: ${params?.length || 0} params for ${questionMarkCount} ? placeholders`);
          
          // Converti funzioni PostgreSQL in SQLite
          sqliteQuery = sqliteQuery.replace(/NOW\(\)/gi, "datetime('now')");
          
          // Rimuovi RETURNING * per SQLite
          const hasReturning = /RETURNING\s+\*/i.test(sqliteQuery);
          if (hasReturning) {
            const isInsert = /^INSERT\s+INTO/i.test(sqliteQuery);
            sqliteQuery = sqliteQuery.replace(/\s+RETURNING\s+\*/i, '');
            
            const result = client.query(sqliteQuery, params || []);
            
            if (isInsert) {
              return { rows: [] };
            }
            
            return result;
          }
          
          return client.query(sqliteQuery, params || []);
        } else {
          // Nessun placeholder, esegui la query senza params
          console.log(`🔍 SQLite query: no placeholders, executing without params`);
          
          // Converti funzioni PostgreSQL in SQLite
          sqliteQuery = sqliteQuery.replace(/NOW\(\)/gi, "datetime('now')");
          
          return client.query(sqliteQuery);
        }
      }
    } catch (error: any) {
      console.error('SQLite query error:', error.message);
      console.error('Query:', text.substring(0, 200));
      console.error('Converted query:', text.replace(/\$(\d+)/g, '?').substring(0, 200));
      throw error;
    }
  }

  // Se è un client PostgreSQL
  try {
    await client.connect();
    // Converti funzioni SQLite in PostgreSQL
    let postgresQuery = text;
    // Converti datetime('now') in NOW() per PostgreSQL
    postgresQuery = postgresQuery.replace(/datetime\s*\(\s*['"]now['"]\s*\)/gi, 'NOW()');
    const result = await client.query(postgresQuery, params);
    return result;
  } catch (error: any) {
    console.error('PostgreSQL query error:', error.message, 'Query:', text);
    throw error;
  } finally {
    await client.end();
  }
};
