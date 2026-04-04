import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN;

console.log('env-check', {
  hasUrl: Boolean(url),
  hasToken: Boolean(authToken),
  useTurso: process.env.PRISMA_USE_TURSO,
});

const adapter = new PrismaLibSql({ url, authToken });
const prisma = new PrismaClient({ adapter });

try {
  const settings = await prisma.globalGameSettings.findFirst();
  console.log('query-ok', Boolean(settings));
} catch (error) {
  console.error('query-failed', error?.message || error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
