'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Header() {
    const [gameDate, setGameDate] = useState<string>('');

    useEffect(() => {
        const fetchDate = async () => {
            const res = await fetch('/api/game/info');
            const data = await res.json();
            if (data.currentDate) {
                const date = new Date(data.currentDate);
                setGameDate(date.toLocaleDateString('th-TH', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                }));
            }
        };
        fetchDate();

        // Listen for date updates (optional enhancement)
        window.addEventListener('game-date-updated', fetchDate);
        return () => window.removeEventListener('game-date-updated', fetchDate);
    }, []);

    return (
        <header style={{
            height: 'var(--header-height)',
            background: 'white',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 50,
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
        }}>
            <Link href="/" style={{ color: 'var(--foreground)', fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.4rem' }}>🎮</span>
                <span>Football Manager Game</span>
            </Link>

            {gameDate && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: 'var(--primary-light)',
                    color: 'var(--primary)',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    border: '1px solid var(--primary)'
                }}>
                    <span style={{ fontSize: '1.2rem' }}>📅</span>
                    <span>{gameDate}</span>
                </div>
            )}
        </header>
    );
}
