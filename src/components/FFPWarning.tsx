'use client';

import { useEffect, useState } from 'react';

interface FFPStatus {
    status: 'healthy' | 'warning' | 'danger' | 'critical';
    wagePercentage: number;
    message: string;
}

export function FFPWarning({ teamId }: { teamId?: string }) {
    const [ffpStatus, setFFPStatus] = useState<FFPStatus | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkFFP = async () => {
            try {
                if (!teamId) {
                    const gameInfo = await fetch('/api/game/info').then(r => r.json());
                    teamId = gameInfo.userTeamId;
                }
                
                const res = await fetch(`/api/finances?teamId=${teamId}`);
                if (res.ok) {
                    const data = await res.json();
                    setFFPStatus(data.ffp);
                }
            } catch (error) {
                console.error('Failed to check FFP status:', error);
            } finally {
                setLoading(false);
            }
        };

        checkFFP();
        const interval = setInterval(checkFFP, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [teamId]);

    if (loading || !ffpStatus) return null;

    const getWarningStyle = (status: string) => {
        switch (status) {
            case 'critical':
                return { background: '#fef2f2', borderLeft: '4px solid #dc2626', color: '#991b1b' };
            case 'danger':
                return { background: '#fef2f2', borderLeft: '4px solid #f87171', color: '#be123c' };
            case 'warning':
                return { background: '#fffbeb', borderLeft: '4px solid #fbbf24', color: '#92400e' };
            default:
                return { background: '#f0fdf4', borderLeft: '4px solid #4ade80', color: '#166534' };
        }
    };

    const getWarningIcon = (status: string) => {
        switch (status) {
            case 'critical':
                return '🚨';
            case 'danger':
                return '⛔';
            case 'warning':
                return '⚠️';
            default:
                return '✅';
        }
    };

    if (ffpStatus.status === 'healthy') return null; // Don't show if healthy

    return (
        <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '0.9rem',
            ...getWarningStyle(ffpStatus.status)
        }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                {getWarningIcon(ffpStatus.status)} FFP Compliance: {ffpStatus.status.toUpperCase()}
            </div>
            <div>{ffpStatus.message}</div>
        </div>
    );
}
