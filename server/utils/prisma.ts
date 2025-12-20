import { PrismaClient } from "../../generated/prisma/client";

// Singleton Prisma Client per evitare multiple connessioni
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prepara DATABASE_URL per Prisma con prepared statements disabilitati se usa pooler
const getDatabaseUrl = () => {
  const dbUrl = process.env.DATABASE_URL || '';
  // Se usa connection pooler (porta 6543), aggiungi parametro per disabilitare prepared statements
  if (dbUrl.includes(':6543/')) {
    // Usa direct connection invece del pooler per Prisma
    return dbUrl.replace(':6543/', ':5432/');
  }
  return dbUrl;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
