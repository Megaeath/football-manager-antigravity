'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatDateLong } from '@/lib/dateFormat';
import NextProcessButton from '@/components/NextProcessButton';

interface HeaderProps {
    onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
    const [gameDate, setGameDate] = useState<string>('');
    const [season, setSeason] = useState<number>(1);
    const [userTeamName, setUserTeamName] = useState<string>('Your Club');
    const [loggingOut, setLoggingOut] = useState(false);

    useEffect(() => {
        const fetchDate = async () => {
            const res = await fetch('/api/game/info');
            const data = await res.json();
            if (data.currentDate) {
                const date = new Date(data.currentDate);
                // Use AD (Gregorian) format with English locale
                setGameDate(formatDateLong(date));
            }
            setSeason(Number(data.currentSeason || 1));
            setUserTeamName(data.userTeamName || 'Your Club');
        };
        fetchDate();

        // Listen for date updates (optional enhancement)
        window.addEventListener('game-date-updated', fetchDate);
        return () => window.removeEventListener('game-date-updated', fetchDate);
    }, []);

    return (
        <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-white shadow-md">
            <div className="hero-gradient px-4 py-4 md:px-6 md:py-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2 md:gap-3">
                        <button
                            type="button"
                            onClick={onMenuClick}
                            className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/40 bg-white/10 text-xl text-white backdrop-blur-sm md:hidden"
                            aria-label="Open navigation menu"
                        >
                            ☰
                        </button>

                        <div className="min-w-0">
                            <Link href="/" className="inline-flex items-center gap-2 text-white hover:opacity-95">
                                <span className="text-2xl md:text-3xl">⚽</span>
                                <span className="text-lg font-extrabold tracking-wide md:text-2xl">FOOTBALL MANAGER</span>
                            </Link>
                            <p className="mt-1 text-sm text-white/90 md:mt-2 md:text-base">
                                Lead {userTeamName} to Championship Glory
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="rounded-full border border-white/40 bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/25 md:px-4 md:py-2 md:text-sm"
                        disabled={loggingOut}
                        onClick={async () => {
                            setLoggingOut(true);
                            try {
                                await fetch('/api/auth/logout', { method: 'POST' });
                                window.location.href = '/login';
                            } finally {
                                setLoggingOut(false);
                            }
                        }}
                    >
                        {loggingOut ? 'Signing out...' : 'Logout'}
                    </button>
                </div>

                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    {gameDate && (
                        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/40 bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm md:px-5 md:py-2.5 md:text-base">
                            <span>📅 {gameDate}</span>
                            <span className="opacity-80">•</span>
                            <span>Season {season}</span>
                        </div>
                    )}

                    <div>
                        <NextProcessButton />
                    </div>
                </div>
            </div>
        </header>
    );
}
