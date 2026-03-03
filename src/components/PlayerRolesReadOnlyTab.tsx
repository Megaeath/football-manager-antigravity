'use client';

import { ROLE_DEFINITIONS } from '@/lib/engine/playerRoles';

type Player = {
    id: string;
    name: string;
    naturalPosition: string;
    playerRole?: string | null;
    age: number;
    apps: number;
    goals: number;
    assists: number;
};

export default function PlayerRolesReadOnlyTab({ players, teamName, onViewPlayer }: {
    players: Player[];
    teamName: string;
    onViewPlayer?: (playerId: string) => void;
}) {
    const getRoleDisplayName = (roleName: string | null | undefined) => {
        if (!roleName) return '-';
        const role = ROLE_DEFINITIONS[roleName];
        return role ? role.displayName : roleName;
    };

    const getRoleDescription = (roleName: string | null | undefined) => {
        if (!roleName) return null;
        const role = ROLE_DEFINITIONS[roleName];
        return role?.effects.description;
    };

    const getRoleConditionDrain = (roleName: string | null | undefined) => {
        if (!roleName) return null;
        const role = ROLE_DEFINITIONS[roleName];
        return role ? ((role.conditionDrainMultiplier - 1) * 100).toFixed(0) : null;
    };

    // Group players by position
    const positionGroups: Record<string, Player[]> = {
        'Defenders': [],
        'Midfielders': [],
        'Forwards': []
    };

    players.forEach(p => {
        const pos = p.naturalPosition.split('_')[0];
        if (pos.startsWith('D')) {
            positionGroups['Defenders'].push(p);
        } else if (pos.startsWith('M') || pos.startsWith('A')) {
            positionGroups['Midfielders'].push(p);
        } else if (pos.startsWith('F')) {
            positionGroups['Forwards'].push(p);
        }
    });

    // Count assigned roles
    const assignedCount = players.filter(p => p.playerRole).length;
    const totalCount = players.filter(p => !p.naturalPosition.startsWith('GK')).length;

    return (
        <div style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>👔 {teamName} - Player Roles</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                View tactical role assignments for this team. {assignedCount} of {totalCount} outfield players have assigned roles.
            </p>

            <div style={{
                padding: '1rem',
                background: 'var(--info-light)',
                border: '1px solid var(--info)',
                borderRadius: '6px',
                marginBottom: '1.5rem',
                fontSize: '0.9rem',
                color: 'var(--text)'
            }}>
                <strong>ℹ️ How AI Teams Get Player Roles:</strong>
                <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.25rem' }}>
                    <li>AI teams <strong>automatically assign roles at the start of each season</strong> based on player attributes</li>
                    <li>After a <strong>transfer completes</strong>, AI teams reassign the transferred player's role to match their new team</li>
                    <li>Roles are assigned based on suitability (1-5 stars) to maximize team performance</li>
                </ul>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                {Object.entries(positionGroups).map(([groupName, groupPlayers]) => {
                    if (groupPlayers.length === 0) return null;

                    return (
                        <div key={groupName} className="card">
                            <h4 style={{
                                color: 'var(--primary)',
                                borderBottom: '2px solid var(--primary)',
                                paddingBottom: '0.5rem',
                                marginBottom: '1rem'
                            }}>
                                {groupName}
                            </h4>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {groupPlayers.map(player => (
                                    <div
                                        key={player.id}
                                        style={{
                                            padding: '0.75rem',
                                            background: player.playerRole ? 'var(--card-bg)' : 'var(--hover-bg)',
                                            border: player.playerRole ? '1px solid var(--primary)' : '1px solid var(--border)',
                                            borderRadius: '6px'
                                        }}
                                    >
                                        <div style={{ marginBottom: '0.5rem' }}>
                                            <button
                                                onClick={() => onViewPlayer?.(player.id)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    padding: 0,
                                                    margin: 0,
                                                    fontWeight: 700,
                                                    color: 'var(--primary)',
                                                    cursor: 'pointer',
                                                    fontSize: '0.95rem',
                                                    textAlign: 'left'
                                                }}
                                            >
                                                {player.name}
                                            </button>
                                            <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                {player.naturalPosition}
                                            </span>
                                        </div>

                                        {player.playerRole ? (
                                            <>
                                                <div style={{
                                                    fontSize: '0.9rem',
                                                    color: 'var(--primary)',
                                                    fontWeight: 'bold',
                                                    marginBottom: '0.25rem'
                                                }}>
                                                    {getRoleDisplayName(player.playerRole)}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                                    {getRoleDescription(player.playerRole)}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    Condition Drain: +{getRoleConditionDrain(player.playerRole)}%
                                                </div>
                                            </>
                                        ) : (
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                No role assigned
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
