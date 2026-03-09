'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PlayerModal from '@/components/PlayerModal';

type NewsItem = {
    id: string;
    title: string;
    content: string;
    date: string;
    type: string;
};

type TopHotPlayer = {
    playerId: string;
    name: string;
    popularity: number;
    team: { id: string; name: string } | null;
    bidCount: number;
    activeBidCount: number;
    transferCount: number;
    lastActivityAt: string | null;
};

type IncomingBid = {
    id: string;
    amount: number;
    createdAt: string;
    windowEnds: string;
    player: {
        id: string;
        name: string;
        naturalPosition: string;
        age: number;
    };
    fromTeam: {
        id: string;
        name: string;
        reputation: number;
    };
};

type ModalState = {
    isOpen: boolean;
    action: 'accept' | 'reject' | 'negotiate' | null;
    bid: IncomingBid | null;
};

export default function NewsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedPlayerId = searchParams.get('playerId');

    const [news, setNews] = useState<NewsItem[]>([]);
    const [incomingBids, setIncomingBids] = useState<IncomingBid[]>([]);
    const [topHotPlayers, setTopHotPlayers] = useState<TopHotPlayer[]>([]);
    const [loading, setLoading] = useState(true);
    const [userTeamId, setUserTeamId] = useState('');
    const [modal, setModal] = useState<ModalState>({ isOpen: false, action: null, bid: null });
    const [counterAmount, setCounterAmount] = useState<number>(0);
    const [processing, setProcessing] = useState(false);
    const [knownTransferPlayers, setKnownTransferPlayers] = useState<Array<{ id: string; name: string }>>([]);

    const aiIncomingOffersCount = incomingBids.filter(b => b.fromTeam.id !== userTeamId).length;
    const newsNotiPlayerCount = new Set<string>([
        ...topHotPlayers.map(p => p.playerId),
        ...incomingBids.filter(b => b.fromTeam.id !== userTeamId).map(b => b.player.id)
    ]).size;

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Get user info first to fetch team-specific news + global news
            const userRes = await fetch('/api/game/info');
            const userData = await userRes.json();
            setUserTeamId(userData.userTeamId);

            const newsRes = await fetch(`/api/news${userData.userTeamId ? `?teamId=${userData.userTeamId}` : ''}`);
            if (newsRes.ok) {
                const data = await newsRes.json();
                setNews(data.news);
            }

            // Fetch incoming bids
            if (userData.userTeamId) {
                const bidsRes = await fetch(`/api/market/incoming-bids?teamId=${userData.userTeamId}`);
                if (bidsRes.ok) {
                    const bidsData = await bidsRes.json();
                    setIncomingBids(bidsData.bids || []);
                }
            }

            // Fetch top-10 popularity transfer spotlight
            const spotlightRes = await fetch('/api/news/transfer-spotlight');
            if (spotlightRes.ok) {
                const spotlightData = await spotlightRes.json();
                setTopHotPlayers(spotlightData.hotPlayers || []);
            }

            // Build list of transfer-related players for clickable names in news feed
            const season = userData.currentSeason ? `&season=${userData.currentSeason}` : '';
            const marketPlayersRes = await fetch(`/api/market/bids?limit=300${season}`);
            if (marketPlayersRes.ok) {
                const marketPlayersData = await marketPlayersRes.json();
                const fromBids = (marketPlayersData?.bids || [])
                    .map((b: any) => b?.player)
                    .filter((p: any) => p?.id && p?.name)
                    .map((p: any) => ({ id: p.id as string, name: p.name as string }));

                const fromIncoming = incomingBids.map((b) => ({ id: b.player.id, name: b.player.name }));
                const fromTopHot = topHotPlayers.map((p) => ({ id: p.playerId, name: p.name }));

                const uniqueMap = new Map<string, { id: string; name: string }>();
                for (const p of [...fromBids, ...fromIncoming, ...fromTopHot]) {
                    uniqueMap.set(p.id, p);
                }
                setKnownTransferPlayers(Array.from(uniqueMap.values()));
            }
        } catch (error) {
            console.error('Failed to fetch news', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const d = new Date(dateString);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const openPlayerModal = (playerId: string) => {
        router.push(`/news?playerId=${playerId}`);
    };

    const renderTextWithPlayerLinks = (text: string, keyPrefix: string) => {
        if (!text || knownTransferPlayers.length === 0) return text;

        const sortedNames = [...knownTransferPlayers]
            .sort((a, b) => b.name.length - a.name.length)
            .map((p) => p.name)
            .filter(Boolean);

        if (sortedNames.length === 0) return text;

        const escaped = sortedNames
            .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('|');

        if (!escaped) return text;

        const regex = new RegExp(`(${escaped})`, 'gi');
        const parts = text.split(regex);

        return parts.map((part, i) => {
            const matched = knownTransferPlayers.find((p) => p.name.toLowerCase() === part.toLowerCase());
            if (!matched) return <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>;

            return (
                <button
                    key={`${keyPrefix}-${i}`}
                    onClick={() => openPlayerModal(matched.id)}
                    style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        margin: 0,
                        color: 'var(--primary)',
                        fontWeight: 700,
                        textDecoration: 'underline',
                        cursor: 'pointer'
                    }}
                >
                    {part}
                </button>
            );
        });
    };

    const openModal = (action: 'accept' | 'reject' | 'negotiate', bid: IncomingBid) => {
        setModal({ isOpen: true, action, bid });
        if (action === 'negotiate') {
            setCounterAmount(Math.ceil(bid.amount * 1.15)); // Default to 15% higher
        }
    };

    const closeModal = () => {
        setModal({ isOpen: false, action: null, bid: null });
        setCounterAmount(0);
    };

    const handleConfirmAction = async () => {
        if (!modal.bid || !modal.action) return;

        setProcessing(true);
        try {
            const body: Record<string, unknown> = {
                bidId: modal.bid.id,
                action: modal.action.toUpperCase()
            };

            if (modal.action === 'negotiate') {
                body.counterAmount = counterAmount;
            }

            const res = await fetch('/api/market/manage-bid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (res.ok && data.success) {
                alert(data.message);
                closeModal();
                fetchData(); // Refresh data
            } else {
                alert(data.error || data.message || 'Failed to process bid');
                if (data.aiRejected) {
                    closeModal();
                    fetchData();
                }
            }
        } catch (error) {
            console.error('Error managing bid:', error);
            alert('An error occurred while processing the bid');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
            <h1 style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5em' }}>📰</span> News Center
                {newsNotiPlayerCount > 0 && (
                    <span style={{
                        background: '#111827',
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '99px'
                    }}>
                        🔔 {newsNotiPlayerCount}
                    </span>
                )}
                {aiIncomingOffersCount > 0 && (
                    <span style={{
                        background: 'var(--primary)',
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '99px',
                        marginLeft: '0.5rem'
                    }}>
                        {aiIncomingOffersCount} AI Offer{aiIncomingOffersCount > 1 ? 's' : ''}
                    </span>
                )}
                {topHotPlayers.length > 0 && (
                    <span style={{
                        background: '#ef4444',
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '99px'
                    }}>
                        🔥 Top10 Buzz: {topHotPlayers.length}
                    </span>
                )}
            </h1>

            {(topHotPlayers.length > 0 || aiIncomingOffersCount > 0) && (
                <div style={{ marginTop: '-1rem', marginBottom: '1.25rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
                    Notification includes <strong>{topHotPlayers.length}</strong> top-10 transfer-active players and <strong>{aiIncomingOffersCount}</strong> AI incoming offers for your team.
                </div>
            )}

            {/* Top-10 Popularity Transfer Activity */}
            {topHotPlayers.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                    <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>🔥</span> Top 10 Popular Players - Transfer Activity
                    </h2>
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                        {topHotPlayers.map((p) => (
                            <div
                                key={p.playerId}
                                className="card"
                                style={{
                                    padding: '1rem 1.25rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    border: '1px solid rgba(239,68,68,0.35)'
                                }}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <button
                                        onClick={() => openPlayerModal(p.playerId)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            padding: 0,
                                            textAlign: 'left',
                                            color: 'var(--primary)',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            textDecoration: 'underline'
                                        }}
                                    >
                                        {p.name}
                                    </button>
                                    <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                                        {p.team?.name || 'Free Agent'} • Popularity {p.popularity}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    {p.activeBidCount > 0 && (
                                        <span style={{ background: '#7c3aed', color: 'white', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '99px' }}>
                                            {p.activeBidCount} active bids
                                        </span>
                                    )}
                                    {p.bidCount > 0 && (
                                        <span style={{ background: '#0ea5e9', color: 'white', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '99px' }}>
                                            {p.bidCount} total bids
                                        </span>
                                    )}
                                    {p.transferCount > 0 && (
                                        <span style={{ background: '#10b981', color: 'white', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '99px' }}>
                                            {p.transferCount} transfers
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Incoming Bids Section */}
            {incomingBids.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                    <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>💰</span> Incoming Transfer Offers
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {incomingBids.map((bid) => (
                            <div key={bid.id} className="card" style={{
                                padding: '1.5rem',
                                border: '2px solid var(--primary)',
                                background: 'linear-gradient(135deg, var(--bg) 0%, rgba(var(--primary-rgb), 0.05) 100%)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: '250px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <button
                                                onClick={() => openPlayerModal(bid.player.id)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    padding: 0,
                                                    margin: 0,
                                                    color: 'var(--text)',
                                                    fontSize: '1.05rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    textDecoration: 'underline'
                                                }}
                                            >
                                                {bid.player.name}
                                            </button>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                padding: '0.2rem 0.5rem',
                                                background: 'var(--bg)',
                                                borderRadius: '4px',
                                                color: 'var(--muted)'
                                            }}>
                                                {bid.player.naturalPosition} • {bid.player.age}y
                                            </span>
                                        </div>
                                        <p style={{ margin: '0.5rem 0', color: 'var(--muted)' }}>
                                            <strong>{bid.fromTeam.name}</strong> is offering <strong style={{ color: 'var(--primary)' }}>${bid.amount.toLocaleString()}</strong>
                                        </p>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>
                                            Offer expires: {formatDate(bid.windowEnds)}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <button
                                            onClick={() => openModal('accept', bid)}
                                            className="btn"
                                            style={{
                                                background: '#10b981',
                                                color: 'white',
                                                border: 'none',
                                                padding: '0.5rem 1rem',
                                                fontSize: '0.9rem'
                                            }}
                                        >
                                            ✅ Accept
                                        </button>
                                        <button
                                            onClick={() => openModal('negotiate', bid)}
                                            className="btn"
                                            style={{
                                                background: '#f59e0b',
                                                color: 'white',
                                                border: 'none',
                                                padding: '0.5rem 1rem',
                                                fontSize: '0.9rem'
                                            }}
                                        >
                                            💰 Negotiate
                                        </button>
                                        <button
                                            onClick={() => openModal('reject', bid)}
                                            className="btn"
                                            style={{
                                                background: '#ef4444',
                                                color: 'white',
                                                border: 'none',
                                                padding: '0.5rem 1rem',
                                                fontSize: '0.9rem'
                                            }}
                                        >
                                            ❌ Reject
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* News Section */}
            <h2 style={{ marginBottom: '1rem' }}>Latest News</h2>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
                    Loading latest news...
                </div>
            ) : news.length === 0 ? (
                <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                    No news to report at this time.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {news.map((item) => (
                        <div key={item.id} className="card" style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                            <div style={{
                                minWidth: '80px',
                                textAlign: 'center',
                                padding: '0.5rem',
                                background: 'var(--bg)',
                                borderRadius: '8px',
                                fontSize: '0.85rem',
                                fontWeight: 'bold',
                                color: 'var(--primary)'
                            }}>
                                {formatDate(item.date)}
                            </div>
                            <div>
                                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text)' }}>
                                    {renderTextWithPlayerLinks(item.title, `title-${item.id}`)}
                                </h3>
                                <p style={{ margin: 0, color: 'var(--muted)', lineHeight: '1.5' }}>
                                    {renderTextWithPlayerLinks(item.content, `content-${item.id}`)}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Confirmation Modal */}
            {modal.isOpen && modal.bid && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '1rem'
                    }}
                    onClick={closeModal}
                >
                    <div
                        className="card"
                        style={{
                            maxWidth: '500px',
                            width: '100%',
                            padding: '2rem',
                            position: 'relative'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>
                            {modal.action === 'accept' && '✅ Accept Offer'}
                            {modal.action === 'reject' && '❌ Reject Offer'}
                            {modal.action === 'negotiate' && '💰 Counter Offer'}
                        </h2>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <p style={{ margin: '0.5rem 0' }}>
                                <strong>Player:</strong> {modal.bid.player.name} ({modal.bid.player.naturalPosition})
                            </p>
                            <p style={{ margin: '0.5rem 0' }}>
                                <strong>From:</strong> {modal.bid.fromTeam.name}
                            </p>
                            <p style={{ margin: '0.5rem 0' }}>
                                <strong>Original Offer:</strong> <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>${modal.bid.amount.toLocaleString()}</span>
                            </p>
                        </div>

                        {modal.action === 'negotiate' && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                                    Counter Offer Amount:
                                </label>
                                <input
                                    type="number"
                                    value={counterAmount}
                                    onChange={(e) => setCounterAmount(parseInt(e.target.value) || 0)}
                                    min={modal.bid.amount + 1}
                                    step={100000}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border)',
                                        background: 'var(--bg)',
                                        fontSize: '1rem',
                                        fontWeight: 'bold',
                                        color: 'var(--primary)'
                                    }}
                                />
                                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                                    Must be higher than ${modal.bid.amount.toLocaleString()}
                                </p>
                                <p style={{ fontSize: '0.85rem', color: counterAmount > modal.bid.fromTeam.reputation * 100000 ? '#ef4444' : 'var(--muted)', marginTop: '0.25rem' }}>
                                    {modal.bid.fromTeam.name}'s budget may be limited (Rep: {modal.bid.fromTeam.reputation})
                                </p>
                            </div>
                        )}

                        {modal.action === 'accept' && (
                            <div style={{
                                padding: '1rem',
                                background: 'rgba(16, 185, 129, 0.1)',
                                borderRadius: '8px',
                                marginBottom: '1.5rem',
                                border: '1px solid rgba(16, 185, 129, 0.3)'
                            }}>
                                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                                    ✓ You will receive <strong>${modal.bid.amount.toLocaleString()}</strong>
                                    <br />
                                    ✓ {modal.bid.player.name} will transfer to {modal.bid.fromTeam.name} when the window closes
                                </p>
                            </div>
                        )}

                        {modal.action === 'reject' && (
                            <div style={{
                                padding: '1rem',
                                background: 'rgba(239, 68, 68, 0.1)',
                                borderRadius: '8px',
                                marginBottom: '1.5rem',
                                border: '1px solid rgba(239, 68, 68, 0.3)'
                            }}>
                                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                                    ⚠️ This offer will be permanently rejected
                                    <br />
                                    ⚠️ {modal.bid.player.name} will remain in your squad
                                </p>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={closeModal}
                                className="btn"
                                disabled={processing}
                                style={{
                                    background: 'var(--bg)',
                                    border: '1px solid var(--border)'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmAction}
                                className="btn"
                                disabled={processing || (modal.action === 'negotiate' && counterAmount <= modal.bid.amount)}
                                style={{
                                    background: modal.action === 'accept' ? '#10b981' : modal.action === 'negotiate' ? '#f59e0b' : '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    opacity: processing ? 0.6 : 1
                                }}
                            >
                                {processing ? 'Processing...' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedPlayerId && <PlayerModal />}
        </div>
    );
}
