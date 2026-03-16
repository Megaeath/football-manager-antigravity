import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { TRAINING_FACILITY_LEVELS, TRAINING_SLOT_COUNT } from '@/lib/constants/training';
import { processWeeklyTraining } from './training';

// ─── Attribute priority by natural position ──────────────────────────────────
// Each position lists attributes in order of importance.
// initAITeamTraining picks the first attribute not yet at cap 20.
const AI_ATTRIBUTE_PRIORITY: Record<string, string[]> = {
  GK:  ['handling', 'positioning', 'bravery', 'composure', 'agility'],
  DC:  ['tackling', 'heading', 'strength', 'positioning', 'composure'],
  DR:  ['tackling', 'pace', 'crossing', 'stamina', 'agility'],
  DL:  ['tackling', 'pace', 'crossing', 'stamina', 'agility'],
  DMC: ['tackling', 'passing', 'positioning', 'stamina', 'vision'],
  MC:  ['passing', 'vision', 'stamina', 'positioning', 'composure'],
  AMC: ['dribbling', 'vision', 'passing', 'shooting', 'composure'],
  MR:  ['pace', 'crossing', 'dribbling', 'stamina', 'agility'],
  ML:  ['pace', 'crossing', 'dribbling', 'stamina', 'agility'],
  FWC: ['shooting', 'pace', 'composure', 'heading', 'dribbling'],
};

const FALLBACK_PRIORITY = ['passing', 'stamina', 'positioning', 'vision', 'composure'];

type TrainingCandidate = { playerId: string; attribute: string; currentValue: number };

