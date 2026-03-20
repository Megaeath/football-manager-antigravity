'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { NEWS } from '@/lib/constants/uiLabels';

interface NewsItem {
  id: string;
  title: string;
  content: string;
  date: string;
  type: string;
}

interface IncomingBidItem {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
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
}

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [incomingBids, setIncomingBids] = useState<IncomingBidItem[]>([]);
  const [userTeamId, setUserTeamId] = useState('');
  const [loading, setLoading] = useState(true);
  const [processingBidId, setProcessingBidId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchNewsAndBids = async (teamId?: string) => {
    const activeTeamId = teamId || userTeamId;

    const newsUrl = activeTeamId
      ? `/api/news?teamId=${activeTeamId}`
      : '/api/news';

    const newsRes = await fetch(newsUrl);
    if (!newsRes.ok) throw new Error('Failed to load news');
    const newsData = await newsRes.json();
    setNews(newsData.news || []);

    if (activeTeamId) {
      const bidsRes = await fetch(`/api/market/incoming-bids?teamId=${activeTeamId}`);
      if (bidsRes.ok) {
        const bidsData = await bidsRes.json();
        setIncomingBids(bidsData.bids || []);
      }
    }
  };

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const gameInfoRes = await fetch('/api/game/info');
        const gameInfo = gameInfoRes.ok ? await gameInfoRes.json() : null;
        const teamId = gameInfo?.userTeamId || '';
        setUserTeamId(teamId);

        await fetchNewsAndBids(teamId);
      } catch (err) {
        console.error('Error loading news:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString()}`;
  };

  const handleBidAction = async (bidId: string, action: 'ACCEPT' | 'REJECT') => {
    try {
      setProcessingBidId(bidId);
      setActionMessage(null);

      const res = await fetch('/api/market/manage-bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidId, action })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to manage bid');
      }

      setActionMessage(data?.message || 'Bid updated successfully.');
      await fetchNewsAndBids();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to manage bid';
      setActionMessage(message);
    } finally {
      setProcessingBidId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  if (loading) return (
    <div className="p-4 text-center" style={{ padding: '2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '1.5rem' }}>📰 Loading news...</div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Header */}
      <div className="hero-gradient">
        <h1 className="text-2xl md:text-4xl" style={{ margin: 0 }}>📰 {NEWS.TITLE}</h1>
        <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9 }}>Latest updates from the football world</p>
      </div>

      {/* Incoming Bids (Action Required) */}
      <Card>
        <CardHeader>
          <CardTitle>📨 Incoming Transfer Offers ({incomingBids.length})</CardTitle>
        </CardHeader>

        {actionMessage && (
          <div style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            background: 'rgba(59, 130, 246, 0.1)',
            color: 'var(--foreground)',
            fontSize: '0.9rem'
          }}>
            {actionMessage}
          </div>
        )}

        {incomingBids.length === 0 ? (
          <div className="p-lg text-center text-muted" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--muted)' }}>
            No pending incoming offers.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {incomingBids.map((bid) => (
              <div key={bid.id} className="card" style={{ padding: '1rem', borderLeft: '4px solid #f59e0b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {bid.fromTeam.name} offered {formatCurrency(bid.amount)} for {bid.player.name}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '0.3rem' }}>
                      {bid.player.naturalPosition} • Age {bid.player.age} • {new Date(bid.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={processingBidId === bid.id}
                      onClick={() => handleBidAction(bid.id, 'ACCEPT')}
                    >
                      {processingBidId === bid.id ? 'Processing...' : 'Accept'}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={processingBidId === bid.id}
                      onClick={() => handleBidAction(bid.id, 'REJECT')}
                    >
                      {processingBidId === bid.id ? 'Processing...' : 'Reject'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* News List */}
      <Card>
        <CardHeader>
          <CardTitle>📋 Latest News</CardTitle>
        </CardHeader>

        {news.length === 0 ? (
          <div className="p-lg text-center text-muted" style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
            {NEWS.NO_NEWS}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {news.map((item, index) => (
              <div 
                key={item.id}
                className="card"
                style={{ 
                  padding: '1.5rem',
                  borderLeft: index === 0 ? '4px solid var(--primary)' : '1px solid var(--border)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>{item.title}</h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{formatDate(item.date)}</span>
                </div>
                <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.6, fontSize: '0.95rem' }}>
                  {item.content.length > 300 ? `${item.content.substring(0, 300)}...` : item.content}
                </p>
                <div style={{ marginTop: '1rem' }}>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    padding: '3px 10px', 
                    borderRadius: '12px',
                    background: 'var(--primary-light)',
                    color: 'var(--primary)',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}>
                    {item.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
