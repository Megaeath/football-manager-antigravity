'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { NEWS, ACTIONS } from '@/lib/constants/uiLabels';

interface NewsItem {
  id: string;
  title: string;
  content: string;
  date: string;
  type: string;
}

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch('/api/news');
        if (!res.ok) throw new Error('Failed to load news');
        const data = await res.json();
        setNews(data.news || []);
      } catch (err) {
        console.error('Error loading news:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

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
