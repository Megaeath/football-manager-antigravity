import 'dotenv/config';

const useTurso = process.env.PRISMA_USE_TURSO === 'true';
const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
const datasourceUrl = process.env.DATABASE_URL || 'file:./dev.db';

if (useTurso) {
  if (!tursoUrl || tursoUrl === 'undefined') {
    console.log('DB mode: TURSO requested but TURSO_DATABASE_URL is missing/invalid');
    process.exit(1);
  }

  const host = new URL(tursoUrl).host;
  console.log(`DB mode: TURSO (${host})`);
  process.exit(0);
}

console.log(`DB mode: LOCAL (${datasourceUrl})`);
