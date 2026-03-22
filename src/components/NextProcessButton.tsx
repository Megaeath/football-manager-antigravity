'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function NextProcessButton() {
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleNextProcess = async () => {
        setLoading(true);
        let keepLoadingUntilRedirect = false;
        try {
            const res = await fetch('/api/game/process', {
                method: 'POST',
                body: JSON.stringify({ action: 'next_process' })
            });
            const data = await res.json();

            if (data?.success) {
                if (data.requiresUserAction) {
                    keepLoadingUntilRedirect = true;
                    alert('You have a match today! Please proceed to the match page');
                    const matchId = data.userMatchId ? `?matchId=${data.userMatchId}` : '';
                    window.location.href = `/match${matchId}`;
                    return;
                }

                keepLoadingUntilRedirect = true;
                window.location.href = '/';
                return;
            }

            alert('Next process failed');
        } catch (e) {
            alert('Next process failed: ' + e);
        } finally {
            if (!keepLoadingUntilRedirect) {
                setLoading(false);
            }
        }
    };

    return (
        <>
            {mounted && loading && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(15, 23, 42, 0.45)',
                        zIndex: 99999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(2px)'
                    }}
                >
                    <div
                        style={{
                            background: 'white',
                            borderRadius: '12px',
                            padding: '1rem 1.25rem',
                            boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
                            fontWeight: 700,
                            color: 'var(--accent)'
                        }}
                    >
                        ⏳ Processing match...
                    </div>
                </div>,
                document.body
            )}
            <button
                onClick={handleNextProcess}
                disabled={loading}
                className="btn btn-primary"
                style={{
                    padding: '12px 20px',
                    fontSize: '1rem',
                    fontWeight: 800,
                    background: 'var(--accent)',
                    borderRadius: '10px',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.18)'
                }}
            >
                {loading ? 'Processing...' : '🏁 Advance to Next Day'}
            </button>
        </>
    );
}