// ─── Internal: ensure slot rows exist for a team ─────────────────────────────
async function ensureAITeamSlots(teamId: string): Promise<void> {
  const existing = await prisma.trainingAssignment.findMany({ where: { teamId } });
  const existingIndexes = new Set(existing.map((s) => s.slotIndex));
  const toCreate: {
    teamId: string; slotIndex: number; playerId: null;
    focusAttribute: null; isActive: boolean; lastGain: number;
  }[] = [];
  for (let i = 1; i <= TRAINING_SLOT_COUNT; i++) {
    if (!existingIndexes.has(i)) {
      toCreate.push({ teamId, slotIndex: i, playerId: null, focusAttribute: null, isActive: false, lastGain: 0 });
    }
  }
  if (toCreate.length > 0) {
    try {
      await prisma.trainingAssignment.createMany({ data: toCreate });
    } catch (e: unknown) {
      // Ignore unique constraint errors – concurrent request already created the slots
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) {
        throw e;
      }
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Auto-assign 5 training slots for an AI team using position/attribute priority.
 * Refreshes every week so transfers and capped players are handled automatically.
 * Rule: one player per slot, prefer attributes with most room to grow (lowest value).
 */
export async function initAITeamTraining(teamId: string): Promise<void> {
  const players = await prisma.player.findMany({
    where: { teamId, isRetired: false },
    select: {
      id: true,
      naturalPosition: true,
      handling: true, tackling: true, passing: true, shooting: true,
      heading: true, dribbling: true, crossing: true, setPieces: true,
      throw: true, aggression: true, positioning: true, vision: true,
      bravery: true, leadership: true, teamwork: true, composure: true,
      pace: true, acceleration: true, stamina: true, strength: true,
      agility: true, balance: true,
    },
  });

  // For each player find the first priority attribute not yet at cap 20
  const candidates: TrainingCandidate[] = [];
  for (const player of players) {
    const priority = AI_ATTRIBUTE_PRIORITY[player.naturalPosition] ?? FALLBACK_PRIORITY;
    for (const attr of priority) {
      const val = (player as Record<string, unknown>)[attr] as number;
      if (val < 20) {
        candidates.push({ playerId: player.id, attribute: attr, currentValue: val });
        break;
      }
    }
  }

  // Sort ascending by currentValue — players with most room to grow fill slots first
  candidates.sort((a, b) => a.currentValue - b.currentValue);

  // Pick up to TRAINING_SLOT_COUNT unique players
  const usedPlayerIds = new Set<string>();
  const slots: TrainingCandidate[] = [];
  for (const c of candidates) {
    if (usedPlayerIds.has(c.playerId)) continue;
    usedPlayerIds.add(c.playerId);
    slots.push(c);
    if (slots.length >= TRAINING_SLOT_COUNT) break;
  }

  await ensureAITeamSlots(teamId);

  for (let i = 0; i < TRAINING_SLOT_COUNT; i++) {
    const slot = slots[i];
    await prisma.trainingAssignment.update({
      where: { teamId_slotIndex: { teamId, slotIndex: i + 1 } },
      data: {
        playerId: slot?.playerId ?? null,
        focusAttribute: slot?.attribute ?? null,
        isActive: slot != null,
        lastGain: 0,
      },
    });
  }
}

/**
 * Process weekly training for all AI teams in parallel.
 * Calls initAITeamTraining first to refresh slot assignments, then processWeeklyTraining.
 * processWeeklyTraining already handles: idempotency (TrainingWeeklyLedger) +
 * SKIPPED_FUNDS guard + decimal accumulation — no extra logic needed here.
 */
export async function processAllAITeamsWeeklyTraining(
  weekKey: number,
  userTeamId: string | null,
): Promise<void> {
  const aiTeams = await prisma.team.findMany({
    where: userTeamId ? { id: { not: userTeamId } } : {},
    select: { id: true },
  });

  // SQLite has coarse file-level write locks. Running all AI teams in parallel can
  // cause lock contention and socket timeouts (P1008), especially when each team
  // performs multiple writes in init + weekly processing.
  for (const team of aiTeams) {
    try {
      await initAITeamTraining(team.id);
      await processWeeklyTraining(team.id, weekKey);
    } catch (err) {
      console.error(`[AI Training] Weekly training failed for team ${team.id}:`, err);
    }
  }
}

/**
 * Upgrade AI team training facilities once per season end (max 1 level per team).
 * Criteria: reputation >= (currentLevel * 10 + 10) AND balance >= nextLevel.upgradeCost.
 * This mirrors upgradeTrainingFacility() in training.ts but runs automatically for AI.
 */
export async function upgradeAITeamFacilities(userTeamId: string | null): Promise<void> {
  const aiTeams = await prisma.team.findMany({
    where: userTeamId ? { id: { not: userTeamId } } : {},
    select: { id: true, balance: true, reputation: true, trainingFacilityLevel: true },
  });

  for (const team of aiTeams) {
    const currentLevel = team.trainingFacilityLevel;
    if (currentLevel >= 9) continue;

    const nextLevelConfig = TRAINING_FACILITY_LEVELS.find((l) => l.level === currentLevel + 1);
    if (!nextLevelConfig) continue;

    // Reputation gate: a team needs at least reputation = currentLevel*10+10 to qualify
    const reputationThreshold = currentLevel * 10 + 10;
    if (team.reputation < reputationThreshold) continue;
    if (team.balance < nextLevelConfig.upgradeCost) continue;

    try {
      await prisma.$transaction([
        prisma.team.update({
          where: { id: team.id },
          data: {
            trainingFacilityLevel: currentLevel + 1,
            balance: { decrement: nextLevelConfig.upgradeCost },
          },
        }),
        prisma.financialEvent.create({
          data: {
            teamId: team.id,
            type: 'TRAINING_UPGRADE',
            amount: -nextLevelConfig.upgradeCost,
            description: `Training facility upgraded to Lv.${currentLevel + 1} (AI auto-upgrade)`,
          },
        }),
      ]);
      console.log(
        `[AI Training] Team ${team.id} upgraded facility Lv.${currentLevel} → Lv.${currentLevel + 1}`,
      );
    } catch (err) {
      console.error(`[AI Training] Facility upgrade failed for team ${team.id}:`, err);
    }
  }
}
