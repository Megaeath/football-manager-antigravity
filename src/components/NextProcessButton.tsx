'use client';

import { useState } from 'react';

export default function NextProcessButton() {
    const [loading, setLoading] = useState(false);

    const handleNextProcess = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/game/process', {
                method: 'POST',
                body: JSON.stringify({ action: 'next_process' })
            });
            const data = await res.json();

            if (data?.success) {
                if (data.requiresUserAction) {
                    alert('มีการแข่งขันทีมของคุณในวันนี้! กรุณาดำเนินการต่อที่สนามแข่ง');
                    const matchId = data.userMatchId ? `?matchId=${data.userMatchId}` : '';
                    window.location.href = `/match${matchId}`;
                    return;
                }

                window.location.href = '/';
                return;
            }

            alert('Next process failed');
        } catch (e) {
            alert('Next process failed: ' + e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleNextProcess}
            disabled={loading}
            className="btn btn-primary"
            style={{ padding: '10px 16px', fontSize: '0.95rem', background: 'var(--accent)' }}
        >
            {loading ? 'กำลังประมวลผล...' : '🏁 ไปวันถัดไป (Next Process)'}
        </button>
    );
}
