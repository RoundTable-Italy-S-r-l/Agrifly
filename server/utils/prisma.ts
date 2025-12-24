import { PrismaClient } from "@prisma/client";

// Per serverless environments (Netlify Functions), crea una nuova istanza per ogni richiesta
// Questo evita problemi di connessione e memory leaks
export const createPrismaClient = () => {
  const dbUrl = process.env.DATABASE_URL || '';

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });
};

// Export principale per compatibilità
export const prisma = createPrismaClient();
