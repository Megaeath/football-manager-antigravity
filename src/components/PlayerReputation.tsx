'use client';

import React from 'react';

interface PlayerStatsProps {
    popularity: number;
    marketValue: number;
    overall: number;
    age: number;
}

export function PopularityBar({ popularity }: { popularity: number }) {
    const getColor = (pop: number) => {
        if (pop >= 80) return '#fbbf24'; // Gold
        if (pop >= 60) return '#10b981'; // Green
        if (pop >= 40) return '#3b82f6'; // Blue
        if (pop >= 20) return '#f97316'; // Orange
        return '#ef4444'; // Red
    };

    return (
        <div style={{ marginTop: '0.5rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>
                Popularity: {popularity}/100
            </div>
            <div style={{
                width: '100%',
                height: '8px',
                background: '#e5e7eb',
                borderRadius: '4px',
                overflow: 'hidden',
                border: '1px solid var(--border)'
            }}>
                <div style={{
                    width: `${popularity}%`,
                    height: '100%',
                    background: getColor(popularity),
                    transition: 'width 0.3s ease'
                }}></div>
            </div>
        </div>
    );
}

export function MarketValueTag({ marketValue, overall, age }: { marketValue: number; overall: number; age: number }) {
    const formatValue = (num: number) => {
        if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
        return `$${num}`;
    };

    const getValueColor = (value: number) => {
        if (value >= 5000000) return '#fbbf24'; // Gold - superstar
        if (value >= 2000000) return '#10b981'; // Green - elite
        if (value >= 1000000) return '#3b82f6'; // Blue - premium
        if (value >= 500000) return '#8b5cf6'; // Purple - solid
        return '#6b7280'; // Gray - regular
    };

    const ageMultiplier = age >= 32 ? Math.pow(0.9, age - 32) : 1;

    return (
        <div style={{
            display: 'inline-block',
            background: getValueColor(marketValue),
            color: 'white',
            padding: '0.25rem 0.75rem',
            borderRadius: '12px',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            marginRight: '0.5rem',
            marginBottom: '0.5rem',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            whiteSpace: 'nowrap'
        }} title={`Overall: ${overall}, Age: ${age}${age >= 32 ? ` (${(ageMultiplier * 100).toFixed(0)}% value)` : ''}`}>
            💎 {formatValue(marketValue)}
        </div>
    );
}

export function PlayerReputation({ playerName, popularity, overall, marketValue, age }: PlayerStatsProps & { playerName?: string }) {
    return (
        <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '1rem',
            marginTop: '1rem'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                    <h3 style={{ margin: '0 0 0.5rem 0' }}>📊 Player Stats</h3>
                </div>
                <MarketValueTag marketValue={marketValue} overall={overall} age={age} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Overall Rating</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                        {overall.toFixed(1)}/20
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Age</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: age >= 32 ? '#f87171' : 'var(--primary)' }}>
                        {age} {age >= 32 ? '⚠️' : ''}
                    </div>
                </div>
            </div>

            <PopularityBar popularity={popularity} />
        </div>
    );
}
