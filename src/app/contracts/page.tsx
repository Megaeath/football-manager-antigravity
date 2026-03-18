'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CONTRACTS, ACTIONS } from '@/lib/constants/uiLabels';

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
                body: JSON.stringify({ playerId, weeks: 52 })
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
        return `$${num.toLocaleString()}`;
    };

    const getStatusBadge = (weeks: number) => {
        if (weeks <= 4) return { label: 'URGENT', color: '#dc2626' };
        if (weeks <= 10) return { label: 'WARNING', color: '#f59e0b' };
        return { label: 'OK', color: '#10b981' };
    };

    if (loading) return (
        <div className="p-4 text-center" style={{ padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem' }}>📄 {CONTRACTS.LOADING}</div>
        </div>
    );
    
    if (error) return (
        <div className="p-4 text-center" style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>
            ❌ {error}
        </div>
    );

    const totalExpiring = data?.totalExpiring || 0;
    const urgentCount = data?.expiringPlayers.filter(p => p.contractEndWeek <= 4).length || 0;
    const warningCount = data?.expiringPlayers.filter(p => p.contractEndWeek > 4 && p.contractEndWeek <= 10).length || 0;

    return (
        <div className="flex flex-col gap-6 md:gap-8">
            {/* Header */}
            <div className="hero-gradient">
                <h1 className="text-2xl md:text-4xl" style={{ margin: 0 }}>📄 {CONTRACTS.TITLE}</h1>
                <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9 }}>{data?.teamName}</p>
            </div>

            {/* Summary Cards */}
            <div className="grid-auto-fit-md" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                <Card style={{ textAlign: 'center', padding: '2rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{CONTRACTS.EXPIRING_PLAYERS}</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{totalExpiring}</div>
                </Card>

                <Card style={{ textAlign: 'center', padding: '2rem', borderLeft: '4px solid #dc2626' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Urgent (≤4 weeks)</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#dc2626' }}>{urgentCount}</div>
                </Card>

                <Card style={{ textAlign: 'center', padding: '2rem', borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Warning (5-10 weeks)</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#f59e0b' }}>{warningCount}</div>
                </Card>
            </div>

            {/* Expiring Players Table */}
            <Card>
                <CardHeader>
                    <CardTitle>⏰ {CONTRACTS.EXPIRING_SOON}</CardTitle>
                </CardHeader>

                {totalExpiring === 0 ? (
                    <div className="p-lg text-center text-muted" style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                        ✅ {CONTRACTS.NO_EXPIRING}
                    </div>
                ) : (
                    <div className="hidden md:block overflow-x-auto">
                        <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>{CONTRACTS.PLAYER}</th>
                                    <th style={{ padding: '12px', textAlign: 'center', width: '100px' }}>{CONTRACTS.POSITION}</th>
                                    <th style={{ padding: '12px', textAlign: 'center', width: '70px' }}>{CONTRACTS.AGE}</th>
                                    <th style={{ padding: '12px', textAlign: 'center', width: '120px' }}>{CONTRACTS.CURRENT_WAGE}</th>
                                    <th style={{ padding: '12px', textAlign: 'center', width: '120px' }}>{CONTRACTS.WEEKS_REMAINING}</th>
                                    <th style={{ padding: '12px', textAlign: 'center', width: '100px' }}>{CONTRACTS.STATUS}</th>
                                    <th style={{ padding: '12px', textAlign: 'center', width: '120px' }}>{ACTIONS.ACTIONS}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.expiringPlayers.map((player) => {
                                    const badge = getStatusBadge(player.contractEndWeek);
                                    return (
                                        <tr key={player.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '12px', fontWeight: '600' }}>{player.name}</td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                <span style={{ 
                                                    background: 'var(--border)', 
                                                    padding: '4px 10px', 
                                                    borderRadius: '6px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: '600'
                                                }}>
                                                    {player.naturalPosition}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>{player.age}</td>
                                            <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>
                                                {formatCurrency(player.weeklyWage)}/wk
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>
                                                {player.contractEndWeek} weeks
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                <span style={{
                                                    background: badge.color,
                                                    color: 'white',
                                                    padding: '4px 10px',
                                                    borderRadius: '20px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '600'
                                                }}>
                                                    {badge.label}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    onClick={() => handleRenew(player.id)}
                                                    disabled={renewingId === player.id}
                                                >
                                                    {renewingId === player.id ? '⏳ Processing...' : CONTRACTS.RENEW_CONTRACT}
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Mobile Cards */}
                <div className="md:hidden flex flex-col gap-3">
                    {data?.expiringPlayers.map((player) => {
                        const badge = getStatusBadge(player.contractEndWeek);
                        return (
                            <div key={player.id} className="card" style={{ padding: '14px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <div style={{ fontWeight: '700', fontSize: '1.05rem' }}>{player.name}</div>
                                    <span style={{
                                        background: badge.color,
                                        color: 'white',
                                        padding: '4px 10px',
                                        borderRadius: '20px',
                                        fontSize: '0.75rem',
                                        fontWeight: '600'
                                    }}>
                                        {badge.label}
                                    </span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '12px' }}>
                                    <div>{CONTRACTS.POSITION}: <strong style={{ color: 'var(--foreground)' }}>{player.naturalPosition}</strong></div>
                                    <div>{CONTRACTS.AGE}: <strong style={{ color: 'var(--foreground)' }}>{player.age}</strong></div>
                                    <div>{CONTRACTS.WAGE}: <strong style={{ color: 'var(--foreground)' }}>{formatCurrency(player.weeklyWage)}</strong></div>
                                    <div>{CONTRACTS.WEEKS_LEFT}: <strong style={{ color: 'var(--danger)' }}>{player.contractEndWeek} weeks</strong></div>
                                </div>
                                <Button
                                    variant="primary"
                                    fullWidth
                                    onClick={() => handleRenew(player.id)}
                                    disabled={renewingId === player.id}
                                >
                                    {renewingId === player.id ? '⏳ Processing...' : CONTRACTS.RENEW_CONTRACT}
                                </Button>
                            </div>
                        );
                    })}
                </div>
            </Card>
        </div>
    );
}
