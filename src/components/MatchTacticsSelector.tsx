'use client';

import { useState } from 'react';

interface TeamTactics {
    formation: string;
    mentality: string;
    passing: string;
    tackling: string;
    attacking_focus: string;
    creative_freedom: string;
}

interface MatchTacticsSelectorProps {
    matchId: string;
    homeTeamName: string;
    homeTeamDefaultTactics: TeamTactics;
    awayTeamName: string;
    awayTeamDefaultTactics: TeamTactics;
    onConfirm: (homeTactics: Partial<TeamTactics>, awayTactics: Partial<TeamTactics>) => void;
}

export default function MatchTacticsSelector({
    matchId,
    homeTeamName,
    homeTeamDefaultTactics,
    awayTeamName,
    awayTeamDefaultTactics,
    onConfirm
}: MatchTacticsSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [homeTactics, setHomeTactics] = useState<Partial<TeamTactics>>({});
    const [awayTactics, setAwayTactics] = useState<Partial<TeamTactics>>({});

    const handleConfirm = () => {
        onConfirm(homeTactics, awayTactics);
        setIsOpen(false);
        setHomeTactics({});
        setAwayTactics({});
    };

    const getDisplayValue = (key: keyof TeamTactics, side: 'home' | 'away') => {
        const tactics = side === 'home' ? homeTactics : awayTactics;
        const defaultTactics = side === 'home' ? homeTeamDefaultTactics : awayTeamDefaultTactics;
        return tactics[key] || defaultTactics[key] || 'N/A';
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    padding: '8px 16px',
                    background: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 'bold'
                }}
            >
                ⚙️ Match Tactics
            </button>
        );
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
            <div style={{
                background: 'var(--bg-primary)',
                borderRadius: '12px',
                padding: '2rem',
                maxWidth: '900px',
                maxHeight: '90vh',
                overflow: 'auto',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
            }}>
                <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Match-Specific Tactics</h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                    {/* Home Team */}
                    <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem' }}>
                        <h3 style={{ marginTop: 0, color: 'var(--primary)' }}>🏠 {homeTeamName}</h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {['formation', 'mentality', 'passing', 'tackling', 'attacking_focus', 'creative_freedom'].map(key => (
                                <div key={`home-${key}`}>
                                    <label style={{ fontWeight: 'bold', marginBottom: '0.25rem', display: 'block', fontSize: '0.9rem' }}>
                                        {key.replace(/_/g, ' ').charAt(0).toUpperCase() + key.replace(/_/g, ' ').slice(1)}
                                    </label>
                                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem' }}>
                                        <div style={{
                                            flex: 1,
                                            padding: '8px',
                                            background: 'var(--hover-bg)',
                                            borderRadius: '4px',
                                            border: '1px solid var(--border)'
                                        }}>
                                            Default: <strong>{homeTeamDefaultTactics[key as keyof TeamTactics]}</strong>
                                        </div>
                                        <div style={{
                                            flex: 1,
                                            padding: '8px',
                                            background: homeTactics[key as keyof TeamTactics] ? 'var(--primary-light)' : 'var(--hover-bg)',
                                            borderRadius: '4px',
                                            border: '1px solid var(--border)',
                                            minHeight: '40px',
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}>
                                            {homeTactics[key as keyof TeamTactics] ? (
                                                <>
                                                    Override: <strong>{homeTactics[key as keyof TeamTactics]}</strong>
                                                    <button
                                                        onClick={() => setHomeTactics(prev => {
                                                            const newTactics = { ...prev };
                                                            delete newTactics[key as keyof TeamTactics];
                                                            return newTactics;
                                                        })}
                                                        style={{
                                                            marginLeft: 'auto',
                                                            background: 'none',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            color: 'var(--danger)'
                                                        }}
                                                    >
                                                        ✕
                                                    </button>
                                                </>
                                            ) : (
                                                <span style={{ color: 'var(--muted)' }}>No override</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Away Team */}
                    <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem' }}>
                        <h3 style={{ marginTop: 0, color: 'var(--accent)' }}>✈️ {awayTeamName}</h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {['formation', 'mentality', 'passing', 'tackling', 'attacking_focus', 'creative_freedom'].map(key => (
                                <div key={`away-${key}`}>
                                    <label style={{ fontWeight: 'bold', marginBottom: '0.25rem', display: 'block', fontSize: '0.9rem' }}>
                                        {key.replace(/_/g, ' ').charAt(0).toUpperCase() + key.replace(/_/g, ' ').slice(1)}
                                    </label>
                                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem' }}>
                                        <div style={{
                                            flex: 1,
                                            padding: '8px',
                                            background: 'var(--hover-bg)',
                                            borderRadius: '4px',
                                            border: '1px solid var(--border)'
                                        }}>
                                            Default: <strong>{awayTeamDefaultTactics[key as keyof TeamTactics]}</strong>
                                        </div>
                                        <div style={{
                                            flex: 1,
                                            padding: '8px',
                                            background: awayTactics[key as keyof TeamTactics] ? 'var(--accent-light)' : 'var(--hover-bg)',
                                            borderRadius: '4px',
                                            border: '1px solid var(--border)',
                                            minHeight: '40px',
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}>
                                            {awayTactics[key as keyof TeamTactics] ? (
                                                <>
                                                    Override: <strong>{awayTactics[key as keyof TeamTactics]}</strong>
                                                    <button
                                                        onClick={() => setAwayTactics(prev => {
                                                            const newTactics = { ...prev };
                                                            delete newTactics[key as keyof TeamTactics];
                                                            return newTactics;
                                                        })}
                                                        style={{
                                                            marginLeft: 'auto',
                                                            background: 'none',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            color: 'var(--danger)'
                                                        }}
                                                    >
                                                        ✕
                                                    </button>
                                                </>
                                            ) : (
                                                <span style={{ color: 'var(--muted)' }}>No override</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <button
                        onClick={() => {
                            setIsOpen(false);
                            setHomeTactics({});
                            setAwayTactics({});
                        }}
                        style={{
                            padding: '10px 20px',
                            background: 'var(--border)',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        style={{
                            padding: '10px 20px',
                            background: 'var(--success)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        Confirm Match
                    </button>
                </div>
            </div>
        </div>
    );
}
