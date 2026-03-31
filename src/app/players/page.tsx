'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PlayerModal from '@/components/PlayerModal';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PLAYERS, PLAYER_STATS, ACTIONS } from '@/lib/constants/uiLabels';

interface Player {
    id: string;
    name: string;
    age: number;
    position: string;
    power: number;
    avgRating: number;
    marketValue: number;
    contractEndWeek: number | null;
    teamId: string | null;
    teamName: string;
    transferStatus: string; // LISTED, NOT_LISTED, FREE_AGENT
    askingPrice: number | null;
    isRetired: boolean; // NEW: Retired status
}

type SortField = 'power' | 'rating' | 'price' | 'age' | 'name';

export default function PlayersPage() {
    const router = useRouter();
    const [players, setPlayers] = useState<Player[]>([]);
    const [filtered, setFiltered] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Filter states
    const [searchName, setSearchName] = useState('');
    const [minPower, setMinPower] = useState('');
    const [maxPower, setMaxPower] = useState('');
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');
    const [minAge, setMinAge] = useState('');
    const [maxAge, setMaxAge] = useState('');
    const [selectedTeam, setSelectedTeam] = useState('');
    const [selectedPosition, setSelectedPosition] = useState('');
    const [contractEndingSoon, setContractEndingSoon] = useState(false);
    const [showFreeAgentsOnly, setShowFreeAgentsOnly] = useState(false);
    const [showListedOnly, setShowListedOnly] = useState(false); // NEW: Show only listed players
    const [showRetiredOnly, setShowRetiredOnly] = useState(false); // NEW: Show only retired players
    const [sortBy, setSortBy] = useState<SortField>('power');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const positions = ['GK', 'DC', 'DR', 'DL', 'DMC', 'MC', 'AMC', 'MR', 'ML', 'FWC'];

    const handleSortColumnClick = (field: SortField) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    };

    const openPlayerModal = (playerId: string) => {
        router.push(`/players?playerId=${playerId}`);
    };

    const closeModal = () => {
        setSelectedPlayerId(null);
        router.push('/players');
    };

    useEffect(() => {
        const fetchPlayers = async () => {
            try {
                const res = await fetch('/api/players/search');
                const data = await res.json();
                setPlayers(data);
                setFiltered(data);
            } catch (error) {
                console.error('Error fetching players:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPlayers();
    }, []);

    useEffect(() => {
        let result = [...players];

        if (searchName) {
            result = result.filter(p =>
                p.name.toLowerCase().includes(searchName.toLowerCase())
            );
        }

        if (minPower) result = result.filter(p => p.power >= parseInt(minPower));
        if (maxPower) result = result.filter(p => p.power <= parseInt(maxPower));

        if (minPrice) result = result.filter(p => p.marketValue >= parseInt(minPrice));
        if (maxPrice) result = result.filter(p => p.marketValue <= parseInt(maxPrice));

        if (minAge) result = result.filter(p => p.age >= parseInt(minAge));
        if (maxAge) result = result.filter(p => p.age <= parseInt(maxAge));

        if (selectedPosition) result = result.filter(p => p.position.startsWith(selectedPosition));

        if (selectedTeam) result = result.filter(p => p.teamId === selectedTeam);

        if (contractEndingSoon) {
            result = result.filter(p => p.contractEndWeek && p.contractEndWeek <= 10);
        }

        if (showFreeAgentsOnly) {
            result = result.filter(p => !p.teamId);
        }

        if (showListedOnly) {
            result = result.filter(p => p.transferStatus === 'LISTED');
        }

        if (showRetiredOnly) {
            result = result.filter(p => p.isRetired === true);
        }

        // Debug log
        if (showListedOnly) {
            console.log('[Players Page] Listed filter active. Total:', players.length, 'Filtered:', result.length);
            console.log('[Players Page] Sample listed player:', result[0]);
        }

        result.sort((a, b) => {
            let compareValue = 0;
            switch (sortBy) {
                case 'power':
                    compareValue = a.power - b.power;
                    break;
                case 'rating':
                    compareValue = a.avgRating - b.avgRating;
                    break;
                case 'price':
                    compareValue = a.marketValue - b.marketValue;
                    break;
                case 'age':
                    compareValue = a.age - b.age;
                    break;
                case 'name':
                    compareValue = a.name.localeCompare(b.name);
                    break;
            }
            return sortOrder === 'desc' ? -compareValue : compareValue;
        });

        setFiltered(result);
        setCurrentPage(1);
    }, [players, searchName, minPower, maxPower, minPrice, maxPrice, minAge, maxAge, selectedTeam, selectedPosition, contractEndingSoon, showFreeAgentsOnly, showListedOnly, showRetiredOnly, sortBy, sortOrder]);

    const uniqueTeams = Array.from(new Set(players.filter(p => p.teamId).map(p => p.teamId as string)))
        .map(id => {
            const player = players.find(p => p.teamId === id);
            return { id, name: player?.teamName || 'Unknown' };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginatedPlayers = filtered.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const getPowerColor = (power: number) => {
        if (power >= 80) return '#4caf50';
        if (power >= 70) return '#8bc34a';
        if (power >= 60) return '#ffc107';
        if (power >= 50) return '#ff9800';
        return '#f44336';
    };

    const formatCurrency = (value: number) => {
        if (value >= 1000000) {
            return `$${(value / 1000000).toFixed(2)}M`;
        }
        if (value >= 1000) {
            return `$${(value / 1000).toFixed(1)}K`;
        }
        return `$${value}`;
    };

    const resetFilters = () => {
        setSearchName('');
        setMinPower('');
        setMaxPower('');
        setMinPrice('');
        setMaxPrice('');
        setMinAge('');
        setMaxAge('');
        setSelectedTeam('');
        setSelectedPosition('');
        setContractEndingSoon(false);
        setShowFreeAgentsOnly(false);
        setShowListedOnly(false);
        setShowRetiredOnly(false);
    };

    if (loading) {
        return (
            <div className="p-4 text-center md:p-8" style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem' }}>🔍 {PLAYERS.LOADING_PLAYERS}</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 md:gap-8">
            {/* Header */}
            <div className="hero-gradient">
                <h1 className="text-2xl md:text-4xl" style={{ margin: 0 }}>🔍 {PLAYERS.TITLE}</h1>
                <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9 }}>{PLAYERS.SUBTITLE}</p>
            </div>

            {/* Search & Filters - Better Organized */}
            <Card>
                <CardHeader>
                    <CardTitle>🎯 {PLAYERS.SEARCH_FILTERS}</CardTitle>
                </CardHeader>

                {/* Basic Filters */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.75rem', color: 'var(--muted)' }}>Basic Search</h4>
                    <div className="grid-auto-fit-md" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                        {/* Name Search */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>{PLAYERS.PLAYER_NAME}</label>
                            <input
                                type="text"
                                placeholder={PLAYERS.SEARCH_BY_NAME}
                                value={searchName}
                                onChange={(e) => setSearchName(e.target.value)}
                                className="input"
                                style={{ width: '100%' }}
                            />
                        </div>

                        {/* Position */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>{PLAYER_STATS.POSITION}</label>
                            <select
                                value={selectedPosition}
                                onChange={(e) => setSelectedPosition(e.target.value)}
                                className="select"
                                style={{ width: '100%' }}
                            >
                                <option value="">{PLAYERS.ALL_POSITIONS}</option>
                                {positions.map(pos => (
                                    <option key={pos} value={pos}>{pos}</option>
                                ))}
                            </select>
                        </div>

                        {/* Team */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>Team</label>
                            <select
                                value={selectedTeam}
                                onChange={(e) => setSelectedTeam(e.target.value)}
                                className="select"
                                style={{ width: '100%' }}
                            >
                                <option value="">{PLAYERS.ALL_TEAMS}</option>
                                {uniqueTeams.map(team => (
                                    <option key={team.id} value={team.id}>{team.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Advanced Filters */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.75rem', color: 'var(--muted)' }}>Advanced Filters</h4>
                    <div className="grid-auto-fit-sm" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                        {/* Power Range */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>{PLAYER_STATS.POWER}</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="number"
                                    placeholder={PLAYERS.MIN}
                                    min="0"
                                    max="100"
                                    value={minPower}
                                    onChange={(e) => setMinPower(e.target.value)}
                                    className="input"
                                    style={{ flex: 1 }}
                                />
                                <input
                                    type="number"
                                    placeholder={PLAYERS.MAX}
                                    min="0"
                                    max="100"
                                    value={maxPower}
                                    onChange={(e) => setMaxPower(e.target.value)}
                                    className="input"
                                    style={{ flex: 1 }}
                                />
                            </div>
                        </div>

                        {/* Age Range */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>{PLAYER_STATS.AGE}</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="number"
                                    placeholder={PLAYERS.MIN}
                                    min="16"
                                    max="40"
                                    value={minAge}
                                    onChange={(e) => setMinAge(e.target.value)}
                                    className="input"
                                    style={{ flex: 1 }}
                                />
                                <input
                                    type="number"
                                    placeholder={PLAYERS.MAX}
                                    min="16"
                                    max="40"
                                    value={maxAge}
                                    onChange={(e) => setMaxAge(e.target.value)}
                                    className="input"
                                    style={{ flex: 1 }}
                                />
                            </div>
                        </div>

                        {/* Price Range */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>{PLAYER_STATS.MARKET_VALUE}</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="number"
                                    placeholder={PLAYERS.MIN}
                                    value={minPrice}
                                    onChange={(e) => setMinPrice(e.target.value)}
                                    className="input"
                                    style={{ flex: 1 }}
                                />
                                <input
                                    type="number"
                                    placeholder={PLAYERS.MAX}
                                    value={maxPrice}
                                    onChange={(e) => setMaxPrice(e.target.value)}
                                    className="input"
                                    style={{ flex: 1 }}
                                />
                            </div>
                        </div>

                        {/* Contract Status */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.75rem', color: 'var(--muted)' }}>Status Filters</label>
                            <div style={{ 
                                display: 'flex', 
                                gap: '0.5rem', 
                                flexWrap: 'wrap',
                                padding: '12px',
                                background: 'var(--bg-secondary, #f5f5f5)',
                                borderRadius: '8px',
                                border: '1px solid var(--border)'
                            }}>
                                <button
                                    onClick={() => setContractEndingSoon(!contractEndingSoon)}
                                    style={{
                                        flex: '0 0 auto',
                                        padding: '10px 16px',
                                        background: contractEndingSoon ? 'var(--primary)' : 'white',
                                        color: contractEndingSoon ? 'white' : 'var(--foreground)',
                                        border: contractEndingSoon ? 'none' : '1px solid var(--border)',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: contractEndingSoon ? '600' : '500',
                                        transition: 'all 0.2s',
                                        minWidth: '140px',
                                        textAlign: 'center'
                                    }}
                                >
                                    {contractEndingSoon ? '✓ ' : ''}Ending Soon
                                </button>
                                <button
                                    onClick={() => setShowFreeAgentsOnly(!showFreeAgentsOnly)}
                                    style={{
                                        flex: '0 0 auto',
                                        padding: '10px 16px',
                                        background: showFreeAgentsOnly ? 'var(--accent)' : 'white',
                                        color: showFreeAgentsOnly ? 'white' : 'var(--foreground)',
                                        border: showFreeAgentsOnly ? 'none' : '1px solid var(--border)',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: showFreeAgentsOnly ? '600' : '500',
                                        transition: 'all 0.2s',
                                        minWidth: '140px',
                                        textAlign: 'center'
                                    }}
                                >
                                    {showFreeAgentsOnly ? '✓ ' : ''}🆓 Free Agents
                                </button>
                                <button
                                    onClick={() => {
                                        console.log('[Players Page] Toggle Listed - Before:', showListedOnly);
                                        setShowListedOnly(!showListedOnly);
                                    }}
                                    style={{
                                        flex: '0 0 auto',
                                        padding: '10px 16px',
                                        background: showListedOnly ? 'var(--secondary)' : 'white',
                                        color: showListedOnly ? 'white' : 'var(--foreground)',
                                        border: showListedOnly ? 'none' : '1px solid var(--border)',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: showListedOnly ? '600' : '500',
                                        transition: 'all 0.2s',
                                        minWidth: '140px',
                                        textAlign: 'center'
                                    }}
                                >
                                    {showListedOnly ? '✓ ' : ''}🏷️ For Sale
                                </button>
                                <button
                                    onClick={() => setShowRetiredOnly(!showRetiredOnly)}
                                    style={{
                                        flex: '0 0 auto',
                                        padding: '10px 16px',
                                        background: showRetiredOnly ? '#6b7280' : 'white',
                                        color: showRetiredOnly ? 'white' : 'var(--foreground)',
                                        border: showRetiredOnly ? 'none' : '1px solid var(--border)',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: showRetiredOnly ? '600' : '500',
                                        transition: 'all 0.2s',
                                        minWidth: '140px',
                                        textAlign: 'center'
                                    }}
                                >
                                    {showRetiredOnly ? '✓ ' : ''}🏆 Retired
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                    <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={resetFilters}
                    >
                        {ACTIONS.RESET}
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => {}}>
                        {ACTIONS.APPLY}
                    </Button>
                </div>
            </Card>

            {/* Results Table */}
            <Card>
                <CardHeader>
                    <CardTitle>
                        {PLAYERS.RESULTS}: {filtered.length} {PLAYERS.PLAYERS_FOUND}
                    </CardTitle>
                </CardHeader>

                {/* Desktop Table - Using Cool Table Style from Design System */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => handleSortColumnClick('name')}>
                                    {PLAYER_STATS.NAME} {sortBy === 'name' && (sortOrder === 'desc' ? '↓' : '↑')}
                                </th>
                                <th style={{ padding: '12px', textAlign: 'center', width: '100px' }}>{PLAYER_STATS.POSITION}</th>
                                <th style={{ padding: '12px', textAlign: 'center', width: '70px', cursor: 'pointer' }} onClick={() => handleSortColumnClick('age')}>
                                    {PLAYER_STATS.AGE} {sortBy === 'age' && (sortOrder === 'desc' ? '↓' : '↑')}
                                </th>
                                <th style={{ padding: '12px', textAlign: 'center', width: '80px', cursor: 'pointer' }} onClick={() => handleSortColumnClick('power')}>
                                    {PLAYER_STATS.POWER} {sortBy === 'power' && (sortOrder === 'desc' ? '↓' : '↑')}
                                </th>
                                <th style={{ padding: '12px', textAlign: 'center', width: '80px', cursor: 'pointer' }} onClick={() => handleSortColumnClick('rating')}>
                                    {PLAYER_STATS.RATING} {sortBy === 'rating' && (sortOrder === 'desc' ? '↓' : '↑')}
                                </th>
                                <th style={{ padding: '12px', textAlign: 'center', width: '100px', cursor: 'pointer' }} onClick={() => handleSortColumnClick('price')}>
                                    {PLAYER_STATS.MARKET_VALUE} {sortBy === 'price' && (sortOrder === 'desc' ? '↓' : '↑')}
                                </th>
                                <th style={{ padding: '12px', textAlign: 'center', width: '100px' }}>Status</th>
                                <th style={{ padding: '12px', textAlign: 'left' }}>{PLAYER_STATS.TEAM}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedPlayers.map((player) => (
                                <tr 
                                    key={player.id} 
                                    onClick={() => openPlayerModal(player.id)}
                                    style={{ 
                                        borderBottom: '1px solid var(--border)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <td style={{ padding: '12px', fontWeight: '600' }}>{player.name}</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <span style={{ 
                                            background: 'var(--border)', 
                                            padding: '4px 10px', 
                                            borderRadius: '6px',
                                            fontSize: '0.85rem',
                                            fontWeight: '600'
                                        }}>
                                            {player.position}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>{player.age}</td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <span style={{ 
                                            color: getPowerColor(player.power),
                                            fontWeight: 'bold',
                                            fontSize: '1.05rem'
                                        }}>
                                            {player.power}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        <span style={{ fontWeight: 'bold' }}>{player.avgRating > 0 ? player.avgRating.toFixed(2) : '-'}</span>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>
                                        {formatCurrency(player.marketValue)}
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                        {player.isRetired ? (
                                            <span style={{
                                                background: '#6b7280',
                                                color: 'white',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                fontSize: '0.85rem',
                                                fontWeight: '600'
                                            }}>
                                                🏆 RETIRED
                                            </span>
                                        ) : player.transferStatus === 'LISTED' ? (
                                            <span style={{
                                                background: 'var(--secondary)',
                                                color: 'white',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                fontSize: '0.85rem',
                                                fontWeight: '600'
                                            }}>
                                                🏷️ FOR SALE
                                            </span>
                                        ) : player.transferStatus === 'FREE_AGENT' ? (
                                            <span style={{
                                                background: 'var(--accent)',
                                                color: 'white',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                fontSize: '0.85rem',
                                                fontWeight: '600'
                                            }}>
                                                🆓 FREE
                                            </span>
                                        ) : (
                                            <span style={{
                                                background: 'var(--border)',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                fontSize: '0.85rem',
                                                fontWeight: '600'
                                            }}>
                                                -
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        {player.isRetired ? (
                                            <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Retired</span>
                                        ) : (
                                            player.teamName || <span style={{ color: 'var(--muted)' }}>{PLAYERS.FREE_AGENT}</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden flex flex-col gap-3">
                    {paginatedPlayers.map((player) => (
                        <div
                            key={player.id}
                            className="card"
                            onClick={() => openPlayerModal(player.id)}
                            style={{ 
                                padding: '14px',
                                cursor: 'pointer',
                                border: '1px solid var(--border)',
                                borderRadius: '10px'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <div style={{ fontWeight: '700', fontSize: '1.05rem' }}>{player.name}</div>
                                <div style={{ 
                                    color: getPowerColor(player.power),
                                    fontWeight: 'bold',
                                    fontSize: '1.1rem'
                                }}>
                                    {player.power}
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', fontSize: '0.85rem', color: 'var(--muted)' }}>
                                <div>{PLAYER_STATS.POSITION}: <strong style={{ color: 'var(--foreground)' }}>{player.position}</strong></div>
                                <div>{PLAYER_STATS.AGE}: <strong style={{ color: 'var(--foreground)' }}>{player.age}</strong></div>
                                <div>{PLAYER_STATS.RATING}: <strong style={{ color: 'var(--foreground)' }}>{player.avgRating > 0 ? player.avgRating.toFixed(2) : '-'}</strong></div>
                            </div>
                            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--muted)', flex: 1 }}>
                                    {player.isRetired ? (
                                        <span style={{ fontStyle: 'italic', color: '#6b7280' }}>🏆 Retired</span>
                                    ) : (
                                        player.teamName || PLAYERS.FREE_AGENT
                                    )}
                                </div>
                                {player.transferStatus === 'LISTED' && (
                                    <span style={{
                                        background: 'var(--secondary)',
                                        color: 'white',
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: '600',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        🏷️ SALE
                                    </span>
                                )}
                                {player.isRetired && (
                                    <span style={{
                                        background: '#6b7280',
                                        color: 'white',
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: '600',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        🏆 RET
                                    </span>
                                )}
                                <div style={{ fontWeight: '600', color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                                    {formatCurrency(player.marketValue)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        >
                            ← {PLAYERS.PREVIOUS}
                        </Button>
                        <span style={{ padding: '6px 12px', fontWeight: '600' }}>
                            {currentPage} / {totalPages}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        >
                            {PLAYERS.NEXT} →
                        </Button>
                    </div>
                )}
            </Card>

            {/* Player Modal */}
            <PlayerModal />
        </div>
    );
}
