'use client';

import { useEffect, useState } from 'react';

interface ContractPlayer {
    id: string;
    name: string;
    naturalPosition: string;
    age: number;
    weeklyWage: number;
    contractEndWeek: number;
    popularity: number;
}

interface ContractsResponse {
    teamId: string;
    teamName: string;
    expiringPlayers: ContractPlayer[];
    totalExpiring: number;
}

export default function ContractsPage() {
    const [data, setData] = useState<ContractsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [renewingId, setRenewingId] = useState<string | null>(null);

    const fetchContracts = async () => {
        try {
            const gameInfo = await fetch('/api/game/info').then(r => r.json());
            if (!gameInfo.userTeamId) {
                setError('Please select a team first');
                return;
            }

            const res = await fetch(`/api/contracts?teamId=${gameInfo.userTeamId}`);
            if (!res.ok) {
                throw new Error(`Failed to load contracts: ${res.statusText}`);
            }
            const json = await res.json();
            setData(json);
        } catch (err) {
            setError(`Error loading contracts: ${err}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContracts();
    }, []);

    const handleRenew = async (playerId: string) => {
        setRenewingId(playerId);
        try {
            const res = await fetch('/api/contracts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId })
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json?.error || 'Failed to renew contract');
            }
            await fetchContracts();
        } catch (err) {
            alert(`Renewal failed: ${err}`);
        } finally {
            setRenewingId(null);
        }
    };

    const formatCurrency = (num: number) => {
        if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
        return `$${num}`;
    };

    const getStatusBadge = (weeks: number) => {
        if (weeks <= 4) return { label: 'URGENT', color: '#dc2626' };
        if (weeks <= 10) return { label: 'WARNING', color: '#f59e0b' };
        return { label: 'OK', color: '#10b981' };
    };

    if (loading) return <div className="container p-4 text-center md:p-8">Loading contracts...</div>;
    if (error) return <div className="container p-4 text-red-600 md:p-8">{error}</div>;

    return (
        <div className="container p-4 md:p-8">
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ marginBottom: '0.5rem' }} className="text-2xl md:text-3xl">📄 Contract Management</h1>
                <p style={{ color: 'var(--muted)' }}>Expiring contracts for {data?.teamName}</p>
            </div>

            <div className="card" style={{ marginBottom: '2rem' }}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" style={{ display: 'grid', gap: '1rem' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Expiring Soon</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--primary)' }}>{data?.totalExpiring || 0}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Urgent (≤ 4 weeks)</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#dc2626' }}>
                            {data?.expiringPlayers.filter(p => p.contractEndWeek <= 4).length || 0}
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Average Wage</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--accent)' }}>
                            {data?.expiringPlayers.length ?
                                formatCurrency(Math.round(data.expiringPlayers.reduce((sum, p) => sum + p.weeklyWage, 0) / data.expiringPlayers.length)) :
                                '$0'
                            }
                        </div>
                    </div>
                </div>
            </div>

            <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>Expiring Contracts (≤ 10 weeks)</h3>

                {data?.expiringPlayers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                        🎉 No expiring contracts in the next 10 weeks
                    </div>
                ) : (
                    <>
                    <div className="hidden overflow-x-auto md:block" style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                    <th style={{ textAlign: 'left', padding: '12px' }}>Player</th>
                                    <th style={{ textAlign: 'center', padding: '12px' }}>Position</th>
                                    <th style={{ textAlign: 'center', padding: '12px' }}>Age</th>
                                    <th style={{ textAlign: 'center', padding: '12px' }}>Popularity</th>
                                    <th style={{ textAlign: 'center', padding: '12px' }}>Weekly Wage</th>
                                    <th style={{ textAlign: 'center', padding: '12px' }}>Weeks Left</th>
                                    <th style={{ textAlign: 'center', padding: '12px' }}>Status</th>
                                    <th style={{ textAlign: 'center', padding: '12px' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.expiringPlayers.map(player => {
                                    const status = getStatusBadge(player.contractEndWeek);
                                    return (
                                        <tr key={player.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '12px' }}>{player.name}</td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>{player.naturalPosition}</td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>{player.age}</td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>{player.popularity}</td>
                                            <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>
                                                {formatCurrency(player.weeklyWage)}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>{player.contractEndWeek}</td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                <span style={{
                                                    background: status.color,
                                                    color: 'white',
                                                    padding: '4px 8px',
                                                    borderRadius: '12px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                <button
                                                    className="btn btn-sm"
                                                    onClick={() => handleRenew(player.id)}
                                                    disabled={renewingId === player.id}
                                                    style={{ minWidth: '90px' }}
                                                >
                                                    {renewingId === player.id ? 'Renewing...' : 'Renew'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-col gap-3 md:hidden">
                        {data?.expiringPlayers.map(player => {
                            const status = getStatusBadge(player.contractEndWeek);
                            return (
                                <div key={player.id} className="rounded-xl border border-[var(--border)] p-3">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                                        <div style={{ fontWeight: 700 }}>{player.name}</div>
                                        <span style={{
                                            background: status.color,
                                            color: 'white',
                                            padding: '4px 8px',
                                            borderRadius: '12px',
                                            fontSize: '0.72rem',
                                            fontWeight: 'bold',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {status.label}
                                        </span>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px', fontSize: '0.85rem', marginBottom: '10px' }}>
                                        <div>Position: <strong>{player.naturalPosition}</strong></div>
                                        <div>Age: <strong>{player.age}</strong></div>
                                        <div>Popularity: <strong>{player.popularity}</strong></div>
                                        <div>Weeks Left: <strong>{player.contractEndWeek}</strong></div>
                                        <div style={{ gridColumn: '1 / -1' }}>Weekly Wage: <strong>{formatCurrency(player.weeklyWage)}</strong></div>
                                    </div>

                                    <button
                                        className="btn btn-sm"
                                        onClick={() => handleRenew(player.id)}
                                        disabled={renewingId === player.id}
                                        style={{ minWidth: '90px', width: '100%', justifyContent: 'center' }}
                                    >
                                        {renewingId === player.id ? 'Renewing...' : 'Renew'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    </>
                )}
            </div>
        </div>
    );
}
