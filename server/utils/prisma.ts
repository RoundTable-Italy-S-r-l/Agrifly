import { PrismaClient } from "../../generated/prisma/client";

// Singleton Prisma Client per evitare multiple connessioni
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prepara DATABASE_URL per Prisma
const getDatabaseUrl = () => {
  const dbUrl = process.env.DATABASE_URL || '';
  // Se usa connection pooler (porta 6543), aggiungi parametro pgbouncer
  if (dbUrl.includes(':6543/')) {
    // Aggiungi ?pgbouncer=true se non presente, altrimenti aggiungi &pgbouncer=true
    if (dbUrl.includes('?')) {
      const url = dbUrl + '&pgbouncer=true';
      console.log('[Prisma] Usando pooler con pgbouncer=true');
      return url;
    } else {
      const url = dbUrl + '?pgbouncer=true';
      console.log('[Prisma] Usando pooler con pgbouncer=true');
      return url;
    }
  }
  return dbUrl;
};

// Forza ricreazione del Prisma Client se necessario
// Nota: $disconnect() è asincrono, ma qui siamo in top-level code
// Quindi disconnettiamo in modo sincrono e forziamo la ricreazione
if (globalForPrisma.prisma) {
  console.log('[Prisma] Forzo ricreazione Prisma Client...');
  // Non possiamo fare await qui, quindi semplicemente resettiamo
  globalForPrisma.prisma = undefined;
}

const dbUrl = getDatabaseUrl();
console.log('[Prisma] Database URL configurato:', dbUrl.replace(/:[^:@]*@/, ':****@'));

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
