'use client';

import { useState, useEffect } from 'react';

interface PopularityStats {
    count: number;
    avgPopularity: number;
    medianPopularity: number;
    minPopularity: number;
    maxPopularity: number;
    weightedPopularity: number;
    topPlayers: Array<{
        name: string;
        team: string;
        popularity: number;
        age: number;
        goals: number;
        assists: number;
        apps: number;
        avgRating: number;
    }>;
}

interface ApiResponse {
    summary: {
        totalPlayers: number;
        avgPopularityAllPositions: number;
        positionBreakdown: Record<string, PopularityStats>;
    };
    timestamp: string;
}

export default function PopularityAnalysisPage() {
    const [data, setData] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/debug/popularity-by-position');
                const json = await res.json();
                setData(json);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem' }}>🔄 Loading...</div>
            </div>
        );
    }

    if (!data) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', color: 'red' }}>❌ ไม่สามารถโหลดข้อมูล</div>
            </div>
        );
    }

    const getPopularityColor = (popularity: number) => {
        if (popularity >= 80) return '#4caf50';
        if (popularity >= 60) return '#8bc34a';
        if (popularity >= 40) return '#ffc107';
        if (popularity >= 20) return '#ff9800';
        return '#f44336';
    };

    const positions = Object.keys(data.summary.positionBreakdown).sort();

    return (
        <div style={{ padding: '2rem' }}>
            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                color: 'white',
                padding: '2rem',
                borderRadius: '12px',
                marginBottom: '2rem'
            }}>
                <h1 style={{ margin: 0, fontSize: '2rem' }}>📊 Player Popularity by Position</h1>
                <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9 }}>
                    Analyzing popularity balance across positions - {new Date(data.timestamp).toLocaleDateString('th-TH')}
                </p>
            </div>

            {/* Summary Card */}
            <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem', background: 'rgba(76, 175, 80, 0.1)', borderLeft: '4px solid #4caf50' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>จำนวนนักเตะทั้งหมด</div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{data.summary.totalPlayers}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: '0.5rem' }}> Average Popularityทั้งหมด</div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                            {data.summary.avgPopularityAllPositions.toFixed(1)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Position Comparison Table */}
            <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem', overflowX: 'auto' }}>
                <h2 style={{ marginTop: 0 }}>🎯 Popularity Summary by Position</h2>
                <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.95rem'
                }}>
                    <thead>
                        <tr style={{ background: 'var(--border)', fontWeight: 'bold' }}>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid var(--primary)' }}>Position</th>
                            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid var(--primary)' }}>จำนวน</th>
                            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid var(--primary)' }}>เฉลี่ย</th>
                            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid var(--primary)' }}>ค่ามัธยฐาน</th>
                            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid var(--primary)' }}>Weighted</th>
                            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid var(--primary)' }}>Range</th>
                        </tr>
                    </thead>
                    <tbody>
                        {positions.map((pos, idx) => {
                            const stat = data.summary.positionBreakdown[pos];
                            const balance = Math.abs(stat.avgPopularity - data.summary.avgPopularityAllPositions);
                            const balanceColor = balance < 5 ? '#4caf50' : balance < 10 ? '#ff9800' : '#f44336';

                            return (
                                <tr
                                    key={pos}
                                    style={{
                                        background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                                        borderBottom: '1px solid var(--border)'
                                    }}
                                >
                                    <td style={{ padding: '12px', fontWeight: '600' }}>{pos}</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>{stat.count}</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <div style={{
                                            display: 'inline-block',
                                            background: getPopularityColor(stat.avgPopularity),
                                            color: 'white',
                                            padding: '4px 12px',
                                            borderRadius: '6px',
                                            fontWeight: 'bold'
                                        }}>
                                            {stat.avgPopularity.toFixed(1)}
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        {stat.medianPopularity}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: balanceColor }}>
                                        {stat.weightedPopularity.toFixed(1)}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.9rem', color: 'var(--muted)' }}>
                                        {stat.minPopularity} - {stat.maxPopularity}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Position Details */}
            {positions.map((pos) => {
                const stat = data.summary.positionBreakdown[pos];
                return (
                    <div key={pos} className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>
                            {pos} - นักเตะดังสุด 5 คน (ค่าเฉลี่ย: {stat.avgPopularity.toFixed(1)})
                        </h3>
                        <table style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '0.9rem'
                        }}>
                            <thead>
                                <tr style={{ background: 'var(--border)', fontWeight: 'bold', borderBottom: '2px solid var(--primary)' }}>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>Name</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>Team</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>ความดัง</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>Age</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>เกม</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>Goals/Assists</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>คะแนนเฉลี่ย</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stat.topPlayers.map((player, idx) => (
                                    <tr
                                        key={idx}
                                        style={{
                                            background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                                            borderBottom: '1px solid var(--border)'
                                        }}
                                    >
                                        <td style={{ padding: '10px', fontWeight: '500' }}>{player.name}</td>
                                        <td style={{ padding: '10px', textAlign: 'center', fontSize: '0.9rem', color: 'var(--muted)' }}>
                                            {player.team}
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'center' }}>
                                            <div style={{
                                                display: 'inline-block',
                                                background: getPopularityColor(player.popularity),
                                                color: 'white',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontWeight: 'bold',
                                                fontSize: '0.9rem'
                                            }}>
                                                {player.popularity}
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'center' }}>{player.age}</td>
                                        <td style={{ padding: '10px', textAlign: 'center' }}>{player.apps}</td>
                                        <td style={{ padding: '10px', textAlign: 'center' }}>
                                            {player.goals}/{player.assists}
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'center' }}>
                                            {player.avgRating ? player.avgRating.toFixed(1) : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            })}

            {/* Legend */}
            <div className="card" style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.02)' }}>
                <h3 style={{ marginTop: 0 }}>📖 คำอธิบาย</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                    <div>
                        <strong> Average Popularity:</strong> ค่าเฉลี่ยความดังของทั้งPosition
                    </div>
                    <div>
                        <strong>ค่ามัธยฐาน:</strong> ค่าตรงกลางของความดัง (50% ต่ำกว่า, 50% สูงกว่า)
                    </div>
                    <div>
                        <strong>Weighted:</strong> Calculated based on matches played (สำคัญมากขึ้น)
                    </div>
                    <div>
                        <strong>Range:</strong> ค่าต่ำสุด-สูงสุดของความดังในPosition
                    </div>
                </div>
            </div>
        </div>
    );
}
