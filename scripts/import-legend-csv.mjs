import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_DIR = path.join(__dirname, '..', 'reports', 'legend-csv');
const HEADER_LINE = 'teamId,teamName,playerName,position,age,power';

function parseCsvLine(line) {
  // Current legend CSV format does not use quoted commas.
  const parts = line.split(',').map((v) => v.trim());
  if (parts.length < 6) {
    return null;
  }

  const [teamId, teamName, playerName, position, ageRaw, powerRaw] = parts;
  const age = Number(ageRaw);
  const power = Number(powerRaw);

  if (!teamId || !teamName || !playerName || !position || Number.isNaN(age) || Number.isNaN(power)) {
    return null;
  }

  return { teamId, teamName, playerName, position, age, power };
}

function getDivisionFromFilename(fileName) {
  const match = /^D(\d+)-/.exec(fileName);
  return match ? Number(match[1]) : 0;
}

async function main() {
  const files = fs
    .readdirSync(CSV_DIR)
    .filter((file) => file.endsWith('.csv'))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    throw new Error(`No CSV files found in ${CSV_DIR}`);
  }

  console.log(`Found ${files.length} legend CSV files.`);

  // Keep this idempotent for repeated imports.
  await prisma.legendPlayer.deleteMany();

  const teamCache = new Map();
  let imported = 0;
  let skipped = 0;

  for (const fileName of files) {
    const fullPath = path.join(CSV_DIR, fileName);
    const division = getDivisionFromFilename(fileName);
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length <= 1) {
      console.warn(`Skipping empty file: ${fileName}`);
      continue;
    }

    const dataLines = lines.slice(1).filter((line) => line !== HEADER_LINE);
    let importedPerFile = 0;

    for (const line of dataLines) {
      const row = parseCsvLine(line);
      if (!row) {
        skipped += 1;
        console.warn(`Invalid row skipped in ${fileName}: ${line}`);
        continue;
      }

      if (!teamCache.has(row.teamId)) {
        const team = await prisma.team.findUnique({
          where: { id: row.teamId },
          select: { id: true, name: true },
        });
        teamCache.set(row.teamId, team || null);
      }

      const team = teamCache.get(row.teamId);
      if (!team) {
        skipped += 1;
        console.warn(`Team not found for row in ${fileName}: ${row.teamId} (${row.teamName})`);
        continue;
      }

      if (team.name !== row.teamName) {
        console.warn(
          `Team name mismatch for ${row.teamId}: CSV="${row.teamName}" DB="${team.name}" (file: ${fileName})`
        );
      }

      await prisma.legendPlayer.upsert({
        where: {
          teamId_playerName_position: {
            teamId: row.teamId,
            playerName: row.playerName,
            position: row.position,
          },
        },
        update: {
          teamName: row.teamName,
          age: row.age,
          power: row.power,
          division,
          sourceFile: fileName,
        },
        create: {
          teamId: row.teamId,
          teamName: row.teamName,
          playerName: row.playerName,
          position: row.position,
          age: row.age,
          power: row.power,
          division,
          sourceFile: fileName,
        },
      });

      imported += 1;
      importedPerFile += 1;
    }

    console.log(`✓ Imported ${importedPerFile} rows from ${fileName}`);
  }

  const totalRows = await prisma.legendPlayer.count();
  const totalTeams = await prisma.legendPlayer.groupBy({
    by: ['teamId'],
    _count: { teamId: true },
  });

  console.log('--- Legend import completed ---');
  console.log(`Rows processed: ${imported + skipped}`);
  console.log(`Rows imported/updated: ${imported}`);
  console.log(`Rows skipped: ${skipped}`);
  console.log(`Rows currently in legend table: ${totalRows}`);
  console.log(`Teams currently in legend table: ${totalTeams.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
