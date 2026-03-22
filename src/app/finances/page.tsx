'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FINANCES, ACTIONS } from '@/lib/constants/uiLabels';

interface FinancialData {
    teamId: string;
    teamName: string;
    balance: number;
    reputation: number;
    stadiumCapacity: number;
    training: {
        facilityLevel: number;
        weeklyFee: number;
        nextUpgradeCost: number;
        isMaxLevel: boolean;
    };
    weeklyData: {
        income: number;
        expenses: number;
        netBalance: number;
        breakdown: {
            sponsorship: number;
            ticketSales: number;
            matchday?: number;
            jerseySales: number;
            seasonRewards: number;
            playerSales: number;
            wages: number;
            maintenance: number;
            playerPurchases: number;
            trainingWeekly: number;
        };
    };
    ffp: {
        status: 'healthy' | 'warning' | 'danger' | 'critical';
        wagePercentage: number;
        message: string;
    };
}

export default function FinancesPage() {
    const router = useRouter();
    const [data, setData] = useState<FinancialData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const gameInfo = await fetch('/api/game/info').then(r => r.json());
                if (!gameInfo.userTeamId) {
                    setError('Please select a team first');
                    return;
                }

                const financesRes = await fetch(`/api/finances?teamId=${gameInfo.userTeamId}`);
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
    }, []);

    if (loading) return (
        <div className="p-4 text-center" style={{ padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem' }}>💰 Loading financial data...</div>
        </div>
    );
    
    if (error) return (
        <div className="p-4 text-center" style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>
            ❌ {error}
        </div>
    );
    
    if (!data) return (
        <div className="p-4 text-center" style={{ padding: '2rem', textAlign: 'center' }}>
            No data available
        </div>
    );

    const formatCurrency = (num: number) => {
        const abs = Math.abs(num);
        const sign = num < 0 ? '−' : '';
        if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(2)}M`;
        if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
        return `${sign}$${abs.toLocaleString()}`;
    };

    const matchdayIncome = data.weeklyData.breakdown.matchday || 0;

    const revenueTotal = data.weeklyData.breakdown.sponsorship +
        matchdayIncome +
        data.weeklyData.breakdown.jerseySales +
        data.weeklyData.breakdown.seasonRewards +
        data.weeklyData.breakdown.playerSales;

    const revenueBreakdown = [
        { label: 'Sponsorship', value: data.weeklyData.breakdown.sponsorship, color: '#3b82f6' },
        { label: 'Matchday (Ticket Share)', value: matchdayIncome, color: '#10b981' },
        { label: 'Jersey Sales', value: data.weeklyData.breakdown.jerseySales, color: '#f59e0b' },
        { label: 'Season Rewards', value: data.weeklyData.breakdown.seasonRewards, color: '#8b5cf6' },
        { label: 'Player Sales', value: data.weeklyData.breakdown.playerSales, color: '#ec4899' }
    ];

    const expenseBreakdown = [
        { label: 'Wages', value: data.weeklyData.breakdown.wages, color: '#ef4444' },
        { label: 'Maintenance', value: data.weeklyData.breakdown.maintenance, color: '#f97316' },
        { label: 'Player Purchases', value: data.weeklyData.breakdown.playerPurchases, color: '#6366f1' },
        { label: 'Training', value: data.weeklyData.breakdown.trainingWeekly, color: '#14b8a6' }
    ];

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy': return 'var(--success)';
            case 'warning': return 'var(--accent)';
            case 'danger': return '#f87171';
            case 'critical': return 'var(--danger)';
            default: return '#999';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'healthy': return '✅ Compliant';
            case 'warning': return '⚠️ Warning';
            case 'danger': return '❗ Danger';
            case 'critical': return '🚨 Critical';
            default: return status;
        }
    };

    return (
        <div className="flex flex-col gap-6 md:gap-8">
            {/* Header */}
            <div className="hero-gradient">
                <h1 className="text-2xl md:text-4xl" style={{ margin: 0 }}>💰 {FINANCES.TITLE}</h1>
                <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9 }}>{data.teamName}</p>
            </div>

            {/* Big Numbers */}
            <div className="grid-auto-fit-md" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                <Card style={{ textAlign: 'center', padding: '2rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{FINANCES.BALANCE}</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: data.balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {formatCurrency(data.balance)}
                    </div>
                </Card>

                <Card style={{ textAlign: 'center', padding: '2rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{FINANCES.WEEKLY_INCOME}</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>
                        {formatCurrency(data.weeklyData.income)}
                    </div>
                </Card>

                <Card style={{ textAlign: 'center', padding: '2rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{FINANCES.WEEKLY_EXPENSES}</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--danger)' }}>
                        {formatCurrency(data.weeklyData.expenses)}
                    </div>
                </Card>

                <Card style={{ textAlign: 'center', padding: '2rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{FINANCES.PROFIT_LOSS}</div>
                    <div style={{ 
                        fontSize: '2rem', 
                        fontWeight: 'bold', 
                        color: data.weeklyData.netBalance >= 0 ? 'var(--success)' : 'var(--danger)' 
                    }}>
                        {formatCurrency(data.weeklyData.netBalance)}
                    </div>
                </Card>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Breakdown */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>📊 {FINANCES.INCOME} Breakdown</CardTitle>
                    </CardHeader>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                        {/* Pie Chart */}
                        <div style={{ 
                            width: '140px', 
                            height: '140px', 
                            borderRadius: '50%',
                            background: `conic-gradient(
                                #3b82f6 0deg ${(data.weeklyData.breakdown.sponsorship / revenueTotal) * 360}deg,
                                #10b981 ${(data.weeklyData.breakdown.sponsorship / revenueTotal) * 360}deg ${((data.weeklyData.breakdown.sponsorship + matchdayIncome) / revenueTotal) * 360}deg,
                                #f59e0b ${((data.weeklyData.breakdown.sponsorship + matchdayIncome) / revenueTotal) * 360}deg ${((data.weeklyData.breakdown.sponsorship + matchdayIncome + data.weeklyData.breakdown.jerseySales) / revenueTotal) * 360}deg,
                                #8b5cf6 ${((data.weeklyData.breakdown.sponsorship + matchdayIncome + data.weeklyData.breakdown.jerseySales) / revenueTotal) * 360}deg ${((revenueTotal - data.weeklyData.breakdown.playerSales) / revenueTotal) * 360}deg,
                                #ec4899 ${((revenueTotal - data.weeklyData.breakdown.playerSales) / revenueTotal) * 360}deg 360deg
                            )`,
                            flexShrink: 0
                        }} />
                        
                        {/* Legend */}
                        <div style={{ flex: 1 }}>
                            {revenueBreakdown.map((item) => (
                                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                    <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: item.color }} />
                                    <span style={{ fontSize: '0.9rem', flex: 1 }}>{item.label}</span>
                                    <span style={{ fontWeight: '600' }}>{formatCurrency(item.value)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>

                {/* FFP Status */}
                <Card>
                    <CardHeader>
                        <CardTitle>📋 {FINANCES.FFP_STATUS}</CardTitle>
                    </CardHeader>
                    <div style={{ 
                        padding: '1.5rem', 
                        borderRadius: '10px', 
                        background: 'rgba(0,0,0,0.02)',
                        borderLeft: `5px solid ${getStatusColor(data.ffp.status)}`
                    }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                            {getStatusText(data.ffp.status)}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: '1rem' }}>
                            {data.ffp.message}
                        </div>
                        
                        {/* Wage Progress */}
                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                <span>Wage to Income Ratio</span>
                                <span style={{ fontWeight: 'bold' }}>{data.ffp.wagePercentage.toFixed(1)}%</span>
                            </div>
                            <div style={{ 
                                width: '100%', 
                                height: '24px', 
                                background: '#e5e7eb', 
                                borderRadius: '12px',
                                overflow: 'hidden'
                            }}>
                                <div style={{ 
                                    width: `${Math.min(data.ffp.wagePercentage, 100)}%`,
                                    height: '100%',
                                    background: data.ffp.wagePercentage > 70 ? '#ef4444' : data.ffp.wagePercentage > 50 ? '#f59e0b' : '#10b981',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold'
                                }}>
                                    {data.ffp.wagePercentage.toFixed(1)}%
                                </div>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                                FFP Limit: 70%
                            </div>
                        </div>
                    </div>

                    {/* Stadium Info */}
                    <div style={{ marginTop: '1.5rem' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '1rem' }}>🏟️ Stadium</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                            <div style={{ 
                                background: 'var(--primary-light)', 
                                padding: '1rem', 
                                borderRadius: '8px',
                                textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase' }}>Capacity</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                                    {data.stadiumCapacity.toLocaleString()}
                                </div>
                            </div>
                            <div style={{ 
                                background: 'var(--primary-light)', 
                                padding: '1rem', 
                                borderRadius: '8px',
                                textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase' }}>Reputation</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                                    {data.reputation}
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Accounting Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Expenses */}
                <Card>
                    <CardHeader>
                        <CardTitle>💸 {FINANCES.EXPENSE} Breakdown</CardTitle>
                    </CardHeader>
                    <div>
                        {expenseBreakdown.map((item) => (
                            <div key={item.label} style={{ 
                                display: 'grid', 
                                gridTemplateColumns: '1fr auto', 
                                gap: '1rem',
                                padding: '0.75rem 0',
                                borderBottom: '1px solid var(--border)'
                            }}>
                                <span style={{ color: 'var(--muted)' }}>{item.label}</span>
                                <span style={{ fontWeight: 'bold', color: 'var(--danger)' }}>
                                    {formatCurrency(-item.value)}
                                </span>
                            </div>
                        ))}
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '1fr auto', 
                            gap: '1rem',
                            padding: '1rem 0 0 0',
                            marginTop: '0.5rem',
                            borderTop: '2px solid var(--border)'
                        }}>
                            <span style={{ fontWeight: '600' }}>Total Expenses</span>
                            <span style={{ fontWeight: 'bold', color: 'var(--danger)', fontSize: '1.1rem' }}>
                                {formatCurrency(-data.weeklyData.expenses)}
                            </span>
                        </div>
                    </div>
                </Card>

                {/* Training Facility */}
                <Card>
                    <CardHeader>
                        <CardTitle>🏋️ Training Facility</CardTitle>
                    </CardHeader>
                    <div style={{ padding: '1rem', background: 'var(--primary-light)', borderRadius: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Current Level</span>
                            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                                Lv.{data.training.facilityLevel}
                            </span>
                        </div>
                        
                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>Weekly Fee</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{formatCurrency(data.training.weeklyFee)}</div>
                        </div>

                        {!data.training.isMaxLevel ? (
                            <Button 
                                variant="primary" 
                                fullWidth
                                onClick={() => {/* Handle upgrade */}}
                            >
                                ⬆️ Upgrade ({formatCurrency(data.training.nextUpgradeCost)})
                            </Button>
                        ) : (
                            <div style={{ 
                                padding: '0.75rem', 
                                background: 'var(--success)', 
                                color: 'white', 
                                borderRadius: '8px',
                                textAlign: 'center',
                                fontWeight: '600'
                            }}>
                                ✅ Max Level Reached
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
