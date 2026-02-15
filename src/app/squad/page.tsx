import { PrismaClient } from '@prisma/client';
import { calculateSuitability } from '../../lib/engine/suitability';
import { PlayerAttributes } from '../../lib/engine/types';
import SquadClient from './SquadClient';

const prisma = new PrismaClient();

async function getRedFC() {
    const team = await prisma.team.findFirst({
        where: { name: 'Red FC' },
        include: {
            players: {
                where: { isRetired: false }
            }
        }
    });
    return team;
}

export default async function SquadPage() {
    const team = await getRedFC();

    if (!team) return <div>Team not found. Please seed the database.</div>;

    const playerswithSuitability = team.players.map(p => {
        // Map DB attributes to Engine attributes
        const attrs: PlayerAttributes = {
            handling: p.handling, tackling: p.tackling, passing: p.passing, shooting: p.shooting,
            heading: p.heading, dribbling: p.dribbling, setPieces: p.setPieces,
            aggression: p.aggression, positioning: p.positioning, vision: p.vision,
            bravery: p.bravery, leadership: p.leadership, teamwork: p.teamwork, composure: p.composure,
            pace: p.pace, acceleration: p.acceleration, stamina: p.stamina, strength: p.strength,
            agility: p.agility, balance: p.balance
        };

        const currentPosId = p.tacticalPosition ? p.tacticalPosition.split('_')[0] : null;

        return {
            id: p.id,
            name: p.name,
            naturalPosition: p.naturalPosition,
            age: p.age,
            condition: p.condition,
            morale: p.morale,
            tacticalPosition: p.tacticalPosition,
            suitability: currentPosId ? calculateSuitability(attrs, currentPosId) : 0,
            rawAttributes: attrs,
            goals: p.goals,
            assists: p.assists,
            apps: p.apps,
            avgRating: p.avgRating
        };
    });

    // Sort by Name for default (SquadClient will re-sort)
    playerswithSuitability.sort((a, b) => a.name.localeCompare(b.name));

    const currentTactics = {
        formation: team.formation,
        mentality: team.mentality,
        passing: team.passing,
        tackling: team.tackling
    };

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.75rem', margin: 0 }}>จัดการทีม (Squad Management)</h2>
                <p style={{ color: 'var(--muted)' }}>
                    ทีมปัจจุบัน: <strong>{team.name}</strong> • วางแผนการเล่นและกำหนดกลยุทธ์
                </p>
            </div>

            <SquadClient teamId={team.id} players={playerswithSuitability} currentTactics={currentTactics} />
        </div>
    );
}
