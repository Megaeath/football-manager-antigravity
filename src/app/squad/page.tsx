import prisma from '@/lib/prisma';
import { calculateSuitability } from '../../lib/engine/suitability';
import { PlayerAttributes } from '../../lib/engine/types';
import SquadClient from './SquadClient';
import { Suspense } from 'react';

async function getUserTeam() {
    const settings = await prisma.globalGameSettings.findUnique({
        where: { id: 1 }
    });

    if (settings?.userTeamId) {
        return prisma.team.findUnique({
            where: { id: settings.userTeamId },
            include: {
                players: {
                    where: { isRetired: false }
                }
            }
        });
    }

    return prisma.team.findFirst({
        include: {
            players: {
                where: { isRetired: false }
            }
        }
    });
}

export default async function SquadPage() {
    const team = await getUserTeam();

    if (!team) return <div>Team not found. Please seed the database.</div>;

    const playerswithSuitability = team.players.map(p => {
        // Map DB attributes to Engine attributes
        const attrs: PlayerAttributes = {
            handling: p.handling, tackling: p.tackling, passing: p.passing, shooting: p.shooting,
            heading: p.heading, dribbling: p.dribbling, setPieces: p.setPieces,
            aggression: p.aggression, positioning: p.positioning, vision: p.vision,
            bravery: p.bravery, leadership: p.leadership, teamwork: p.teamwork, composure: p.composure,
            pace: p.pace, acceleration: p.acceleration, stamina: p.stamina, strength: p.strength,
            agility: p.agility, balance: p.balance, crossing: p.crossing
        };

        const currentPosId = p.tacticalPosition ? p.tacticalPosition.split('_')[0] : null;
        const baseSuitability = currentPosId ? calculateSuitability(attrs, currentPosId) : 0;
        const fitnessFactor = Math.pow(Math.max(0, Math.min(1, p.condition / 100)), 1.2);
        const fitnessSuitability = Math.round(baseSuitability * fitnessFactor);

        return {
            id: p.id,
            name: p.name,
            naturalPosition: p.naturalPosition,
            age: p.age,
            condition: p.condition,
            morale: p.morale,
            tacticalPosition: p.tacticalPosition,
            suitability: baseSuitability,
            fitnessSuitability,
            rawAttributes: attrs,
            goals: p.goals,
            assists: p.assists,
            apps: p.apps,
            avgRating: p.avgRating,
            birthDate: p.birthDate,
            retirementAge: p.retirementAge
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

            <Suspense fallback={<div>Loading squad...</div>}>
                <SquadClient teamId={team.id} players={playerswithSuitability} currentTactics={currentTactics} />
            </Suspense>
        </div>
    );
}
