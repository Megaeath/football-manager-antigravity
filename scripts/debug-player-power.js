const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const pid = 'cmmm3ss7cbxszoh3g16yet1ro';

(async () => {
  const p = await prisma.player.findUnique({ where: { id: pid }, include: { team: true } });
  if (!p) return console.log('not found');

  const attrs = {
    tackling: p.tackling,
    passing: p.passing,
    shooting: p.shooting,
    heading: p.heading,
    dribbling: p.dribbling,
    aggression: p.aggression,
    positioning: p.positioning,
    vision: p.vision,
    bravery: p.bravery,
    leadership: p.leadership,
    teamwork: p.teamwork,
    composure: p.composure,
    pace: p.pace,
    acceleration: p.acceleration,
    stamina: p.stamina,
    strength: p.strength,
    agility: p.agility,
    balance: p.balance,
    crossing: p.crossing,
    handling: p.handling,
    setPieces: p.setPieces,
    throw: p.throw,
  };

  console.log('Player:', p.name, '| nat:', p.naturalPosition, '| team:', p.team?.name);
  console.log('condition:', p.condition, 'exp:', p.exp);
  console.table(attrs);
})();
