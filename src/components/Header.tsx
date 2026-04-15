'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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
    const isCompactRef = useRef(false);

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
        let lastY = window.scrollY || 0;
        let upAccum = 0;
        let downAccum = 0;
        let ticking = false;
        let lastToggleAt = 0;

        const setCompact = (next: boolean) => {
            if (isCompactRef.current === next) return;
            isCompactRef.current = next;
            setIsCompact(next);
            lastToggleAt = Date.now();
            upAccum = 0;
            downAccum = 0;
        };

        const evaluate = () => {
            ticking = false;
            const now = Date.now();
            const y = window.scrollY || 0;
            const delta = y - lastY;

            // Keep expanded near page top.
            if (y <= 20) {
                setCompact(false);
                lastY = y;
                return;
            }

            // Cooldown avoids rapid oscillation from sticky layout reflow.
            if (now - lastToggleAt < 140) {
                lastY = y;
                return;
            }

            if (delta > 0) {
                downAccum += delta;
                upAccum = 0;
            } else if (delta < 0) {
                upAccum += -delta;
                downAccum = 0;
            }

            // Hysteresis thresholds: collapse easier, expand only on clear upward intent.
            if (!isCompactRef.current && y > 36 && downAccum >= 14) {
                setCompact(true);
            } else if (isCompactRef.current && upAccum >= 34) {
                setCompact(false);
            }

            lastY = y;
        };

        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(evaluate);
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <header className={`sticky top-0 z-50 border-b border-[var(--border)] bg-white shadow-md ${isCompact ? 'shadow-sm' : ''}`} style={{transition: 'box-shadow 0.3s', minHeight: isCompact ? 48 : undefined, height: isCompact ? 48 : undefined, padding: isCompact ? 0 : undefined, display: 'flex', alignItems: 'center'}}>
            <div className={`hero-gradient w-full ${isCompact ? '' : 'px-4 md:px-6 py-4 md:py-5'}`}>
                <div className={`flex w-full justify-between ${isCompact ? 'items-center' : 'items-start gap-3'}`}>
                    <div className={`flex min-w-0 ${isCompact ? 'items-center' : 'items-start gap-2 md:gap-3'}`}>
                        <button
                            type="button"
                            onClick={onMenuClick}
                            className={`inline-flex items-center justify-center rounded-md border border-white/40 bg-white/10 text-white backdrop-blur-sm md:hidden ${isCompact ? 'h-8 w-8 text-xs' : 'mt-1 h-10 w-10 text-xl'}`}
                            aria-label="Open navigation menu"
                        >
                            ☰
                        </button>

                        <div className="min-w-0">
                            <div className={`flex items-center ${isCompact ? 'flex-nowrap' : 'flex-wrap gap-2 md:gap-3'}`}>
                                <Link href="/" className={`inline-flex items-center text-white hover:opacity-95 ${isCompact ? 'gap-1' : 'gap-2'}`}>
                                    <span className={`leading-none ${isCompact ? 'text-xs md:text-sm' : 'text-2xl md:text-3xl'}`}>⚽</span>
                                    <span className={`font-extrabold tracking-wide leading-none ${isCompact ? 'text-[9px] md:text-xs' : 'text-lg md:text-2xl'}`}>FOOTBALL MANAGER</span>
                                </Link>

                                {gameDate && (
                                    <div className={`w-fit items-center gap-2 rounded-full border border-white/40 bg-white/15 font-semibold text-white backdrop-blur-sm ${isCompact ? 'hidden' : 'inline-flex px-3 py-1.5 text-xs md:px-4 md:py-2 md:text-sm'}`}>
                                        <span>📅 {gameDate}</span>
                                        <span className="opacity-80">•</span>
                                        <span>Season {season}</span>
                                    </div>
                                )}

                                <div className={`ml-0 ${isCompact ? '' : 'md:ml-1'}`}>
                                    <NextProcessButton compact={isCompact} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        className={`rounded-full border border-white/40 bg-white/15 font-semibold text-white backdrop-blur-sm hover:bg-white/25 ${isCompact ? 'px-2 py-px text-[10px] md:px-2.5 md:py-0.5 md:text-[11px]' : 'px-3 py-1.5 text-xs md:px-4 md:py-2 md:text-sm'}`}
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
