'use client';

import { useState, useEffect } from 'react';
import { ROLE_DEFINITIONS } from '@/lib/engine/playerRoles';
import type { PlayerAttributes } from '@/lib/engine/types';

type PlayerProps = {
    id: string;
    name: string;
    naturalPosition: string;
    playerRole?: string | null;
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

    // Sync playersList when props change
    useEffect(() => {
        setPlayersList(players);
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
                    // Update selectedPlayer with latest playerRole from API
                    if (data.playerRole !== selectedPlayer.playerRole) {
                        setSelectedPlayer(prev => prev ? {
                            ...prev,
                            playerRole: data.playerRole
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

    const handleAssignRole = async (playerId: string, roleName: string | null) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/player/${playerId}/role`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerRole: roleName })
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
                    playerRole: data.player.playerRole
                };
                setSelectedPlayer(updatedPlayer);
                
                // Update playersList to reflect the change in the list
                setPlayersList(prevList =>
                    prevList.map(p =>
                        p.id === playerId ? { ...p, playerRole: data.player.playerRole } : p
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
                            playerRole: suitData.playerRole
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
                    <button
                        onClick={() => handleAssignRole(player.id, null)}
                        disabled={loading || !player.playerRole}
                        style={{
                            padding: '0.4rem 0.8rem',
                            background: 'var(--danger)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: loading || !player.playerRole ? 'not-allowed' : 'pointer',
                            opacity: loading || !player.playerRole ? 0.5 : 1,
                            fontSize: '0.85rem'
                        }}
                    >
                        Clear Role
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {roleSuitability.map(role => (
                        <div
                            key={role.roleName}
                            style={{
                                padding: '0.75rem',
                                background: player.playerRole === role.roleName ? 'var(--success-light)' : 'var(--card-bg)',
                                border: player.playerRole === role.roleName ? '2px solid var(--success)' : '1px solid var(--border)',
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
                                    onClick={() => handleAssignRole(player.id, role.roleName)}
                                    disabled={loading || player.playerRole === role.roleName}
                                    style={{
                                        padding: '0.3rem 0.6rem',
                                        background: player.playerRole === role.roleName ? 'var(--success)' : 'var(--primary)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        cursor: loading || player.playerRole === role.roleName ? 'not-allowed' : 'pointer',
                                        fontSize: '0.75rem',
                                        opacity: loading ? 0.5 : 1
                                    }}
                                >
                                    {player.playerRole === role.roleName ? '✓ Active' : 'Assign'}
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
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                    {getRoleDisplayName(player.playerRole)}
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
