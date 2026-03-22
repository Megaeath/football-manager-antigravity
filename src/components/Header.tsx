'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatDateLong } from '@/lib/dateFormat';
import NextProcessButton from '@/components/NextProcessButton';
import { usePageLoader } from '@/components/PageLoaderProvider';

interface HeaderProps {
    onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
    const router = useRouter();
    const { showLoader, hideLoader } = usePageLoader();
    const [gameDate, setGameDate] = useState<string>('');
    const [season, setSeason] = useState<number>(1);
    const [loggingOut, setLoggingOut] = useState(false);
    const [isCompact, setIsCompact] = useState(false);

    useEffect(() => {
        const fetchDate = async () => {
            const res = await fetch('/api/game/info', { cache: 'no-store' });
            const data = await res.json();
            if (data.currentDate) {
                const date = new Date(data.currentDate);
                // Use AD (Gregorian) format with English locale
                setGameDate(formatDateLong(date));
            }
            setSeason(Number(data.currentSeason || 1));
        };
        fetchDate();

        // Listen for date updates (optional enhancement)
        window.addEventListener('game-date-updated', fetchDate);
        return () => window.removeEventListener('game-date-updated', fetchDate);
    }, []);

    useEffect(() => {
        let lastY = 0;

        const onScroll = () => {
            const y = window.scrollY || 0;

            if (y <= 24) {
                setIsCompact(false);
            } else if (y > lastY + 2) {
                // Scrolling down -> collapse header for more reading space
                setIsCompact(true);
            } else if (y < lastY - 24) {
                // Scrolling up noticeably -> expand for easier controls access
                setIsCompact(false);
            }

            lastY = y;
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <header className={`sticky top-0 z-50 border-b border-[var(--border)] bg-white shadow-md transition-all duration-300 ${isCompact ? 'shadow-sm' : ''}`}>
            <div className={`hero-gradient px-4 transition-all duration-300 md:px-6 ${isCompact ? 'py-2 md:py-3' : 'py-4 md:py-5'}`}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2 md:gap-3">
                        <button
                            type="button"
                            onClick={onMenuClick}
                            className={`mt-1 inline-flex items-center justify-center rounded-md border border-white/40 bg-white/10 text-white backdrop-blur-sm transition-all duration-300 md:hidden ${isCompact ? 'h-9 w-9 text-lg' : 'h-10 w-10 text-xl'}`}
                            aria-label="Open navigation menu"
                        >
                            ☰
                        </button>

                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 md:gap-3">
                                <Link href="/" className="inline-flex items-center gap-2 text-white hover:opacity-95">
                                    <span className={`transition-all duration-300 ${isCompact ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl'}`}>⚽</span>
                                    <span className={`font-extrabold tracking-wide transition-all duration-300 ${isCompact ? 'text-base md:text-xl' : 'text-lg md:text-2xl'}`}>FOOTBALL MANAGER</span>
                                </Link>

                                {gameDate && (
                                    <div className={`inline-flex w-fit items-center gap-2 rounded-full border border-white/40 bg-white/15 font-semibold text-white backdrop-blur-sm transition-all duration-300 ${isCompact ? 'px-3 py-1 text-[11px] md:px-3.5 md:py-1.5 md:text-xs' : 'px-3 py-1.5 text-xs md:px-4 md:py-2 md:text-sm'}`}>
                                        <span>📅 {gameDate}</span>
                                        <span className="opacity-80">•</span>
                                        <span>Season {season}</span>
                                    </div>
                                )}

                                <div className="ml-0 md:ml-1">
                                    <NextProcessButton compact={isCompact} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        className={`rounded-full border border-white/40 bg-white/15 font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/25 ${isCompact ? 'px-3 py-1 text-xs md:px-3.5 md:py-1.5' : 'px-3 py-1.5 text-xs md:px-4 md:py-2 md:text-sm'}`}
                        disabled={loggingOut}
                        onClick={async () => {
                            setLoggingOut(true);
                            showLoader('Signing out...');
                            try {
                                await fetch('/api/auth/logout', { method: 'POST' });
                                router.push('/login', { scroll: false });
                            } finally {
                                hideLoader();
                                setLoggingOut(false);
                            }
                        }}
                    >
                        {loggingOut ? 'Signing out...' : 'Logout'}
                    </button>
                </div>

            </div>
        </header>
    );
}
