'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import PlayerModal from '@/components/PlayerModal';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MARKET } from '@/lib/constants/uiLabels';

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
        <Suspense fallback={<div className="p-4 text-center">Loading...</div>}>
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
            case 'PENDING': return { bg: 'rgba(251, 191, 36, 0.1)', color: '#d97706' };
            case 'ACCEPTED': return { bg: 'rgba(16, 185, 129, 0.1)', color: '#059669' };
            case 'REJECTED': return { bg: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' };
            case 'HIJACKED': return { bg: 'rgba(99, 102, 241, 0.1)', color: '#4f46e5' };
            default: return { bg: 'var(--border)', color: 'var(--muted)' };
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

    if (loading) {
        return (
            <div className="p-4 text-center" style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem' }}>💱 Loading transfer market...</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 md:gap-8">
            {/* Header */}
            <div className="hero-gradient">
                <h1 className="text-2xl md:text-4xl" style={{ margin: 0 }}>💱 {MARKET.TITLE}</h1>
                <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9 }}>Track all transfer activity across the league</p>
            </div>

            {/* Season Selector */}
            {availableSeasons.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>📅 Select Season</CardTitle>
                    </CardHeader>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {availableSeasons.map(season => (
                            <Button
                                key={season}
                                variant={selectedSeason === season ? 'primary' : 'ghost'}
                                size="sm"
                                onClick={() => handleSeasonChange(season)}
                            >
                                Season {season} {season === currentSeason ? '(Current)' : ''}
                            </Button>
                        ))}
                    </div>
                </Card>
            )}

            {/* Bids Table */}
            <Card>
                <CardHeader>
                    <CardTitle>📋 Recent Bids ({bids.length})</CardTitle>
                </CardHeader>

                {bids.length === 0 ? (
                    <div className="p-lg text-center text-muted" style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                        No bids found for this season
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Player</th>
                                        <th style={{ padding: '12px', textAlign: 'center', width: '80px', fontWeight: 'bold' }}>Pos</th>
                                        <th style={{ padding: '12px', textAlign: 'center', width: '70px', fontWeight: 'bold' }}>Age</th>
                                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>From</th>
                                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>To</th>
                                        <th style={{ padding: '12px', textAlign: 'center', width: '120px', fontWeight: 'bold' }}>Amount</th>
                                        <th style={{ padding: '12px', textAlign: 'center', width: '100px', fontWeight: 'bold' }}>Status</th>
                                        <th style={{ padding: '12px', textAlign: 'center', width: '100px', fontWeight: 'bold' }}>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bids.map((bid) => {
                                        const statusStyle = getStatusStyle(bid.status);
                                        return (
                                            <tr key={bid.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '12px' }}>
                                                    <button
                                                        onClick={() => openPlayerModal(bid.player.id)}
                                                        style={{ color: 'var(--primary)', textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', fontWeight: '600' }}
                                                    >
                                                        {bid.player.name}
                                                    </button>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                                                        ⚡ {bid.player.avgRating > 0 ? bid.player.avgRating.toFixed(2) : '-'} | ⚽ {bid.player.goals} | 🎯 {bid.player.assists}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                                    <span style={{ background: 'var(--border)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: '600' }}>
                                                        {bid.player.naturalPosition}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}>{bid.player.age}</td>
                                                <td style={{ padding: '12px', fontSize: '0.9rem' }}>{bid.fromTeam.name}</td>
                                                <td style={{ padding: '12px', fontSize: '0.9rem', color: bid.toTeam ? 'var(--foreground)' : 'var(--muted)' }}>
                                                    {bid.toTeam?.name || 'Free Agent'}
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: 'var(--primary)' }}>
                                                    {formatCurrency(bid.amount)}
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                                    <span style={{
                                                        background: statusStyle.bg,
                                                        color: statusStyle.color,
                                                        padding: '4px 10px',
                                                        borderRadius: '12px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: '600'
                                                    }}>
                                                        {bid.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--muted)' }}>
                                                    {new Date(bid.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden flex flex-col gap-3">
                            {bids.map((bid) => {
                                const statusStyle = getStatusStyle(bid.status);
                                return (
                                    <div key={bid.id} className="card" style={{ padding: '14px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                            <div style={{ fontWeight: '700', fontSize: '1.05rem' }}>{bid.player.name}</div>
                                            <span style={{
                                                background: statusStyle.bg,
                                                color: statusStyle.color,
                                                padding: '4px 10px',
                                                borderRadius: '12px',
                                                fontSize: '0.75rem',
                                                fontWeight: '600'
                                            }}>
                                                {bid.status}
                                            </span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '10px' }}>
                                            <div>Pos: <strong>{bid.player.naturalPosition}</strong></div>
                                            <div>Age: <strong>{bid.player.age}</strong></div>
                                            <div>From: <strong>{bid.fromTeam.name}</strong></div>
                                            <div>To: <strong>{bid.toTeam?.name || 'Free Agent'}</strong></div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                                                {new Date(bid.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </div>
                                            <div style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '1.1rem' }}>
                                                {formatCurrency(bid.amount)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={currentPage === 1}
                                    onClick={() => handlePageChange(currentPage - 1)}
                                >
                                    ← Previous
                                </Button>
                                <span style={{ padding: '6px 12px', fontWeight: '600' }}>
                                    Page {currentPage} of {totalPages}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={currentPage === totalPages}
                                    onClick={() => handlePageChange(currentPage + 1)}
                                >
                                    Next →
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </Card>

            {/* Player Modal */}
            {(() => {
                const playerId = searchParams.get('playerId');
                if (playerId) return <PlayerModal />;
                return null;
            })()}
        </div>
    );
}

function formatCurrency(num: number) {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
    return `$${num.toLocaleString()}`;
}
