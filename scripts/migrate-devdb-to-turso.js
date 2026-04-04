/**
 * Clone local SQLite (schema + data) from prisma/dev.db to Turso.
 *
 * Usage:
 *   node scripts/migrate-devdb-to-turso.js
 *
 * Required env vars:
 *   TURSO_DATABASE_URL
 *   TURSO_AUTH_TOKEN
 *
 * Optional env vars:
 *   SOURCE_SQLITE_PATH (default: prisma/dev.db)
 */

let createClient;
let path;

async function loadDeps() {
  await import('dotenv/config');
  const pathModule = await import('path');
  const libsqlModule = await import('@libsql/client');

  path = pathModule.default ?? pathModule;
  createClient = libsqlModule.createClient;
}

function q(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function normalizeValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return Number(value);
  return value;
}

async function getTableNames(client) {
  const result = await client.execute(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `);

  return result.rows.map((r) => String(r.name));
}

async function getSourceSchema(client) {
  const tables = await client.execute(`
    SELECT name, sql
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
      AND name != '_prisma_migrations'
    ORDER BY name
  `);

  const indexes = await client.execute(`
    SELECT name, tbl_name, sql
    FROM sqlite_master
    WHERE type = 'index'
      AND name NOT LIKE 'sqlite_autoindex_%'
      AND sql IS NOT NULL
      AND tbl_name != '_prisma_migrations'
    ORDER BY name
  `);

  return {
    tables: tables.rows.map((r) => ({ name: String(r.name), sql: String(r.sql) })),
    indexes: indexes.rows.map((r) => ({
      name: String(r.name),
      tableName: String(r.tbl_name),
      sql: String(r.sql),
    })),
  };
}

async function getTableColumns(client, tableName) {
  const result = await client.execute(`PRAGMA table_info(${q(tableName)})`);
  return result.rows
    .sort((a, b) => Number(a.cid) - Number(b.cid))
    .map((r) => String(r.name));
}

async function getTableDependencies(client, tableName) {
  const result = await client.execute(`PRAGMA foreign_key_list(${q(tableName)})`);
  return [...new Set(result.rows.map((r) => String(r.table)))];
}

function topologicalSortTables(tableNames, dependencyMap) {
  const tableSet = new Set(tableNames);
  const visited = new Set();
  const visiting = new Set();
  const order = [];

  function visit(table) {
    if (visited.has(table)) return;
    if (visiting.has(table)) return;

    visiting.add(table);
    const deps = dependencyMap.get(table) || [];

    for (const dep of deps) {
      if (tableSet.has(dep)) {
        visit(dep);
      }
    }

    visiting.delete(table);
    visited.add(table);
    order.push(table);
  }

  for (const table of tableNames) {
    visit(table);
  }

  return order;
}

async function clearTargetSchema(targetClient) {
  const existingTables = await getTableNames(targetClient);
  for (const tableName of existingTables) {
    await targetClient.execute(`DROP TABLE IF EXISTS ${q(tableName)}`);
  }
}

async function createTargetSchema(targetClient, sourceSchema) {
  for (const table of sourceSchema.tables) {
    await targetClient.execute(table.sql);
  }

  for (const index of sourceSchema.indexes) {
    await targetClient.execute(index.sql);
  }
}

async function copyTableData(sourceClient, targetClient, tableName) {
  const columns = await getTableColumns(sourceClient, tableName);
  if (columns.length === 0) {
    return { tableName, copied: 0, skipped: true };
  }

  const selectSql = `SELECT ${columns.map(q).join(', ')} FROM ${q(tableName)}`;
  const sourceRows = await sourceClient.execute(selectSql);

  if (!sourceRows.rows.length) {
    return { tableName, copied: 0, skipped: false };
  }

  const placeholders = columns.map(() => '?').join(', ');
  const insertSql = `INSERT INTO ${q(tableName)} (${columns.map(q).join(', ')}) VALUES (${placeholders})`;

  for (const row of sourceRows.rows) {
    const args = columns.map((col) => normalizeValue(row[col]));
    await targetClient.execute({ sql: insertSql, args });
  }

  return { tableName, copied: sourceRows.rows.length, skipped: false };
}

async function migrateData() {
  await loadDeps();

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;
  const sourcePath = process.env.SOURCE_SQLITE_PATH || 'prisma/dev.db';
  const sourceDbAbsolutePath = path.resolve(process.cwd(), sourcePath);

  if (!tursoUrl || !tursoAuthToken) {
    throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in environment');
  }

  console.log(`Source DB: ${sourceDbAbsolutePath}`);
  console.log('Connecting to source SQLite and target Turso...');

  const sourceClient = createClient({
    url: `file:${sourceDbAbsolutePath}`,
  });

  const targetClient = createClient({
    url: tursoUrl,
    authToken: tursoAuthToken,
  });

  const sourceSchema = await getSourceSchema(sourceClient);
  const sourceTableNames = sourceSchema.tables.map((t) => t.name);
  const dependencyMap = new Map();
  for (const tableName of sourceTableNames) {
    dependencyMap.set(tableName, await getTableDependencies(sourceClient, tableName));
  }
  const insertOrder = topologicalSortTables(sourceTableNames, dependencyMap);

  console.log(`Found ${sourceTableNames.length} source tables`);
  console.log('Recreating Turso schema from source SQLite...');

  let totalRows = 0;

  try {
    await targetClient.execute('PRAGMA foreign_keys=OFF');

    await clearTargetSchema(targetClient);
    await createTargetSchema(targetClient, sourceSchema);

    for (const tableName of insertOrder) {
      let result;
      try {
        result = await copyTableData(sourceClient, targetClient, tableName);
      } catch (tableError) {
        throw new Error(`Failed at table ${tableName}: ${tableError.message}`);
      }
      totalRows += result.copied;

      if (result.skipped) {
        console.log(`- ${tableName}: skipped (no columns)`);
      } else {
        console.log(`- ${tableName}: ${result.copied} rows`);
      }
    }

    await targetClient.execute('PRAGMA foreign_keys=ON');

    console.log(`\n✅ Data migration complete. Total rows copied: ${totalRows}`);
  } catch (error) {
    console.error('\n❌ Data migration failed:', error.message);
    throw error;
  } finally {
    await sourceClient.close();
    await targetClient.close();
  }
}

migrateData().catch((error) => {
  console.error(error);
  process.exit(1);
});
