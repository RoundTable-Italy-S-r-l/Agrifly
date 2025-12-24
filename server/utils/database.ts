import { Client } from 'pg';

// Funzione per creare una nuova connessione per ogni richiesta (serverless-friendly)
export const getClient = () => {
  const config = {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT ?? "6543"),
    database: process.env.PGDATABASE ?? "postgres",
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

  try {
    await client.connect();
    const result = await client.query(text, params);
    return result;
  } catch (error: any) {
    console.error('Database query error:', error.message, 'Query:', text);
    throw error;
  } finally {
    await client.end();
  }
};
