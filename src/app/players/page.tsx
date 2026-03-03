'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PlayerModal from '@/components/PlayerModal';

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
}

type SortField = 'power' | 'rating' | 'price' | 'age' | 'name';

export default function PlayersPage() {
    const router = useRouter();
    const [players, setPlayers] = useState<Player[]>([]);
    const [filtered, setFiltered] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);

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
    const [sortBy, setSortBy] = useState<SortField>('power');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const positions = ['GK', 'DC', 'DR', 'DL', 'DMC', 'MC', 'AMC', 'MR', 'ML', 'FWC'];

    const handleSortColumnClick = (field: SortField) => {
        if (sortBy === field) {
            // Toggle order if same column
            setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
        } else {
            // Change column and default to desc
            setSortBy(field);
            setSortOrder('desc');
        }
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

        // Filter by name
        if (searchName) {
            result = result.filter(p =>
                p.name.toLowerCase().includes(searchName.toLowerCase())
            );
        }

        // Filter by power
        if (minPower) result = result.filter(p => p.power >= parseInt(minPower));
        if (maxPower) result = result.filter(p => p.power <= parseInt(maxPower));

        // Filter by price
        if (minPrice) result = result.filter(p => p.marketValue >= parseInt(minPrice));
        if (maxPrice) result = result.filter(p => p.marketValue <= parseInt(maxPrice));

        // Filter by age
        if (minAge) result = result.filter(p => p.age >= parseInt(minAge));
        if (maxAge) result = result.filter(p => p.age <= parseInt(maxAge));

        // Filter by position
        if (selectedPosition) result = result.filter(p => p.position.startsWith(selectedPosition));

        // Filter by team
        if (selectedTeam) result = result.filter(p => p.teamId === selectedTeam);

        // Filter by contract
        if (contractEndingSoon) {
            result = result.filter(p => p.contractEndWeek && p.contractEndWeek <= 10);
        }

        // Filter by free agents
        if (showFreeAgentsOnly) {
            result = result.filter(p => !p.teamId);
        }

        // Sort
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
    }, [players, searchName, minPower, maxPower, minPrice, maxPrice, minAge, maxAge, selectedTeam, selectedPosition, contractEndingSoon, showFreeAgentsOnly, sortBy, sortOrder]);

    // Get unique teams (excluding free agents)
    const uniqueTeams = Array.from(new Set(players.filter(p => p.teamId).map(p => p.teamId as string)))
        .map(id => {
            const player = players.find(p => p.teamId === id);
            return { id, name: player?.teamName || 'Unknown' };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

    // Pagination
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

    const openPlayerModal = (playerId: string) => {
        router.push(`/players?playerId=${playerId}`);
    };

    if (loading) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem' }}>🔍 กำลังโหลดข้อมูลนักเตะ...</div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                color: 'white',
                padding: '2rem',
                borderRadius: '12px'
            }}>
                <h1 style={{ margin: 0, fontSize: '2rem' }}>🔍 ค้นหานักเตะ</h1>
                <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9 }}>ค้นหาและตัดสินใจด้วยตัวกรองที่ยืดหยุ่น (ในอนาคตจะเป็นระบบซื้อขาย)</p>
            </div>

            {/* Search Section */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>🎯 ค้นหาและกรอง</h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.8rem', marginBottom: '1rem' }}>
                    {/* Name Search */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>ชื่อนักเตะ</label>
                        <input
                            type="text"
                            placeholder="พิมพ์ชื่อ..."
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                                fontSize: '0.95rem',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    {/* Power Range */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>พลัง</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="number"
                                placeholder="Min"
                                min="0"
                                max="100"
                                value={minPower}
                                onChange={(e) => setMinPower(e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: '10px 12px',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    fontSize: '0.95rem'
                                }}
                            />
                            <input
                                type="number"
                                placeholder="Max"
                                min="0"
                                max="100"
                                value={maxPower}
                                onChange={(e) => setMaxPower(e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: '10px 12px',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    fontSize: '0.95rem'
                                }}
                            />
                        </div>
                    </div>

                    {/* Price Range */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>ราคา ($)</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="number"
                                placeholder="Min"
                                value={minPrice}
                                onChange={(e) => setMinPrice(e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: '10px 12px',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    fontSize: '0.95rem'
                                }}
                            />
                            <input
                                type="number"
                                placeholder="Max"
                                value={maxPrice}
                                onChange={(e) => setMaxPrice(e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: '10px 12px',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    fontSize: '0.95rem'
                                }}
                            />
                        </div>
                    </div>

                    {/* Age Range */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>อายุ</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="number"
                                placeholder="Min"
                                min="16"
                                max="40"
                                value={minAge}
                                onChange={(e) => setMinAge(e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: '10px 12px',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    fontSize: '0.95rem'
                                }}
                            />
                            <input
                                type="number"
                                placeholder="Max"
                                min="16"
                                max="40"
                                value={maxAge}
                                onChange={(e) => setMaxAge(e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: '10px 12px',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    fontSize: '0.95rem'
                                }}
                            />
                        </div>
                    </div>

                    {/* Position */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>ตำแหน่ง</label>
                        <select
                            value={selectedPosition}
                            onChange={(e) => setSelectedPosition(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                                fontSize: '0.95rem',
                                boxSizing: 'border-box'
                            }}
                        >
                            <option value="">ทั้งหมด</option>
                            {positions.map(pos => (
                                <option key={pos} value={pos}>{pos}</option>
                            ))}
                        </select>
                    </div>

                    {/* Team */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>ทีม</label>
                        <select
                            value={selectedTeam}
                            onChange={(e) => setSelectedTeam(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                                fontSize: '0.95rem',
                                boxSizing: 'border-box'
                            }}
                        >
                            <option value="">ทั้งหมด</option>
                            {uniqueTeams.map(team => (
                                <option key={team.id} value={team.id}>{team.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Contract Ending Soon */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>สัญญา</label>
                        <button
                            onClick={() => setContractEndingSoon(!contractEndingSoon)}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                background: contractEndingSoon ? 'var(--primary)' : 'var(--border)',
                                color: contractEndingSoon ? 'white' : 'var(--text)',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.95rem',
                                fontWeight: '500'
                            }}
                        >
                            {contractEndingSoon ? '✓ ใกล้หมด (≤10 อ.)' : 'สัญญาใกล้หมด'}
                        </button>
                    </div>

                    {/* Free Agents Only */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>นักเตะอิสระ</label>
                        <button
                            onClick={() => setShowFreeAgentsOnly(!showFreeAgentsOnly)}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                background: showFreeAgentsOnly ? '#ff9800' : 'var(--border)',
                                color: showFreeAgentsOnly ? 'white' : 'var(--text)',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.95rem',
                                fontWeight: '500'
                            }}
                        >
                            {showFreeAgentsOnly ? '⭐ นักเตะอิสระเท่านั้น' : '🆓 นักเตะอิสระ'}
                        </button>
                    </div>
                </div>

                {/* Clear Filters */}
                <button
                    onClick={() => {
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
                        setSortBy('power');
                        setSortOrder('desc');
                    }}
                    style={{
                        padding: '10px 20px',
                        background: 'var(--border)',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: '500'
                    }}
                >
                    🔄 ล้างตัวกรอง
                </button>
            </div>

            {/* Results */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h3 style={{ margin: 0 }}>📋 ผลลัพธ์: {filtered.length} นักเตะ</h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>💡 คลิกที่ header ของตารางเพื่อเรียงลำดับ</p>
                </div>

                {filtered.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
                        <div style={{ fontSize: '1.2rem' }}>😕 ไม่พบนักเตะตามเงื่อนไขที่เลือก</div>
                    </div>
                ) : (
                    <>
                        <div style={{
                            overflowX: 'auto',
                            marginBottom: '1rem',
                            borderRadius: '8px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}>
                            <table style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: '0.9rem'
                            }}>
                                <thead style={{ background: '#f5f5f5' }}>
                                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                        <th
                                            onClick={() => handleSortColumnClick('name')}
                                            style={{
                                                padding: '12px',
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                                fontWeight: sortBy === 'name' ? '700' : '600',
                                                background: sortBy === 'name' ? '#e8f4f8' : 'transparent'
                                            }}
                                            title="คลิกเพื่อเรียงลำดับ"
                                        >
                                            ชื่อ {sortBy === 'name' && (sortOrder === 'desc' ? '↓' : '↑')}
                                        </th>
                                        <th
                                            onClick={() => handleSortColumnClick('power')}
                                            style={{
                                                padding: '12px',
                                                textAlign: 'center',
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                                fontWeight: sortBy === 'power' ? '700' : '600',
                                                background: sortBy === 'power' ? '#e8f4f8' : 'transparent'
                                            }}
                                            title="คลิกเพื่อเรียงลำดับ"
                                        >
                                            พลัง {sortBy === 'power' && (sortOrder === 'desc' ? '↓' : '↑')}
                                        </th>
                                        <th
                                            onClick={() => handleSortColumnClick('rating')}
                                            style={{
                                                padding: '12px',
                                                textAlign: 'center',
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                                fontWeight: sortBy === 'rating' ? '700' : '600',
                                                background: sortBy === 'rating' ? '#e8f4f8' : 'transparent'
                                            }}
                                            title="คลิกเพื่อเรียงลำดับ"
                                        >
                                            Rating {sortBy === 'rating' && (sortOrder === 'desc' ? '↓' : '↑')}
                                        </th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>ตำแหน่ง</th>
                                        <th
                                            onClick={() => handleSortColumnClick('age')}
                                            style={{
                                                padding: '12px',
                                                textAlign: 'center',
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                                fontWeight: sortBy === 'age' ? '700' : '600',
                                                background: sortBy === 'age' ? '#e8f4f8' : 'transparent'
                                            }}
                                            title="คลิกเพื่อเรียงลำดับ"
                                        >
                                            อายุ {sortBy === 'age' && (sortOrder === 'desc' ? '↓' : '↑')}
                                        </th>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>ทีม</th>
                                        <th
                                            onClick={() => handleSortColumnClick('price')}
                                            style={{
                                                padding: '12px',
                                                textAlign: 'right',
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                                fontWeight: sortBy === 'price' ? '700' : '600',
                                                background: sortBy === 'price' ? '#e8f4f8' : 'transparent'
                                            }}
                                            title="คลิกเพื่อเรียงลำดับ"
                                        >
                                            ราคา {sortBy === 'price' && (sortOrder === 'desc' ? '↓' : '↑')}
                                        </th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>สัญญา</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>ซื้อขาย</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedPlayers.map((player, idx) => (
                                        <tr key={player.id} style={{
                                            borderBottom: '1px solid var(--border)',
                                            background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s'
                                        }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.08)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)'}
                                            onClick={() => openPlayerModal(player.id)}>
                                            <td style={{ padding: '12px' }}>
                                                <span style={{
                                                    color: 'var(--primary)',
                                                    fontWeight: '500',
                                                    textDecoration: 'underline'
                                                }}>
                                                    {player.name}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                <div style={{
                                                    display: 'inline-block',
                                                    background: getPowerColor(player.power),
                                                    color: 'white',
                                                    padding: '4px 12px',
                                                    borderRadius: '12px',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {player.power}
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center', fontWeight: '500' }}>
                                                {player.avgRating || '-'}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                <span style={{
                                                    background: 'var(--border)',
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    fontWeight: '500',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {player.position}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                {player.age}
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <span style={{ whiteSpace: 'nowrap' }}>
                                                    {player.teamId ? player.teamName : (
                                                        <span style={{ color: '#ff9800', fontWeight: 'bold' }}>🆓 นักเตะอิสระ</span>
                                                    )}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: '500' }}>
                                                ${player.marketValue.toLocaleString()}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                {player.contractEndWeek ? (
                                                    <div style={{
                                                        background: player.contractEndWeek <= 10 ? '#fecaca' : '#fef3c7',
                                                        color: player.contractEndWeek <= 10 ? '#991b1b' : '#92400e',
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '0.85rem',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {player.contractEndWeek} อ.
                                                    </div>
                                                ) : (
                                                    <span style={{ color: 'var(--muted)' }}>-</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/players?playerId=${player.id}&tab=transfer`);
                                                    }}
                                                    style={{
                                                        background: 'var(--success)',
                                                        color: 'white',
                                                        border: 'none',
                                                        padding: '6px 12px',
                                                        borderRadius: '4px',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 'bold',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    ซื้อ
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '0.5rem',
                                paddingTop: '1rem',
                                borderTop: '1px solid var(--border)',
                                flexWrap: 'wrap'
                            }}>
                                <button
                                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                    disabled={currentPage === 1}
                                    style={{
                                        padding: '8px 12px',
                                        background: currentPage === 1 ? 'var(--border)' : 'var(--primary)',
                                        color: currentPage === 1 ? 'var(--muted)' : 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: currentPage === 1 ? 'default' : 'pointer',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    ← ก่อนหน้า
                                </button>

                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    if (totalPages <= 5) return i + 1;
                                    if (currentPage <= 3) return i + 1;
                                    if (currentPage >= totalPages - 2) return totalPages - 4 + i;
                                    return currentPage - 2 + i;
                                }).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        style={{
                                            padding: '8px 12px',
                                            background: currentPage === page ? 'var(--primary)' : 'var(--border)',
                                            color: currentPage === page ? 'white' : 'var(--text)',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            fontWeight: currentPage === page ? '600' : '400',
                                            minWidth: '36px'
                                        }}
                                    >
                                        {page}
                                    </button>
                                ))}

                                <button
                                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                    disabled={currentPage === totalPages}
                                    style={{
                                        padding: '8px 12px',
                                        background: currentPage === totalPages ? 'var(--border)' : 'var(--primary)',
                                        color: currentPage === totalPages ? 'var(--muted)' : 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: currentPage === totalPages ? 'default' : 'pointer',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    ถัดไป →
                                </button>
                            </div>
                        )}

                        <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--muted)', marginTop: '1rem' }}>
                            หน้า {currentPage} / {totalPages}
                        </div>
                    </>
                )}
            </div>

            {/* Modal */}
            <PlayerModal />
        </div>
    );
}
