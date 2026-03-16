import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  getFacilityByLevel,
  TRAINABLE_ATTRIBUTES,
  TRAINABLE_ATTRIBUTE_LABELS,
  TRAINING_MAX_LEVEL,
  TRAINING_SLOT_COUNT,
  type TrainableAttribute
} from '@/lib/constants/training';

const round2 = (v: number) => Math.round(v * 100) / 100;
const weekKeyFromDate = (date: Date) => Math.floor(date.getTime() / (1000 * 60 * 60 * 24 * 7));

// Use the real Prisma client directly — models are available after `prisma generate`
const db = prisma;

type PlayerTrainingAttributeSnapshot = {
  handling: number;
  tackling: number;
  passing: number;
  shooting: number;
  heading: number;
  dribbling: number;
  crossing: number;
  setPieces: number;
  throw: number;
  aggression: number;
  positioning: number;
  vision: number;
  bravery: number;
  leadership: number;
  teamwork: number;
  composure: number;
  pace: number;
  acceleration: number;
  stamina: number;
  strength: number;
  agility: number;
  balance: number;
};

function getAttributeValue(player: PlayerTrainingAttributeSnapshot, attr: TrainableAttribute): number {
  switch (attr) {
    case 'handling': return player.handling;
    case 'tackling': return player.tackling;
    case 'passing': return player.passing;
    case 'shooting': return player.shooting;
    case 'heading': return player.heading;
    case 'dribbling': return player.dribbling;
    case 'crossing': return player.crossing;
    case 'setPieces': return player.setPieces;
    case 'throw': return player.throw;
    case 'aggression': return player.aggression;
    case 'positioning': return player.positioning;
    case 'vision': return player.vision;
    case 'bravery': return player.bravery;
    case 'leadership': return player.leadership;
    case 'teamwork': return player.teamwork;
    case 'composure': return player.composure;
    case 'pace': return player.pace;
    case 'acceleration': return player.acceleration;
    case 'stamina': return player.stamina;
    case 'strength': return player.strength;
    case 'agility': return player.agility;
    case 'balance': return player.balance;
  }
}

function buildAttributeUpdateData(attr: TrainableAttribute, value: number): Prisma.PlayerUpdateInput {
  switch (attr) {
    case 'handling': return { handling: value };
    case 'tackling': return { tackling: value };
    case 'passing': return { passing: value };
    case 'shooting': return { shooting: value };
    case 'heading': return { heading: value };
    case 'dribbling': return { dribbling: value };
    case 'crossing': return { crossing: value };
    case 'setPieces': return { setPieces: value };
    case 'throw': return { throw: value };
    case 'aggression': return { aggression: value };
    case 'positioning': return { positioning: value };
    case 'vision': return { vision: value };
    case 'bravery': return { bravery: value };
    case 'leadership': return { leadership: value };
    case 'teamwork': return { teamwork: value };
    case 'composure': return { composure: value };
    case 'pace': return { pace: value };
    case 'acceleration': return { acceleration: value };
    case 'stamina': return { stamina: value };
    case 'strength': return { strength: value };
    case 'agility': return { agility: value };
    case 'balance': return { balance: value };
  }
}

function isTrainableAttribute(value: string | null | undefined): value is TrainableAttribute {
  return !!value && TRAINABLE_ATTRIBUTES.includes(value as TrainableAttribute);
}

async function getUserTeamId(): Promise<string | null> {
  const settings = await prisma.globalGameSettings.findUnique({
    where: { id: 1 },
    select: { userTeamId: true }
  });
  return settings?.userTeamId || null;
}

async function ensureTeamSlots(teamId: string) {
  const existing = await db.trainingAssignment.findMany({ where: { teamId } });
  const existingIndexes = new Set<number>(existing.map((s) => s.slotIndex));

  const toCreate: Array<{
    teamId: string;
    slotIndex: number;
    playerId: null;
    focusAttribute: null;
    isActive: boolean;
    lastGain: number;
  }> = [];
  for (let i = 1; i <= TRAINING_SLOT_COUNT; i++) {
    if (!existingIndexes.has(i)) {
      toCreate.push({
        teamId,
        slotIndex: i,
        playerId: null,
        focusAttribute: null,
        isActive: false,
        lastGain: 0
      });
    }
  }

  if (toCreate.length > 0) {
    try {
      await db.trainingAssignment.createMany({ data: toCreate });
    } catch (e: unknown) {
      // Ignore unique constraint errors — another concurrent request already created the slots
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) {
        throw e;
      }
    }
  }
}

