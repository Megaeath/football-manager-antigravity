'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

interface SeasonSelectorProps {
    currentSeason: number;
    selectedSeason: number;
}

export default function SeasonSelector({ currentSeason, selectedSeason }: SeasonSelectorProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const seasons = Array.from({ length: currentSeason }, (_, i) => i + 1);

    const handleSeasonChange = (season: string) => {
        const params = new URLSearchParams(searchParams);
        params.set('season', season);
        router.push(`${pathname}?${params.toString()}`);
    };

    return (
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <span style={{ color: 'var(--muted)' }}>เลือกฤดูกาล:</span>
            <select
                value={selectedSeason}
                onChange={(e) => handleSeasonChange(e.target.value)}
                style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                    cursor: 'pointer'
                }}
            >
                {seasons.map(s => (
                    <option key={s} value={s}>
                        ฤดูกาลที่ {s} {s === currentSeason ? '(ปัจจุบัน)' : ''}
                    </option>
                ))}
            </select>
        </div>
    );
}
