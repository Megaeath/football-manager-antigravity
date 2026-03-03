'use client';

import { useEffect, useState } from 'react';

interface FinancialData {
    teamId: string;
    teamName: string;
    balance: number;
    reputation: number;
    stadiumCapacity: number;
    weeklyData: {
        income: number;
        expenses: number;
        netBalance: number;
        breakdown: {
            sponsorship: number;
            ticketSales: number;
            jerseySales: number;
            seasonRewards: number;
            playerSales: number;
            wages: number;
            maintenance: number;
            playerPurchases: number;
        };
    };
    ffp: {
        status: 'healthy' | 'warning' | 'danger' | 'critical';
        wagePercentage: number;
        message: string;
    };
}

export default function TeamFinanceTab({ teamId }: { teamId: string }) {
    const [data, setData] = useState<FinancialData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const financesRes = await fetch(`/api/finances?teamId=${teamId}`);
                if (!financesRes.ok) {
                    throw new Error(`Failed to load finances: ${financesRes.statusText}`);
                }
                const financialData = await financesRes.json();
                setData(financialData);
            } catch (err) {
                setError(`Error loading financial data: ${err}`);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [teamId]);

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading financial data...</div>;
    if (error) return <div style={{ padding: '2rem', color: 'red' }}>{error}</div>;
    if (!data) return <div style={{ padding: '2rem' }}>No data available</div>;

    const formatCurrency = (num: number) => {
        if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
        return `$${num}`;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy': return '#4ade80';
            case 'warning': return '#fbbf24';
            case 'danger': return '#f87171';
            case 'critical': return '#dc2626';
            default: return '#999';
        }
    };

    const revenueTotal = data.weeklyData.breakdown.sponsorship +
        data.weeklyData.breakdown.ticketSales +
        data.weeklyData.breakdown.jerseySales +
        data.weeklyData.breakdown.seasonRewards +
        data.weeklyData.breakdown.playerSales;

    return (
        <div>
            <style>{`
                .finances-header {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                    margin-bottom: 2rem;
                }
                .big-number {
                    background: var(--card-bg);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    padding: 1.5rem;
                    text-align: center;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }
                .big-number-label {
                    font-size: 0.85rem;
                    color: var(--muted);
                    text-transform: uppercase;
                    margin-bottom: 0.5rem;
                }
                .big-number-value {
                    font-size: 2rem;
                    font-weight: bold;
                    color: var(--primary);
                }
                .big-number-value.positive {
                    color: #4ade80;
                }
                .big-number-value.negative {
                    color: #f87171;
                }
                
                .main-grid {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 2rem;
                    margin-bottom: 2rem;
                }
                
                @media (max-width: 1024px) {
                    .main-grid {
                        grid-template-columns: 1fr;
                    }
                }
                
                .card {
                    background: var(--card-bg);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    padding: 1.5rem;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }
                
                .card-title {
                    font-size: 1.1rem;
                    font-weight: bold;
                    margin-bottom: 1rem;
                    border-bottom: 2px solid var(--primary);
                    padding-bottom: 0.75rem;
                }
                
                .revenue-chart {
                    display: flex;
                    align-items: center;
                    gap: 2rem;
                }
                
                .pie-chart {
                    width: 120px;
                    height: 120px;
                    border-radius: 50%;
                    background: conic-gradient(
                        #3b82f6 0deg ${(data.weeklyData.breakdown.sponsorship / revenueTotal) * 360}deg,
                        #10b981 ${(data.weeklyData.breakdown.sponsorship / revenueTotal) * 360}deg ${((data.weeklyData.breakdown.sponsorship + data.weeklyData.breakdown.ticketSales) / revenueTotal) * 360}deg,
                        #f59e0b ${((data.weeklyData.breakdown.sponsorship + data.weeklyData.breakdown.ticketSales) / revenueTotal) * 360}deg ${((data.weeklyData.breakdown.sponsorship + data.weeklyData.breakdown.ticketSales + data.weeklyData.breakdown.jerseySales) / revenueTotal) * 360}deg,
                        #8b5cf6 ${((data.weeklyData.breakdown.sponsorship + data.weeklyData.breakdown.ticketSales + data.weeklyData.breakdown.jerseySales) / revenueTotal) * 360}deg 360deg
                    );
                    flex-shrink: 0;
                }
                
                .revenue-legend {
                    font-size: 0.9rem;
                }
                
                .legend-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 0.5rem;
                }
                
                .legend-color {
                    width: 12px;
                    height: 12px;
                    border-radius: 2px;
                }
                
                .accounting-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                    margin-bottom: 0.75rem;
                    padding-bottom: 0.75rem;
                    border-bottom: 1px solid var(--border);
                }
                
                .accounting-row:last-child {
                    border-bottom: none;
                }
                
                .accounting-label {
                    color: var(--muted);
                }
                
                .accounting-amount {
                    font-weight: bold;
                    text-align: right;
                }
                
                .accounting-amount.income {
                    color: #4ade80;
                }
                
                .accounting-amount.expense {
                    color: #f87171;
                }
                
                .accounting-amount.net {
                    color: var(--primary);
                    font-size: 1.1rem;
                }
                
                .progress-container {
                    margin-bottom: 1rem;
                }
                
                .progress-label {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.9rem;
                    margin-bottom: 0.5rem;
                    color: var(--muted);
                }
                
                .progress-bar {
                    width: 100%;
                    height: 24px;
                    background: #e5e7eb;
                    border-radius: 12px;
                    overflow: hidden;
                    border: 1px solid var(--border);
                }
                
                .progress-fill {
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 0.75rem;
                    font-weight: bold;
                    transition: width 0.3s ease;
                }
                
                .stadium-info {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }
                
                .info-item {
                    background: var(--primary-light);
                    padding: 1rem;
                    border-radius: 8px;
                    text-align: center;
                }
                
                .info-label {
                    font-size: 0.85rem;
                    color: var(--muted);
                    text-transform: uppercase;
                    margin-bottom: 0.5rem;
                }
                
                .info-value {
                    font-size: 1.5rem;
                    font-weight: bold;
                    color: var(--primary);
                }
                
                .ffp-status {
                    padding: 1rem;
                    border-radius: 8px;
                    border-left: 4px solid;
                    margin-top: 1rem;
                }
                
                .ffp-status.healthy {
                    background: #f0fdf4;
                    border-color: #4ade80;
                }
                
                .ffp-status.warning {
                    background: #fffbeb;
                    border-color: #fbbf24;
                }
                
                .ffp-status.danger {
                    background: #fef2f2;
                    border-color: #f87171;
                }
                
                .ffp-status.critical {
                    background: #fef2f2;
                    border-color: #dc2626;
                }
                
                .ffp-message {
                    font-size: 0.9rem;
                    color: var(--text);
                }
            `}</style>

            {/* Big Numbers */}
            <div className="finances-header">
                <div className="big-number">
                    <div className="big-number-label">Current Balance</div>
                    <div className="big-number-value">{formatCurrency(data.balance)}</div>
                </div>
                <div className="big-number">
                    <div className="big-number-label">Weekly Income</div>
                    <div className="big-number-value positive">{formatCurrency(data.weeklyData.income)}</div>
                </div>
                <div className="big-number">
                    <div className="big-number-label">Weekly Expenses</div>
                    <div className="big-number-value negative">-{formatCurrency(data.weeklyData.expenses)}</div>
                </div>
                <div className="big-number">
                    <div className="big-number-label">Weekly Profit/Loss</div>
                    <div className={`big-number-value ${data.weeklyData.netBalance >= 0 ? 'positive' : 'negative'}`}>
                        {data.weeklyData.netBalance >= 0 ? '+' : '-'}{formatCurrency(Math.abs(data.weeklyData.netBalance))}
                    </div>
                </div>
            </div>

            {/* Main Grid */}
            <div className="main-grid">
                {/* Left Column */}
                <div>
                    {/* Revenue Breakdown */}
                    <div className="card" style={{ marginBottom: '2rem' }}>
                        <div className="card-title">📊 Revenue Breakdown (Weekly)</div>
                        <div className="revenue-chart">
                            <div className="pie-chart"></div>
                            <div className="revenue-legend">
                                <div className="legend-item">
                                    <div className="legend-color" style={{ background: '#3b82f6' }}></div>
                                    <span>Sponsor: {formatCurrency(data.weeklyData.breakdown.sponsorship)}</span>
                                </div>
                                <div className="legend-item">
                                    <div className="legend-color" style={{ background: '#10b981' }}></div>
                                    <span>Tickets: {formatCurrency(data.weeklyData.breakdown.ticketSales)}</span>
                                </div>
                                <div className="legend-item">
                                    <div className="legend-color" style={{ background: '#f59e0b' }}></div>
                                    <span>Jersey: {formatCurrency(data.weeklyData.breakdown.jerseySales)}</span>
                                </div>
                                <div className="legend-item">
                                    <div className="legend-color" style={{ background: '#8b5cf6' }}></div>
                                    <span>Season Rewards: {formatCurrency(data.weeklyData.breakdown.seasonRewards)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Weekly Accounting */}
                    <div className="card">
                        <div className="card-title">📋 Weekly Accounting</div>
                        <div>
                            <div className="accounting-row">
                                <div className="accounting-label">🎯 Sponsorship</div>
                                <div className="accounting-amount income">{formatCurrency(data.weeklyData.breakdown.sponsorship)}</div>
                            </div>
                            <div className="accounting-row">
                                <div className="accounting-label">🎟️ Ticket Sales</div>
                                <div className="accounting-amount income">{formatCurrency(data.weeklyData.breakdown.ticketSales)}</div>
                            </div>
                            <div className="accounting-row">
                                <div className="accounting-label">👕 Jersey Sales</div>
                                <div className="accounting-amount income">{formatCurrency(data.weeklyData.breakdown.jerseySales)}</div>
                            </div>
                            <div className="accounting-row">
                                <div className="accounting-label">🏅 Season Rewards</div>
                                <div className="accounting-amount income">{formatCurrency(data.weeklyData.breakdown.seasonRewards)}</div>
                            </div>
                            <div className="accounting-row">
                                <div className="accounting-label">💱 Player Transfer Sales</div>
                                <div className="accounting-amount income">{formatCurrency(data.weeklyData.breakdown.playerSales)}</div>
                            </div>
                            <div className="accounting-row" style={{ borderTop: '2px solid var(--primary)', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                                <div className="accounting-label" style={{ fontWeight: 'bold' }}>📥 Total Income</div>
                                <div className="accounting-amount income" style={{ fontSize: '1.1rem' }}>{formatCurrency(data.weeklyData.income)}</div>
                            </div>
                        </div>

                        <div style={{ marginTop: '1.5rem', borderTop: '2px solid var(--border)', paddingTop: '1rem' }}>
                            <div className="accounting-row">
                                <div className="accounting-label">💼 Player Wages</div>
                                <div className="accounting-amount expense">-{formatCurrency(data.weeklyData.breakdown.wages)}</div>
                            </div>
                            <div className="accounting-row">
                                <div className="accounting-label">🏟️ Maintenance</div>
                                <div className="accounting-amount expense">-{formatCurrency(data.weeklyData.breakdown.maintenance)}</div>
                            </div>
                            <div className="accounting-row">
                                <div className="accounting-label">🤝 Player Purchases</div>
                                <div className="accounting-amount expense">-{formatCurrency(data.weeklyData.breakdown.playerPurchases)}</div>
                            </div>
                            <div className="accounting-row" style={{ borderTop: '2px solid var(--primary)', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                                <div className="accounting-label" style={{ fontWeight: 'bold' }}>📤 Total Expenses</div>
                                <div className="accounting-amount expense" style={{ fontSize: '1.1rem' }}>-{formatCurrency(data.weeklyData.expenses)}</div>
                            </div>
                        </div>

                        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--primary-light)', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <div style={{ fontWeight: 'bold' }}>📊 Net Balance</div>
                                <div className={`accounting-amount net`}>
                                    {data.weeklyData.netBalance >= 0 ? '+' : '-'}{formatCurrency(Math.abs(data.weeklyData.netBalance))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div>
                    {/* Stadium Status */}
                    <div className="card" style={{ marginBottom: '2rem' }}>
                        <div className="card-title">🏟️ Stadium Status</div>
                        <div className="stadium-info">
                            <div className="info-item">
                                <div className="info-label">Capacity</div>
                                <div className="info-value">{(data.stadiumCapacity / 1000).toFixed(0)}K</div>
                            </div>
                            <div className="info-item">
                                <div className="info-label">Avg Attendance</div>
                                <div className="info-value">{Math.round(data.stadiumCapacity * 0.75 / 1000)}K</div>
                            </div>
                            <div className="info-item">
                                <div className="info-label">Reputation</div>
                                <div className="info-value">{data.reputation}/100</div>
                            </div>
                            <div className="info-item">
                                <div className="info-label">Attendance Rate</div>
                                <div className="info-value">75%</div>
                            </div>
                        </div>
                    </div>

                    {/* Wage Bill Tracker */}
                    <div className="card" style={{ marginBottom: '2rem' }}>
                        <div className="card-title">💰 Wage Bill Status</div>
                        <div className="progress-container">
                            <div className="progress-label">
                                <span>Wages as % of Revenue</span>
                                <span style={{ fontWeight: 'bold' }}>{data.ffp.wagePercentage}%</span>
                            </div>
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{
                                        width: `${Math.min(data.ffp.wagePercentage, 100)}%`,
                                        background: getStatusColor(data.ffp.status)
                                    }}
                                >
                                    {data.ffp.wagePercentage > 30 && `${data.ffp.wagePercentage}%`}
                                </div>
                            </div>
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--muted)', marginTop: '1rem' }}>
                            <div>⚠️ Healthy: &lt;50%</div>
                            <div>⚠️ Warning: 50-70%</div>
                            <div>⚠️ Danger: 70-90%</div>
                            <div>⚠️ Critical: &gt;90%</div>
                        </div>
                    </div>

                    {/* FFP Status */}
                    <div className={`ffp-status ${data.ffp.status}`}>
                        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                            {data.ffp.status === 'healthy' && '✅ Healthy'}
                            {data.ffp.status === 'warning' && '⚠️ Warning'}
                            {data.ffp.status === 'danger' && '⛔ Danger'}
                            {data.ffp.status === 'critical' && '🚨 Critical'}
                        </div>
                        <div className="ffp-message">{data.ffp.message}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
