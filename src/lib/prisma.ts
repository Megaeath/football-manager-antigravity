import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const prismaClientSingleton = () => {
  const useTurso = process.env.PRISMA_USE_TURSO === 'true';
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const datasourceUrl = process.env.DATABASE_URL || 'file:./dev.db';

  // Ensure Prisma always has a datasource URL at runtime.
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = datasourceUrl;
  }

  const logConfig = process.env.NODE_ENV === 'production' 
    ? [] 
    : [
        // { emit: 'stdout', level: 'query' },
        // { emit: 'stdout', level: 'warn' },
      ];

  if (useTurso) {
    if (!tursoUrl || tursoUrl === 'undefined') {
      throw new Error('PRISMA_USE_TURSO=true but TURSO_DATABASE_URL is missing/invalid');
    }

    if (!process.env.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN === 'undefined') {
      throw new Error('PRISMA_USE_TURSO=true but TURSO_AUTH_TOKEN is missing/invalid');
    }

    const adapter = new PrismaLibSql({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    if (process.env.NODE_ENV !== 'production') {
      const host = new URL(tursoUrl).host;
      console.log(`[Prisma] Turso mode enabled -> ${host}`);
    }

    return new PrismaClient({ adapter, log: logConfig });
  }

  // Fallback to Prisma datasource URL (e.g. sqlite via DATABASE_URL)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Prisma] Local mode enabled -> ${datasourceUrl}`);
  }

  return new PrismaClient({ datasourceUrl, log: logConfig });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;
