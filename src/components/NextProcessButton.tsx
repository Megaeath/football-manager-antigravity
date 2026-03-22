'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePageLoader } from '@/components/PageLoaderProvider';

interface NextProcessButtonProps {
    compact?: boolean;
}

export default function NextProcessButton({ compact = false }: NextProcessButtonProps) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { showLoader, hideLoader } = usePageLoader();

    const handleNextProcess = async () => {
        setLoading(true);
        showLoader('Processing match...');
        try {
            const res = await fetch('/api/game/process', {
                method: 'POST',
                body: JSON.stringify({ action: 'next_process' })
            });
            const data = await res.json();

            if (data?.success) {
                if (data.requiresUserAction) {
                    alert('You have a match today! Please proceed to the match page');
                    const matchId = data.userMatchId ? `?matchId=${data.userMatchId}` : '';
                    router.push(`/match${matchId}`, { scroll: false });
                    return;
                }

                // Notify persistent UI (e.g. Header) that in-game date/season may have changed.
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new Event('game-date-updated'));
                }

                router.push('/', { scroll: false });
                router.refresh();
                return;
            }

            alert('Next process failed');
        } catch (e) {
            alert('Next process failed: ' + e);
        } finally {
            hideLoader();
            setLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={handleNextProcess}
                disabled={loading}
                className="btn btn-primary"
                style={{
                    padding: compact ? '8px 12px' : '12px 20px',
                    fontSize: compact ? '0.85rem' : '1rem',
                    fontWeight: 800,
                    background: 'var(--accent)',
                    borderRadius: compact ? '8px' : '10px',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.18)'
                }}
            >
                {loading ? 'Processing...' : compact ? '🏁 Next Day' : '🏁 Advance to Next Day'}
            </button>
        </>
    );
}
