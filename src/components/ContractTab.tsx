'use client';

import React, { useState } from 'react';

interface ContractTabProps {
    playerId: string;
    playerName?: string;  // Optional, not used in component
    contractStartWeek: number;
    contractEndWeek: number;
    weeklyWage: number;
    isUserTeam: boolean;
    onRenew?: () => void;
}

export function ContractTab({
    playerId,
    playerName,
    contractStartWeek,
    contractEndWeek,
    weeklyWage,
    isUserTeam,
    onRenew
}: ContractTabProps) {
    const [renewing, setRenewing] = useState(false);
    const [message, setMessage] = useState('');

    const handleRenew = async () => {
        const confirmed = window.confirm(`ยืนยันต่อสัญญา ${playerName ?? ''} เป็นเวลา 2 ปี?`);
        if (!confirmed) return;
        setRenewing(true);
        try {
            const res = await fetch('/api/contracts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId, weeks: 104 }) // 2 years
            });
            const json = await res.json();
            if (res.ok) {
                setMessage(`✅ ${json.message}`);
                onRenew?.();
            } else {
                setMessage(`❌ ${json.error || 'Failed to renew'}`);
            }
        } catch (error) {
            setMessage(`❌ Error: ${error}`);
        } finally {
            setRenewing(false);
        }
    };

    const contractDuration = contractEndWeek - contractStartWeek;
    const weeksLeft = contractEndWeek;
    const yearsLeft = (weeksLeft / 52).toFixed(1);
    const newWage = Math.round(weeklyWage * 1.25);
    const costForTwoYears = weeklyWage * 104;
    const costForTwoYearsAfterRenewal = newWage * 104;

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '2rem'
        }}>
            {/* Left Column - Contract Info */}
            <div>
                <h4 style={{ marginBottom: '1rem' }}>📄 Contract Details</h4>
                
                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
                        Duration
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                        {(contractDuration / 52).toFixed(1)} years
                    </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
                        Time Remaining
                    </div>
                    <div style={{
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        color: weeksLeft <= 26 ? '#dc2626' : weeksLeft <= 52 ? '#f59e0b' : '#10b981'
                    }}>
                        {weeksLeft} weeks ({yearsLeft} years)
                    </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
                        Current Weekly Wage
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                        ${weeklyWage.toLocaleString()}
                    </div>
                </div>

                <div style={{
                    padding: '1rem',
                    background: 'var(--primary-light)',
                    borderRadius: '8px',
                    marginTop: '1.5rem'
                }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
                        2-Year Contract Cost
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold' }}>
                        ${costForTwoYears.toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Right Column - Renewal Info (if user team) */}
            {isUserTeam ? (
                <div>
                    <h4 style={{ marginBottom: '1rem' }}>🔄 Renewal Options</h4>
                    
                    <div style={{
                        background: 'var(--card-bg)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        padding: '1.5rem',
                        marginBottom: '1rem'
                    }}>
                        <div style={{ marginBottom: '1rem' }}>
                            <h5 style={{ margin: '0 0 0.5rem 0' }}>New 2-Year Contract</h5>
                            <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
                                Renew contract for 104 weeks with automatic wage increase
                            </div>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>
                                New Weekly Wage
                            </div>
                            <div style={{
                                fontSize: '1.25rem',
                                fontWeight: 'bold',
                                color: '#10b981'
                            }}>
                                ${newWage.toLocaleString()} <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>+25%</span>
                            </div>
                        </div>

                        <div style={{
                            padding: '0.75rem',
                            background: '#f0fdf4',
                            borderRadius: '6px',
                            marginBottom: '1rem',
                            borderLeft: '3px solid #10b981'
                        }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#166534' }}>
                                2-Year Cost: ${costForTwoYearsAfterRenewal.toLocaleString()}
                            </div>
                        </div>

                        <button
                            onClick={handleRenew}
                            disabled={renewing}
                            className="btn btn-primary"
                            style={{ width: '100%' }}
                        >
                            {renewing ? 'Renewing...' : `Renew Contract (${yearsLeft} → 2.0 years)`}
                        </button>

                        {message && (
                            <div style={{
                                marginTop: '1rem',
                                padding: '0.75rem',
                                background: message.includes('✅') ? '#f0fdf4' : '#fef2f2',
                                color: message.includes('✅') ? '#166534' : '#991b1b',
                                borderRadius: '6px',
                                fontSize: '0.9rem'
                            }}>
                                {message}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div>
                    <h4 style={{ marginBottom: '1rem' }}>📋 Contract Status</h4>
                    <div style={{
                        background: 'var(--primary-light)',
                        border: '1px solid var(--primary)',
                        borderRadius: '8px',
                        padding: '1.5rem',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                            👁️ View Only
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
                            This player is not on your team.<br/>
                            {weeksLeft <= 52 && weeksLeft > 26
                                ? 'Their team will auto-renew this contract soon.'
                                : 'Contract details are shown for reference.'}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