function pickRandomGain(maxGain: number): number {
  const raw = 0.1 + Math.random() * Math.max(0, maxGain - 0.1);
  return round2(raw);
}

export async function getTrainingState(teamId?: string | null) {
  const resolvedTeamId = teamId || await getUserTeamId();
  if (!resolvedTeamId) {
    throw new Error('User team not configured');
  }

  await ensureTeamSlots(resolvedTeamId);

  const team = await db.team.findUnique({
    where: { id: resolvedTeamId },
    select: { id: true, name: true, balance: true, trainingFacilityLevel: true }
  });

  if (!team) throw new Error('Team not found');

  const players = await db.player.findMany({
    where: { teamId: resolvedTeamId, isRetired: false },
    orderBy: [{ tacticalPosition: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      naturalPosition: true,
      tacticalPosition: true,
      age: true,
      condition: true,
      exp: true,
      handling: true,
      tackling: true,
      passing: true,
      shooting: true,
      heading: true,
      dribbling: true,
      crossing: true,
      setPieces: true,
      throw: true,
      aggression: true,
      positioning: true,
      vision: true,
      bravery: true,
      leadership: true,
      teamwork: true,
      composure: true,
      pace: true,
      acceleration: true,
      stamina: true,
      strength: true,
      agility: true,
      balance: true
    }
  });

  const slotsRaw = await db.trainingAssignment.findMany({
    where: { teamId: resolvedTeamId },
    include: { player: { select: { id: true, name: true, naturalPosition: true, tacticalPosition: true } } },
    orderBy: { slotIndex: 'asc' }
  });

  // Auto-clear slots where assigned player has left the team (transferred/released)
  const teamPlayerIds = new Set(players.map((p) => p.id));
  const staleSlots = slotsRaw.filter((s) => s.playerId && !teamPlayerIds.has(s.playerId));
  if (staleSlots.length > 0) {
    await db.trainingAssignment.updateMany({
      where: { id: { in: staleSlots.map((s) => s.id) } },
      data: { playerId: null, focusAttribute: null, isActive: false, lastGain: 0 }
    });
    // Reflect cleared state in slotsRaw
    staleSlots.forEach((s) => {
      s.playerId = null;
      s.focusAttribute = null;
      s.isActive = false;
      s.lastGain = 0;
      s.player = null;
    });
  }

  const fractions = await db.playerTrainingFraction.findMany({
    where: { playerId: { in: players.map((p) => p.id) } }
  });

  const fractionMap = new Map<string, Map<string, number>>();
  for (const f of fractions) {
    if (!fractionMap.has(f.playerId)) fractionMap.set(f.playerId, new Map<string, number>());
    fractionMap.get(f.playerId)!.set(f.attribute, Number(f.remainder || 0));
  }

  const facility = getFacilityByLevel(team.trainingFacilityLevel || 1);
  const nextFacility = team.trainingFacilityLevel < TRAINING_MAX_LEVEL
    ? getFacilityByLevel((team.trainingFacilityLevel || 1) + 1)
    : null;

  const currentWeekKey = weekKeyFromDate(new Date());
  const lastLedger = await db.trainingWeeklyLedger.findFirst({
    where: { teamId: resolvedTeamId },
    orderBy: { processedAt: 'desc' }
  });

  const playerRows = players.map((p) => {
    const byAttr = fractionMap.get(p.id) || new Map<string, number>();
    const effectiveAttributes: Record<string, number> = {};

    for (const attr of TRAINABLE_ATTRIBUTES) {
      const base = Number(getAttributeValue(p, attr) || 0);
      const remainder = Number(byAttr.get(attr) || 0);
      effectiveAttributes[attr] = round2(Math.min(20, base + remainder));
    }

    return {
      ...p,
      effectiveAttributes
    };
  });

  return {
    team: {
      id: team.id,
      name: team.name,
      balance: team.balance,
      trainingFacilityLevel: team.trainingFacilityLevel,
      facility,
      nextFacility,
      canAffordNextWeek: team.balance >= facility.weeklyFee
    },
    slots: slotsRaw.map((s) => ({
      id: s.id,
      slotIndex: s.slotIndex,
      playerId: s.playerId,
      focusAttribute: s.focusAttribute,
      isActive: s.isActive,
      lastGain: Number(s.lastGain || 0),
      player: s.player || null
    })),
    players: playerRows,
    trainableAttributes: TRAINABLE_ATTRIBUTES,
    trainableAttributeLabels: TRAINABLE_ATTRIBUTE_LABELS,
    weekly: {
      currentWeekKey,
      lastStatus: lastLedger?.status || null,
      lastChargedFee: lastLedger?.chargedFee || 0,
      lastProcessedAt: lastLedger?.processedAt || null
    }
  };
}

export async function updateTrainingSlot(input: {
  teamId: string;
  slotIndex: number;
  playerId: string | null;
  focusAttribute: string | null;
}) {
  const { teamId, slotIndex, playerId, focusAttribute } = input;

  if (slotIndex < 1 || slotIndex > TRAINING_SLOT_COUNT) {
    throw new Error(`slotIndex must be between 1 and ${TRAINING_SLOT_COUNT}`);
  }

  if (focusAttribute && !isTrainableAttribute(focusAttribute)) {
    throw new Error('Invalid focusAttribute');
  }

  await ensureTeamSlots(teamId);

  if (playerId) {
    const player = await db.player.findUnique({ where: { id: playerId }, select: { id: true, teamId: true, isRetired: true } });
    if (!player || player.teamId !== teamId || player.isRetired) {
      throw new Error('Selected player is not valid for this team');
    }

    // one player max one slot
    const duplicate = await db.trainingAssignment.findFirst({
      where: { teamId, playerId, slotIndex: { not: slotIndex } },
      select: { id: true, slotIndex: true }
    });

    if (duplicate) {
      throw new Error(`Player is already assigned to slot ${duplicate.slotIndex}`);
    }
  }

  const isActive = !!playerId && !!focusAttribute;

  const updated = await db.trainingAssignment.update({
    where: { teamId_slotIndex: { teamId, slotIndex } },
    data: {
      playerId: playerId || null,
      focusAttribute: focusAttribute || null,
      isActive,
      lastGain: 0
    }
  });

  return updated;
}

export async function upgradeTrainingFacility(teamId: string) {
  const team = await db.team.findUnique({
    where: { id: teamId },
    select: { id: true, balance: true, trainingFacilityLevel: true }
  });

  if (!team) throw new Error('Team not found');

  const currentLevel = Number(team.trainingFacilityLevel || 1);
  if (currentLevel >= TRAINING_MAX_LEVEL) {
    throw new Error('Facility is already max level');
  }

  const next = getFacilityByLevel(currentLevel + 1);
  if (team.balance < next.upgradeCost) {
    throw new Error('Insufficient funds for upgrade');
  }

  await db.$transaction(async (tx) => {
    await tx.team.update({
      where: { id: teamId },
      data: {
        balance: { decrement: next.upgradeCost },
        trainingFacilityLevel: currentLevel + 1
      }
    });

    await tx.financialEvent.create({
      data: {
        teamId,
        type: 'TRAINING_UPGRADE',
        amount: -next.upgradeCost,
        description: `Training facility upgraded to level ${currentLevel + 1}`
      }
    });
  });

  return { level: currentLevel + 1, upgradeCost: next.upgradeCost };
}

export async function processWeeklyTraining(teamId: string, weekKey: number) {
  await ensureTeamSlots(teamId);

  const existingLedger = await db.trainingWeeklyLedger.findUnique({
    where: { teamId_weekKey: { teamId, weekKey } }
  });
  if (existingLedger) {
    return { skipped: true, reason: 'already-processed' };
  }

  const team = await db.team.findUnique({
    where: { id: teamId },
    select: { id: true, balance: true, trainingFacilityLevel: true }
  });
  if (!team) return { skipped: true, reason: 'team-not-found' };

  const facility = getFacilityByLevel(team.trainingFacilityLevel || 1);
  const slots = await db.trainingAssignment.findMany({
    where: { teamId, isActive: true, playerId: { not: null }, focusAttribute: { not: null } },
    orderBy: { slotIndex: 'asc' }
  });

  // Preload snapshots outside the transaction to minimize time spent under
  // SQLite write lock and avoid interactive transaction timeout.
  const activePlayerIds = Array.from(
    new Set(slots.map((s) => s.playerId).filter((id): id is string => !!id))
  );

  const players = activePlayerIds.length > 0
    ? await db.player.findMany({
        where: { id: { in: activePlayerIds } },
        select: {
          id: true,
          handling: true,
          tackling: true,
          passing: true,
          shooting: true,
          heading: true,
          dribbling: true,
          crossing: true,
          setPieces: true,
          throw: true,
          aggression: true,
          positioning: true,
          vision: true,
          bravery: true,
          leadership: true,
          teamwork: true,
          composure: true,
          pace: true,
          acceleration: true,
          stamina: true,
          strength: true,
          agility: true,
          balance: true
        }
      })
    : [];

  const playerById = new Map(players.map((p) => [p.id, p]));

  const fractions = activePlayerIds.length > 0
    ? await db.playerTrainingFraction.findMany({
        where: { playerId: { in: activePlayerIds } }
      })
    : [];

  const fractionByPlayerAndAttr = new Map(
    fractions.map((f) => [`${f.playerId}:${f.attribute}`, f])
  );

  // Option A: insufficient funds => skip all gain this week
  if (team.balance < facility.weeklyFee) {
    await db.$transaction(async (tx) => {
      await tx.trainingAssignment.updateMany({ where: { teamId }, data: { lastGain: 0 } });
      await tx.trainingWeeklyLedger.create({
        data: {
          teamId,
          weekKey,
          status: 'SKIPPED_FUNDS',
          chargedFee: 0
        }
      });
    });
    return { skipped: true, reason: 'insufficient-funds' };
  }

  await db.$transaction(async (tx) => {
    await tx.team.update({
      where: { id: teamId },
      data: { balance: { decrement: facility.weeklyFee } }
    });

    await tx.financialEvent.create({
      data: {
        teamId,
        type: 'TRAINING_WEEKLY',
        amount: -facility.weeklyFee,
        description: `Weekly training fee (facility level ${team.trainingFacilityLevel || 1})`
      }
    });

    for (const slot of slots) {
      const playerId = slot.playerId as string;
      const focusAttribute = slot.focusAttribute as string;
      if (!isTrainableAttribute(focusAttribute)) continue;

      const player = playerById.get(playerId);
      if (!player) continue;

      const gain = pickRandomGain(facility.maxGain);

      const fractionKey = `${playerId}:${focusAttribute}`;
      const fraction = fractionByPlayerAndAttr.get(fractionKey);

      const currentBase = Number(getAttributeValue(player as PlayerTrainingAttributeSnapshot, focusAttribute) || 0);
      const remainder = Number(fraction?.remainder || 0);
      const total = remainder + gain;
      const intGain = Math.floor(total);
      let nextRemainder = round2(total - intGain);

      let appliedIntGain = intGain;
      let nextBase = currentBase + appliedIntGain;
      if (nextBase >= 20) {
        nextBase = 20;
        appliedIntGain = Math.max(0, 20 - currentBase);
        // discard remainder when capped
        nextRemainder = 0;
      }

      if (appliedIntGain > 0) {
        await tx.player.update({
          where: { id: playerId },
          data: buildAttributeUpdateData(focusAttribute, nextBase)
        });
      }

      await tx.playerTrainingFraction.upsert({
        where: { playerId_attribute: { playerId, attribute: focusAttribute } },
        create: {
          playerId,
          attribute: focusAttribute,
          remainder: nextRemainder,
          lifetimeGain: round2(gain)
        },
        update: {
          remainder: nextRemainder,
          lifetimeGain: round2(Number(fraction?.lifetimeGain || 0) + gain)
        }
      });

      // Keep in-memory snapshot in sync for same player/attribute seen again
      // in this run (defensive correctness; duplicates are normally prevented).
      fractionByPlayerAndAttr.set(fractionKey, {
        id: fraction?.id ?? `tmp:${fractionKey}`,
        playerId,
        attribute: focusAttribute,
        remainder: nextRemainder,
        lifetimeGain: round2(Number(fraction?.lifetimeGain || 0) + gain),
      });

      await tx.trainingAssignment.update({
        where: { id: slot.id },
        data: { lastGain: gain }
      });
    }

    // reset inactive slots display gain
    await tx.trainingAssignment.updateMany({
      where: {
        teamId,
        OR: [
          { isActive: false },
          { playerId: null },
          { focusAttribute: null }
        ]
      },
      data: { lastGain: 0 }
    });

    await tx.trainingWeeklyLedger.create({
      data: {
        teamId,
        weekKey,
        status: 'APPLIED',
        chargedFee: facility.weeklyFee
      }
    });
  }, { timeout: 15000 });

  return { skipped: false, reason: null };
}
