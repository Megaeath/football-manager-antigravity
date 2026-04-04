/**
 * Script to apply Prisma migrations to Turso database.
 * Executes SQL files statement-by-statement because libSQL HTTP rejects
 * SQL strings containing multiple statements in one execute call.
 */

require('dotenv/config');

const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      current += char;
      if (char === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === '*' && next === '/') {
        current += next;
        i += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (!inSingle && !inDouble) {
      if (char === '-' && next === '-') {
        current += char + next;
        i += 1;
        inLineComment = true;
        continue;
      }

      if (char === '/' && next === '*') {
        current += char + next;
        i += 1;
        inBlockComment = true;
        continue;
      }
    }

    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      current += char;
      continue;
    }

    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      current += char;
      continue;
    }

    if (char === ';' && !inSingle && !inDouble) {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = '';
      continue;
    }

    current += char;
  }

  const last = current.trim();
  if (last) statements.push(last);
  return statements;
}

function isIgnorableMigrationError(message) {
  return [
    'already exists',
    'duplicate column name',
    'duplicate index name',
    'index already exists',
    'no such index',
    'no such column:',
  ].some((token) => message.toLowerCase().includes(token));
}

async function migrateToTurso() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl || !tursoAuthToken) {
    console.error('Error: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set');
    process.exit(1);
  }

  console.log('Connecting to Turso database...');
  const client = createClient({
    url: tursoUrl,
    authToken: tursoAuthToken,
  });

  const migrationsDir = path.join(__dirname, '../prisma/migrations');
  
  // Get all migration directories sorted by name
  const migrationDirs = fs.readdirSync(migrationsDir)
    .filter(dir => dir.match(/^\d{14}_/))
    .sort();

  console.log(`Found ${migrationDirs.length} migrations to apply`);

  for (const dir of migrationDirs) {
    const migrationFile = path.join(migrationsDir, dir, 'migration.sql');
    
    if (!fs.existsSync(migrationFile)) {
      console.warn(`Skipping ${dir}: migration.sql not found`);
      continue;
    }

    const sql = fs.readFileSync(migrationFile, 'utf-8');
    const statements = splitSqlStatements(sql);
    console.log(`\nApplying migration: ${dir}`);

    try {
      for (const statement of statements) {
        try {
          await client.execute(statement);
        } catch (statementError) {
          const msg = String(statementError?.message || statementError);
          if (isIgnorableMigrationError(msg)) {
            console.log(`  ⚠ Skipped statement in ${dir}: ${msg}`);
            continue;
          }
          throw statementError;
        }
      }

      console.log(`  ✓ Applied ${dir} (${statements.length} statements)`);
    } catch (error) {
      if (isIgnorableMigrationError(String(error.message || error))) {
        console.log(`  ⚠ Skipped ${dir} (already applied)`);
      } else {
        console.error(`  ✗ Failed to apply ${dir}:`, error.message);
      }
    }
  }

  console.log('\n=== Migration Complete ===');
  
  // Verify by counting tables
  const result = await client.execute(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    AND name NOT LIKE 'sqlite_%'
    AND name NOT LIKE 'new_%'
    ORDER BY name
  `);
  
  console.log(`\nTables in Turso: ${result.rows.length}`);
  result.rows.forEach(row => {
    console.log(`  - ${row.name}`);
  });

  await client.close();
}

migrateToTurso().catch(console.error);
