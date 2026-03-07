'use client';

import { useState, useEffect } from 'react';
import { ROLE_DEFINITIONS, getPreferredRoleNamesForPhase, getSuggestedRolePresets } from '@/lib/engine/playerRoles';
import type { PlayerAttributes } from '@/lib/engine/types';

type PlayerProps = {
    id: string;
    name: string;
    naturalPosition: string;
    playerRole?: string | null;
    attackingRolePreset?: string | null;
    defensiveRolePreset?: string | null;
    rawAttributes: PlayerAttributes;
};

type RoleSuitability = {
    roleName: string;
    displayName: string;
    description: string;
    suitability: number;
    primaryAttributes: string[];
    conditionDrainMultiplier: number;
};

export default function PlayerRolesTab({ players, teamId, onViewPlayer }: {
    players: PlayerProps[];
    teamId: string;
    onViewPlayer?: (playerId: string) => void;
}) {
    const [loading, setLoading] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<PlayerProps | null>(null);
    const [roleSuitability, setRoleSuitability] = useState<RoleSuitability[]>([]);
    const [loadingSuitability, setLoadingSuitability] = useState(false);
    const [playersList, setPlayersList] = useState<PlayerProps[]>(players);
    const [selectedMode, setSelectedMode] = useState<'attacking' | 'defensive'>('attacking');

    // Sync playersList when props change
    useEffect(() => {
        setPlayersList(prev => {
            const prevMap = new Map(prev.map(p => [p.id, p]));
            return players.map(p => {
                const cached = prevMap.get(p.id);
                if (!cached) return p;

                return {
                    ...p,
                    // Preserve newest local edits if parent hasn't refreshed yet
                    playerRole: cached.playerRole ?? p.playerRole,
                    attackingRolePreset: cached.attackingRolePreset ?? p.attackingRolePreset,
                    defensiveRolePreset: cached.defensiveRolePreset ?? p.defensiveRolePreset
                };
            });
        });
    }, [players]);

    // Load role suitability when player is selected
    useEffect(() => {
        if (!selectedPlayer) {
            setRoleSuitability([]);
            return;
        }

        const fetchSuitability = async () => {
            setLoadingSuitability(true);
            try {
                const res = await fetch(`/api/player/${selectedPlayer.id}/role-suitability`);
                const data = await res.json();
                if (data.roles) {
                    setRoleSuitability(data.roles);
                    const incomingAttack = data.attackingRolePreset ?? data.playerRole ?? null;
                    const incomingDefense = data.defensiveRolePreset ?? data.playerRole ?? null;
                    // Update selectedPlayer with latest role presets from API
                    if (
                        incomingAttack !== (selectedPlayer.attackingRolePreset ?? selectedPlayer.playerRole ?? null)
                        || incomingDefense !== (selectedPlayer.defensiveRolePreset ?? selectedPlayer.playerRole ?? null)
                    ) {
                        setSelectedPlayer(prev => prev ? {
                            ...prev,
                            playerRole: data.playerRole,
                            attackingRolePreset: incomingAttack,
                            defensiveRolePreset: incomingDefense
                        } : null);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch role suitability:', error);
            } finally {
                setLoadingSuitability(false);
            }
        };

        fetchSuitability();
    }, [selectedPlayer?.id]);

    const handleAssignRole = async (playerId: string, roleName: string | null, mode: 'attacking' | 'defensive') => {
        setLoading(true);
        try {
            const payload = mode === 'attacking'
                ? { attackingRolePreset: roleName }
                : { defensiveRolePreset: roleName };

            const res = await fetch(`/api/player/${playerId}/role`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await res.json();
            
            if (!data.success) {
                alert(data.error || 'Failed to assign role');
                return;
            }

            // Update selected player state with the response data
            if (selectedPlayer && data.player) {
                const updatedPlayer = {
                    ...selectedPlayer,
                    playerRole: data.player.playerRole,
                    attackingRolePreset: data.player.attackingRolePreset,
                    defensiveRolePreset: data.player.defensiveRolePreset
                };
                setSelectedPlayer(updatedPlayer);
                
                // Update playersList to reflect the change in the list
                setPlayersList(prevList =>
                    prevList.map(p =>
                        p.id === playerId
                            ? {
                                ...p,
                                playerRole: data.player.playerRole,
                                attackingRolePreset: data.player.attackingRolePreset,
                                defensiveRolePreset: data.player.defensiveRolePreset
                            }
                            : p
                    )
                );
                
                // Re-fetch role suitability to refresh the UI with latest data
                setLoadingSuitability(true);
                try {
                    const suitRes = await fetch(`/api/player/${playerId}/role-suitability`);
                    const suitData = await suitRes.json();
                    if (suitData.roles) {
                        setRoleSuitability(suitData.roles);
                        // Ensure selectedPlayer is in sync with API
                        setSelectedPlayer(prev => prev ? {
                            ...prev,
                            playerRole: suitData.playerRole,
                            attackingRolePreset: suitData.attackingRolePreset,
                            defensiveRolePreset: suitData.defensiveRolePreset
                        } : null);
                    }
                } catch (error) {
                    console.error('Failed to refresh role suitability:', error);
                } finally {
                    setLoadingSuitability(false);
                }
            }
        } catch (error) {
            console.error('Failed to assign role:', error);
            alert('Failed to assign role');
        } finally {
            setLoading(false);
        }
    };

    const getRoleDisplayName = (roleName: string | null | undefined) => {
        if (!roleName) return 'No Role';
        const role = ROLE_DEFINITIONS[roleName];
        return role ? role.displayName : roleName;
    };

    const getActiveRoleForMode = (player: PlayerProps, mode: 'attacking' | 'defensive') => {
        if (mode === 'attacking') {
            return player.attackingRolePreset ?? player.playerRole ?? null;
        }
        return player.defensiveRolePreset ?? player.playerRole ?? null;
    };

    const getRolesForSelectedMode = (allRoles: RoleSuitability[]) => {
        const preferred = new Set(getPreferredRoleNamesForPhase(selectedMode));
        const preferredRoles = allRoles.filter(r => preferred.has(r.roleName));
        return preferredRoles.length > 0 ? preferredRoles : allRoles;
    };

    const handleApplyRecommendedPresets = async (player: PlayerProps) => {
        setLoading(true);
        try {
            const preset = getSuggestedRolePresets(player.naturalPosition);
            const res = await fetch(`/api/player/${player.id}/role`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    attackingRolePreset: preset.attackingRolePreset,
                    defensiveRolePreset: preset.defensiveRolePreset
                })
            });

            const data = await res.json();
            if (!data.success) {
                alert(data.error || 'Failed to apply recommended presets');
                return;
            }

            setPlayersList(prevList =>
                prevList.map(p =>
                    p.id === player.id
                        ? {
                            ...p,
                            playerRole: data.player.playerRole,
                            attackingRolePreset: data.player.attackingRolePreset,
                            defensiveRolePreset: data.player.defensiveRolePreset
                        }
                        : p
                )
            );

            if (selectedPlayer?.id === player.id) {
                setSelectedPlayer(prev => prev ? {
                    ...prev,
                    playerRole: data.player.playerRole,
                    attackingRolePreset: data.player.attackingRolePreset,
                    defensiveRolePreset: data.player.defensiveRolePreset
                } : null);
            }
        } catch (error) {
            console.error('Failed to apply recommended presets:', error);
            alert('Failed to apply recommended presets');
        } finally {
            setLoading(false);
        }
    };

    const getStarRating = (stars: number) => {
        return '⭐'.repeat(stars);
    };

    // Group players by position
    const positionGroups: Record<string, PlayerProps[]> = {
        'Defenders': [],
        'Midfielders': [],
        'Forwards': []
    };

    playersList.forEach(p => {
        const pos = p.naturalPosition.split('_')[0];
        if (pos.startsWith('D')) {
            positionGroups['Defenders'].push(p);
        } else if (pos.startsWith('M') || pos.startsWith('A')) {
            positionGroups['Midfielders'].push(p);
        } else if (pos.startsWith('F')) {
            positionGroups['Forwards'].push(p);
        }
    });

    const renderRoleSelector = (player: PlayerProps) => {
        if (loadingSuitability && selectedPlayer?.id === player.id) {
            return (
                <div style={{ textAlign: 'center', padding: '1rem' }}>
                    <p>Loading role suitability...</p>
                </div>
            );
        }

        if (!selectedPlayer || selectedPlayer.id !== player.id || roleSuitability.length === 0) {
            return null;
        }

        return (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{
                        marginBottom: '0.65rem',
                        padding: '0.5rem 0.65rem',
                        borderRadius: '6px',
                        background: 'var(--hover-bg)',
                        border: '1px solid var(--border)',
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)'
                    }}>
                        <div style={{ marginBottom: '0.2rem' }}>⚔️ Current Attacking: <strong>{getRoleDisplayName(getActiveRoleForMode(player, 'attacking'))}</strong></div>
                        <div>🛡️ Current Defensive: <strong>{getRoleDisplayName(getActiveRoleForMode(player, 'defensive'))}</strong></div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
                        <button
                            onClick={() => setSelectedMode('attacking')}
                            style={{
                                padding: '0.35rem 0.7rem',
                                borderRadius: '999px',
                                border: selectedMode === 'attacking' ? '1px solid var(--primary)' : '1px solid var(--border)',
                                background: selectedMode === 'attacking' ? 'var(--primary-light)' : 'white',
                                color: selectedMode === 'attacking' ? 'var(--primary)' : 'var(--text-muted)',
                                fontWeight: 600,
                                fontSize: '0.8rem',
                                cursor: 'pointer'
                            }}
                        >
                            ⚔️ เกมรุก
                        </button>
                        <button
                            onClick={() => setSelectedMode('defensive')}
                            style={{
                                padding: '0.35rem 0.7rem',
                                borderRadius: '999px',
                                border: selectedMode === 'defensive' ? '1px solid var(--primary)' : '1px solid var(--border)',
                                background: selectedMode === 'defensive' ? 'var(--primary-light)' : 'white',
                                color: selectedMode === 'defensive' ? 'var(--primary)' : 'var(--text-muted)',
                                fontWeight: 600,
                                fontSize: '0.8rem',
                                cursor: 'pointer'
                            }}
                        >
                            🛡️ เกมรับ
                        </button>
                    </div>

                    <button
                        onClick={() => handleAssignRole(player.id, null, selectedMode)}
                        disabled={loading || !getActiveRoleForMode(player, selectedMode)}
                        style={{
                            padding: '0.4rem 0.8rem',
                            background: 'var(--danger)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: loading || !getActiveRoleForMode(player, selectedMode) ? 'not-allowed' : 'pointer',
                            opacity: loading || !getActiveRoleForMode(player, selectedMode) ? 0.5 : 1,
                            fontSize: '0.85rem'
                        }}
                    >
                        Clear {selectedMode === 'attacking' ? 'Attacking' : 'Defensive'} Role
                    </button>

                    <button
                        onClick={() => handleApplyRecommendedPresets(player)}
                        disabled={loading}
                        style={{
                            marginLeft: '0.5rem',
                            padding: '0.4rem 0.8rem',
                            background: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.5 : 1,
                            fontSize: '0.85rem'
                        }}
                    >
                        Apply Recommended Presets
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {getRolesForSelectedMode(roleSuitability).map(role => (
                        <div
                            key={role.roleName}
                            style={{
                                padding: '0.75rem',
                                background: getActiveRoleForMode(player, selectedMode) === role.roleName ? 'var(--success-light)' : 'var(--card-bg)',
                                border: getActiveRoleForMode(player, selectedMode) === role.roleName ? '2px solid var(--success)' : '1px solid var(--border)',
                                borderRadius: '4px'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                                <div>
                                    <strong style={{ fontSize: '0.9rem' }}>{role.displayName}</strong>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '0.1rem' }}>
                                        {getStarRating(role.suitability)} ({role.suitability}/5)
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleAssignRole(player.id, role.roleName, selectedMode)}
                                    disabled={loading || getActiveRoleForMode(player, selectedMode) === role.roleName}
                                    style={{
                                        padding: '0.3rem 0.6rem',
                                        background: getActiveRoleForMode(player, selectedMode) === role.roleName ? 'var(--success)' : 'var(--primary)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        cursor: loading || getActiveRoleForMode(player, selectedMode) === role.roleName ? 'not-allowed' : 'pointer',
                                        fontSize: '0.75rem',
                                        opacity: loading ? 0.5 : 1
                                    }}
                                >
                                    {getActiveRoleForMode(player, selectedMode) === role.roleName ? '✓ Active' : 'Assign'}
                                </button>
                            </div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.3rem 0' }}>
                                {role.description}
                            </p>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                <strong>Key:</strong> {role.primaryAttributes.join(', ')}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>👔 Player Roles Assignment</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Click player name to view status, or click role/arrow area to expand and assign roles.
            </p>

            <div style={{
                padding: '1rem',
                background: 'var(--success-light)',
                border: '1px solid var(--success)',
                borderRadius: '6px',
                marginBottom: '1.5rem',
                fontSize: '0.9rem',
                color: 'var(--text)'
            }}>
                <strong>💡 How AI Teams Use Roles:</strong>
                <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.25rem', fontSize: '0.85rem' }}>
                    <li><strong>Season Start:</strong> AI teams automatically assign roles to all players based on suitability</li>
                    <li><strong>After Transfers:</strong> When a player joins an AI team, their role is auto-assigned to fit the new team</li>
                    <li><strong>Your Team:</strong> You can manually assign roles here - or AI will auto-assign at season start if you don't</li>
                </ul>
            </div>

            <div>
                {Object.entries(positionGroups).map(([groupName, groupPlayers]) => {
                    if (groupPlayers.length === 0) return null;
                    
                    return (
                        <div key={groupName} style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ 
                                color: 'var(--primary)', 
                                borderBottom: '2px solid var(--primary)', 
                                paddingBottom: '0.25rem',
                                marginBottom: '0.75rem'
                            }}>
                                {groupName}
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {groupPlayers.map(player => (
                                    <div
                                        key={player.id}
                                        style={{
                                            background: selectedPlayer?.id === player.id ? 'var(--primary-light)' : 'var(--card-bg)',
                                            border: selectedPlayer?.id === player.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                                            borderRadius: '6px',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <div
                                            style={{
                                                padding: '0.75rem',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onViewPlayer?.(player.id);
                                                    }}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        padding: 0,
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
                                            <button
                                                onClick={() => {
                                                    if (selectedPlayer?.id === player.id) {
                                                        setSelectedPlayer(null);
                                                    } else {
                                                        setSelectedPlayer(player);
                                                    }
                                                }}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.75rem',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    padding: '2px 4px',
                                                    borderRadius: '4px'
                                                }}
                                                aria-label={`Toggle role assignment for ${player.name}`}
                                            >
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                                                    <div>⚔️ {getRoleDisplayName(getActiveRoleForMode(player, 'attacking'))}</div>
                                                    <div>🛡️ {getRoleDisplayName(getActiveRoleForMode(player, 'defensive'))}</div>
                                                </div>
                                                <span style={{ 
                                                    fontSize: '1.2rem', 
                                                    transform: selectedPlayer?.id === player.id ? 'rotate(180deg)' : 'rotate(0deg)',
                                                    transition: 'transform 0.2s'
                                                }}>
                                                    ▼
                                                </span>
                                            </button>
                                        </div>

                                        {selectedPlayer?.id === player.id && (
                                            <div style={{ padding: '0 0.75rem 0.75rem 0.75rem' }}>
                                                {renderRoleSelector(player)}
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
