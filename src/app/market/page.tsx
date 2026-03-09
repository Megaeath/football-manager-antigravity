'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import PlayerModal from '@/components/PlayerModal';

type BidItem = {
    id: string;
    amount: number;
    status: string;
    isFreeAgent: boolean;
    createdAt: string;
    windowEnds: string;
    season: number;
    player: {
        id: string;
        name: string;
        naturalPosition: string;
        transferStatus: string;
        age: number;
        avgRating: number;
        goals: number;
        assists: number;
    };
    fromTeam: { id: string; name: string };
    toTeam: { id: string; name: string } | null;
};

export default function MarketCenterPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <MarketCenterContent />
        </Suspense>
    );
}

function MarketCenterContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [bids, setBids] = useState<BidItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [userTeamId, setUserTeamId] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
    const [availableSeasons, setAvailableSeasons] = useState<number[]>([]);
    const [currentSeason, setCurrentSeason] = useState(1);

    useEffect(() => {
        const fetchMarketData = async () => {
            setLoading(true);
            try {
                const userRes = await fetch('/api/game/info');
                const userData = await userRes.json();
                setUserTeamId(userData.userTeamId);
                setCurrentSeason(userData.currentSeason);

                const seasonParam = selectedSeason !== null ? `&season=${selectedSeason}` : `&season=${userData.currentSeason}`;
                const bidsRes = await fetch(`/api/market/bids?page=${currentPage}&limit=20${seasonParam}`);
                if (bidsRes.ok) {
                    const data = await bidsRes.json();
                    setBids(data.bids);
                    setTotalPages(data.totalPages);
                    setAvailableSeasons(data.availableSeasons);
                    if (selectedSeason === null && data.availableSeasons.length > 0) {
                        setSelectedSeason(data.availableSeasons[0]);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch market data', error);
            } finally {
                setLoading(false);
            }
        };
        fetchMarketData();
    }, [currentPage, selectedSeason]);

    const openPlayerModal = (playerId: string) => {
        router.push(`/market?playerId=${playerId}`);
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'PENDING': return { bg: '#fef3c7', color: '#d97706' };
            case 'ACCEPTED': return { bg: '#d1fae5', color: '#059669' };
            case 'REJECTED': return { bg: '#fee2e2', color: '#dc2626' };
            case 'HIJACKED': return { bg: '#e0e7ff', color: '#4f46e5' };
            default: return { bg: 'var(--bg)', color: 'var(--muted)' };
        }
    };

    const handleSeasonChange = (season: number) => {
        setSelectedSeason(season);
        setCurrentPage(1);
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }} className="p-4 md:p-8">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }} className="mb-6 flex-col items-start gap-3 md:mb-8 md:flex-row md:items-center">
                <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
                    <span style={{ fontSize: '1.2em' }}>💱</span> Transfer Market Center
                </h1>
                <Link href="/news" className="btn" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    View Market News
                </Link>
            </div>

            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }} className="flex-col items-start gap-3 md:flex-row md:items-center">
                    <h2 style={{ margin: 0 }}>Active & Recent Deals</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Season:</label>
                        <select
                            value={selectedSeason || currentSeason}
                            onChange={(e) => handleSeasonChange(parseInt(e.target.value))}
                            style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)' }}
                        >
                            {availableSeasons.map(season => (
                                <option key={season} value={season}>Season {season}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>Loading market data...</div>
                ) : bids.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>No transfers or bids to show.</div>
                ) : (
                    <>
                    <div className="hidden overflow-x-auto md:block" style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--muted)', fontSize: '0.85rem' }}>
                                    <th style={{ padding: '1rem 0.5rem' }}>Date</th>
                                    <th style={{ padding: '1rem 0.5rem' }}>Player</th>
                                    <th style={{ padding: '1rem 0.5rem' }}>From Club</th>
                                    <th style={{ padding: '1rem 0.5rem' }}>Bidding Club</th>
                                    <th style={{ padding: '1rem 0.5rem' }}>Amount</th>
                                    <th style={{ padding: '1rem 0.5rem' }}>Status</th>
                                    <th style={{ padding: '1rem 0.5rem' }}>Decision Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bids.map((bid) => {
                                    const styles = getStatusStyle(bid.status);
                                    return (
                                        <tr key={bid.id} style={{ borderBottom: '1px solid var(--bg)', transition: 'background 0.2s', ...((bid.fromTeam.id === userTeamId || bid.toTeam?.id === userTeamId) ? { background: 'var(--primary-light)' } : {}) }}>
                                            <td style={{ padding: '1rem 0.5rem', fontSize: '0.9rem' }}>
                                                {new Date(bid.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                            </td>
                                            <td
                                                style={{ padding: '1rem 0.5rem', fontWeight: 'bold', cursor: 'pointer' }}
                                                onClick={() => openPlayerModal(bid.player.id)}
                                            >
                                                <span style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                                                    {bid.player.name}
                                                </span>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 'normal' }}>
                                                    {bid.player.naturalPosition} {bid.isFreeAgent ? '(Free Agent)' : ''}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 'normal', marginTop: '0.25rem' }}>
                                                    Age {bid.player.age} • Avg {Number(bid.player.avgRating || 0).toFixed(2)} • G {bid.player.goals || 0} • A {bid.player.assists || 0}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem 0.5rem' }}>
                                                {bid.isFreeAgent || !bid.toTeam ? (
                                                    '-'
                                                ) : (
                                                    <Link
                                                        href={`/team/${bid.toTeam.id}`}
                                                        style={{ color: 'var(--primary)', textDecoration: 'underline', fontWeight: 600 }}
                                                    >
                                                        {bid.toTeam.name}
                                                    </Link>
                                                )}
                                            </td>
                                            <td style={{ padding: '1rem 0.5rem', fontWeight: 'bold' }}>
                                                <Link
                                                    href={`/team/${bid.fromTeam.id}`}
                                                    style={{ color: 'var(--primary)', textDecoration: 'underline', fontWeight: 700 }}
                                                >
                                                    {bid.fromTeam.name}
                                                </Link>
                                            </td>
                                            <td style={{ padding: '1rem 0.5rem', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--primary)' }}>
                                                {bid.isFreeAgent ? 'Free Transfer' : `$${bid.amount.toLocaleString()}`}
                                            </td>
                                            <td style={{ padding: '1rem 0.5rem' }}>
                                                <span style={{
                                                    padding: '0.25rem 0.75rem',
                                                    borderRadius: '99px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 'bold',
                                                    background: styles.bg,
                                                    color: styles.color
                                                }}>
                                                    {bid.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem 0.5rem', fontSize: '0.9rem', color: bid.status === 'PENDING' || bid.status === 'HIJACKED' ? 'var(--text)' : 'var(--muted)' }}>
                                                {new Date(bid.windowEnds).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-col gap-3 md:hidden">
                        {bids.map((bid) => {
                            const styles = getStatusStyle(bid.status);
                            const isUserRelated = bid.fromTeam.id === userTeamId || bid.toTeam?.id === userTeamId;
                            return (
                                <div
                                    key={bid.id}
                                    className="rounded-xl border p-3"
                                    style={{
                                        borderColor: 'var(--border)',
                                        background: isUserRelated ? 'var(--primary-light)' : 'var(--card-bg)'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <div
                                            style={{ fontWeight: 'bold', color: 'var(--primary)', textDecoration: 'underline', cursor: 'pointer' }}
                                            onClick={() => openPlayerModal(bid.player.id)}
                                        >
                                            {bid.player.name}
                                        </div>
                                        <span style={{
                                            padding: '0.25rem 0.65rem',
                                            borderRadius: '99px',
                                            fontSize: '0.72rem',
                                            fontWeight: 'bold',
                                            background: styles.bg,
                                            color: styles.color
                                        }}>
                                            {bid.status}
                                        </span>
                                    </div>

                                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '8px' }}>
                                        {bid.player.naturalPosition} {bid.isFreeAgent ? '(Free Agent)' : ''}
                                    </div>

                                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '8px' }}>
                                        Age <strong>{bid.player.age}</strong> • Avg <strong>{Number(bid.player.avgRating || 0).toFixed(2)}</strong> • G <strong>{bid.player.goals || 0}</strong> • A <strong>{bid.player.assists || 0}</strong>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.85rem' }}>
                                        <div>Date: <strong>{new Date(bid.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</strong></div>
                                        <div>Decision: <strong>{new Date(bid.windowEnds).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</strong></div>
                                        <div>
                                            From:{' '}
                                            <strong>
                                                {bid.isFreeAgent || !bid.toTeam ? (
                                                    '-'
                                                ) : (
                                                    <Link href={`/team/${bid.toTeam.id}`} style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                                                        {bid.toTeam.name}
                                                    </Link>
                                                )}
                                            </strong>
                                        </div>
                                        <div>
                                            Bidder:{' '}
                                            <strong>
                                                <Link href={`/team/${bid.fromTeam.id}`} style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                                                    {bid.fromTeam.name}
                                                </Link>
                                            </strong>
                                        </div>
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            Amount: <strong style={{ color: 'var(--primary)' }}>{bid.isFreeAgent ? 'Free Transfer' : `$${bid.amount.toLocaleString()}`}</strong>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    </>
                )}

                {!loading && bids.length > 0 && totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }} className="flex-wrap">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="btn"
                            style={{ 
                                padding: '0.5rem 1rem',
                                opacity: currentPage === 1 ? 0.5 : 1,
                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                            }}
                        >
                            ← Previous
                        </button>
                        <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="btn"
                            style={{ 
                                padding: '0.5rem 1rem',
                                opacity: currentPage === totalPages ? 0.5 : 1,
                                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                            }}
                        >
                            Next →
                        </button>
                    </div>
                )}
            </div>

            <PlayerModal />
        </div>
    );
}
