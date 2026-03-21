import prisma from '@/lib/prisma';
import { BreadcrumbRegister } from '@/components/BreadcrumbContext';
import { PlayerContent } from './PlayerContent';
import { getExpBonus, getExpMultiplier } from '@/lib/engine/experience';
import { calculatePlayerPower, toPlayerAttributes } from '@/lib/engine/playerPower';
import { applyMarketValuePowerBands } from '@/lib/engine/financial';

async function getPlayer(id: string) {
    const player = await prisma.player.findUnique({
        where: { id },
        include: {
            team: true,
            transferHistory: {
                include: { fromTeam: true, toTeam: true },
                orderBy: { date: 'desc' }
            },
            matchStats: {
                include: { match: { include: { homeTeam: true, awayTeam: true } } },
                orderBy: { match: { date: 'desc' } }
            }
        }
    });
    return player as any;
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const player = await getPlayer(id);

    if (!player) return <div className="card">ไม่พบข้อมูลนักเตะ</div>;

    const derivedAvgRating = player.matchStats.length > 0
        ? player.matchStats.reduce((sum: number, stat: any) => sum + (stat.rating || 0), 0) / player.matchStats.length
        : 0;
    const displayAvgRating = player.avgRating > 0 ? player.avgRating : derivedAvgRating;

    // Calculate overall rating
    const technicalAvg = (
        (player.passing || 10) + (player.dribbling || 10) + (player.shooting || 10) +
        (player.crossing || 10) + (player.heading || 10) + (player.tackling || 10) +
        (player.vision || 10)
    ) / 7;
    const mentalAvg = (
        (player.bravery || 10) + (player.leadership || 10) + (player.positioning || 10) +
        (player.composure || 10) + (player.aggression || 10) + (player.teamwork || 10)
    ) / 6;
    const physicalAvg = (
        (player.acceleration || 10) + (player.pace || 10) + (player.strength || 10) +
        (player.stamina || 10) + (player.agility || 10) + (player.balance || 10)
    ) / 6;
    const overallRating = (technicalAvg + mentalAvg + physicalAvg) / 3;

    // Calculate market value
    let ageMultiplier = 1;
    if (player.age >= 32) {
        ageMultiplier = Math.pow(0.9, player.age - 32);
    }
    const rawMarketValue = Math.round(
        (Math.pow(overallRating, 2) * (player.popularity || 50)) / 1000 * ageMultiplier * 50000
    );

    const power = calculatePlayerPower({
        attributes: toPlayerAttributes({
            handling: player.handling,
            tackling: player.tackling,
            passing: player.passing,
            shooting: player.shooting,
            heading: player.heading,
            dribbling: player.dribbling,
            crossing: player.crossing,
            setPieces: player.setPieces,
            throw: player.throw,
            aggression: player.aggression,
            positioning: player.positioning,
            vision: player.vision,
            bravery: player.bravery,
            leadership: player.leadership,
            teamwork: player.teamwork,
            composure: player.composure,
            pace: player.pace,
            acceleration: player.acceleration,
            stamina: player.stamina,
            strength: player.strength,
            agility: player.agility,
            balance: player.balance
        }),
        targetPosition: (player.naturalPosition || 'GK').split('_')[0],
        condition: 100,
        exp: player.exp || 0
    }).powerWithExp;

    const marketValue = applyMarketValuePowerBands(rawMarketValue, power);

    // Prepare attribute data for client component
    const exp = player.exp || 0;
    const expBonus = getExpBonus(exp);
    const expMultiplier = getExpMultiplier(exp);

    const attributeData = {
        technical: [
            {
                label: 'Technical',
                items: [
                    { label: 'Handling (GK)', value: player.handling, bonus: expBonus },
                    { label: 'Tackling', value: player.tackling, bonus: expBonus },
                    { label: 'Passing', value: player.passing, bonus: expBonus },
                    { label: 'Shooting', value: player.shooting, bonus: expBonus },
                    { label: 'Heading', value: player.heading, bonus: expBonus },
                    { label: 'Dribbling', value: player.dribbling, bonus: expBonus },
                    { label: 'Crossing', value: player.crossing, bonus: expBonus },
                    { label: 'Set Pieces', value: player.setPieces, bonus: expBonus },
                    { label: 'Throw In', value: player.throw, bonus: expBonus },
                ]
            }
        ],
        mental: [
            {
                label: 'Mental',
                items: [
                    { label: 'Aggression', value: player.aggression, bonus: expBonus },
                    { label: 'Positioning', value: player.positioning, bonus: expBonus },
                    { label: 'Vision', value: player.vision, bonus: expBonus },
                    { label: 'Bravery', value: player.bravery, bonus: expBonus },
                    { label: 'Leadership', value: player.leadership, bonus: expBonus },
                    { label: 'Teamwork', value: player.teamwork, bonus: expBonus },
                    { label: 'Composure', value: player.composure, bonus: expBonus },
                ]
            }
        ],
        physical: [
            {
                label: 'Physical',
                items: [
                    { label: 'Pace', value: player.pace, bonus: expBonus },
                    { label: 'Acceleration', value: player.acceleration, bonus: expBonus },
                    { label: 'Stamina', value: player.stamina, bonus: expBonus },
                    { label: 'Strength', value: player.strength, bonus: expBonus },
                    { label: 'Agility', value: player.agility, bonus: expBonus },
                    { label: 'Balance', value: player.balance, bonus: expBonus },
                ]
            }
        ],
        exp: exp,
        expBonus: expBonus,
        expMultiplier: expMultiplier,
    };

    // Serialize for Client Component
    const serializedPlayer = JSON.parse(JSON.stringify({
        ...player,
        marketValue
    }));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <BreadcrumbRegister segment={id} name={player.name} />

            {/* Header Section */}
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '2rem', background: 'var(--sidebar-bg)', color: 'white' }}>
                <div style={{
                    width: '80px', height: '80px', background: 'rgba(255,255,255,0.1)',
                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem'
                }}>
                    👤
                </div>
                <div>
                    <h1 style={{ color: 'white', margin: 0, fontSize: '2rem' }}>{player.name}</h1>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px', alignItems: 'center' }}>
                        <span className="badge" style={{ background: 'var(--primary)', color: 'white' }}>{player.naturalPosition}</span>
                        <span style={{ color: 'rgba(255,255,255,0.7)' }}>{player.team?.name || 'Free Agent'}</span>
                        <span style={{ color: 'rgba(255,255,255,0.7)' }}>• {player.age} years old</span>
                    </div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Average Rating</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--accent)' }}>{displayAvgRating.toFixed(2)}</div>
                </div>
            </div>

            {/* Content Tabs */}
            <PlayerContent player={serializedPlayer} attributeData={attributeData} />
        </div>
    );
}
