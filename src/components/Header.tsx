'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatDateLong } from '@/lib/dateFormat';

interface HeaderProps {
    onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
    const [gameDate, setGameDate] = useState<string>('');

    useEffect(() => {
        const fetchDate = async () => {
            const res = await fetch('/api/game/info');
            const data = await res.json();
            if (data.currentDate) {
                const date = new Date(data.currentDate);
                // Use AD (Gregorian) format with English locale
                setGameDate(formatDateLong(date));
            }
        };
        fetchDate();

        // Listen for date updates (optional enhancement)
        window.addEventListener('game-date-updated', fetchDate);
        return () => window.removeEventListener('game-date-updated', fetchDate);
    }, []);

    return (
        <header className="sticky top-0 z-50 flex h-[var(--header-height)] items-center justify-between border-b border-[var(--border)] bg-white px-4 shadow-sm md:px-6">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onMenuClick}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border)] text-xl md:hidden"
                    aria-label="Open navigation menu"
                >
                    ☰
                </button>

                <Link href="/" className="flex items-center gap-2 text-base font-bold text-[var(--foreground)] md:text-lg">
                    <span className="text-xl md:text-2xl">⚽</span>
                    <span className="hidden sm:inline">Football Manager</span>
                    <span className="sm:hidden">FM</span>
                </Link>
            </div>

            {gameDate && (
                <div className="hidden items-center gap-2 rounded-full border border-[var(--primary)] bg-[var(--primary-light)] px-3 py-1 text-xs font-semibold text-[var(--primary)] sm:flex md:gap-3 md:px-4 md:py-2 md:text-sm">
                    <span className="text-base md:text-lg">📅</span>
                    <span>{gameDate}</span>
                </div>
            )}
        </header>
    );
}
