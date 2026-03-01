'use client';

import React, { useState, useEffect } from 'react';

type NewsItem = {
    id: string;
    title: string;
    content: string;
    date: string;
    type: string;
};

export default function NewsPage() {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNews = async () => {
            try {
                // Get user info first to fetch team-specific news + global news
                const userRes = await fetch('/api/game/info');
                const userData = await userRes.json();

                const newsRes = await fetch(`/api/news${userData.userTeamId ? `?teamId=${userData.userTeamId}` : ''}`);
                if (newsRes.ok) {
                    const data = await newsRes.json();
                    setNews(data.news);
                }
            } catch (error) {
                console.error('Failed to fetch news', error);
            } finally {
                setLoading(false);
            }
        };
        fetchNews();
    }, []);

    const formatDate = (dateString: string) => {
        const d = new Date(dateString);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
            <h1 style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5em' }}>📰</span> Global News Center
            </h1>

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
                                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text)' }}>{item.title}</h3>
                                <p style={{ margin: 0, color: 'var(--muted)', lineHeight: '1.5' }}>{item.content}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
