'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface PlayerData {
    id: string;
    name: string;
    age: number;
    position: string;
    power: number;
    avgRating: number;
    marketValue: number;
    contractEndWeek: number | null;
    teamId: string;
    teamName: string;
    handling: number;
    tackling: number;
    passing: number;
    shooting: number;
    heading: number;
    dribbling: number;
}

interface PlayerSearchModalProps {
    playerId: string;
    isOpen: boolean;
    onClose: () => void;
}

export default function PlayerSearchModal({ playerId, isOpen, onClose }: PlayerSearchModalProps) {
    const [player, setPlayer] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !playerId) return;

        const fetchPlayer = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/player/${playerId}`);
                const data = await res.json();
                setPlayer(data);
            } catch (error) {
                console.error('Error fetching player:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPlayer();
    }, [playerId, isOpen]);

    if (!isOpen) return null;

    return (
        <div onClick={onClose} style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
            <div onClick={(e) => e.stopPropagation()} style={{
                background: 'var(--bg)',
                borderRadius: '12px',
                padding: '0',
                maxWidth: '500px',
                width: '90%',
                maxHeight: '80vh',
                overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}>
                {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center' }}>
                        <div>กำลังโหลด...</div>
                    </div>
                ) : player ? (
                    <>
                        {/* Header */}
                        <div style={{
                            background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                            color: 'white',
                            padding: '1.5rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start'
                        }}>
                            <div style={{ flex: 1 }}>
                                <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>
                                    {player.name}
                                </h2>
                                <div style={{ opacity: 0.9, fontSize: '0.95rem' }}>
                                    {player.team?.name} • {player.position} • {player.age} ปี
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                style={{
                                    background: 'rgba(255,255,255,0.2)',
                                    border: 'none',
                                    color: 'white',
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '50%',
                                    cursor: 'pointer',
                                    fontSize: '1.2rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Stats Grid */}
                        <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                            {/* Power */}
                            <div style={{
                                background: 'var(--card-bg)',
                                padding: '1rem',
                                borderRadius: '8px',
                                border: '1px solid var(--border)'
                            }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>พลัง</div>
                                <div style={{
                                    fontSize: '2rem',
                                    fontWeight: 'bold',
                                    color: player.power >= 80 ? '#4caf50' : player.power >= 70 ? '#8bc34a' : player.power >= 60 ? '#ffc107' : player.power >= 50 ? '#ff9800' : '#f44336'
                                }}>
                                    {player.power}
                                </div>
                            </div>

                            {/* Average Rating */}
                            <div style={{
                                background: 'var(--card-bg)',
                                padding: '1rem',
                                borderRadius: '8px',
                                border: '1px solid var(--border)'
                            }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>ค่า Average Rating</div>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                                    {player.avgRating || '-'}
                                </div>
                            </div>

                            {/* Market Value */}
                            <div style={{
                                background: 'var(--card-bg)',
                                padding: '1rem',
                                borderRadius: '8px',
                                border: '1px solid var(--border)'
                            }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>ราคา</div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>
                                    ${player.marketValue?.toLocaleString() || '-'}
                                </div>
                            </div>

                            {/* Contract */}
                            <div style={{
                                background: 'var(--card-bg)',
                                padding: '1rem',
                                borderRadius: '8px',
                                border: '1px solid var(--border)'
                            }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>สัญญา</div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>
                                    {player.contractEndWeek ? `${player.contractEndWeek} อ.` : '-'}
                                </div>
                            </div>
                        </div>

                        {/* Attributes */}
                        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)' }}>
                            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600' }}>ความสามารถ</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Handling</span>
                                    <span style={{ fontWeight: 'bold' }}>{player.handling}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Tackling</span>
                                    <span style={{ fontWeight: 'bold' }}>{player.tackling}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Passing</span>
                                    <span style={{ fontWeight: 'bold' }}>{player.passing}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Shooting</span>
                                    <span style={{ fontWeight: 'bold' }}>{player.shooting}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Heading</span>
                                    <span style={{ fontWeight: 'bold' }}>{player.heading}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Dribbling</span>
                                    <span style={{ fontWeight: 'bold' }}>{player.dribbling}</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.75rem' }}>
                            <Link href={`/player/${player.id}`} style={{
                                flex: 1,
                                padding: '10px 16px',
                                background: 'var(--primary)',
                                color: 'white',
                                borderRadius: '6px',
                                textDecoration: 'none',
                                textAlign: 'center',
                                fontSize: '0.9rem',
                                fontWeight: '500'
                            }}>
                                ดูรายละเอียดเต็ม
                            </Link>
                            <button onClick={onClose} style={{
                                flex: 1,
                                padding: '10px 16px',
                                background: 'var(--border)',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: '500'
                            }}>
                                ปิด
                            </button>
                        </div>
                    </>
                ) : (
                    <div style={{ padding: '2rem', textAlign: 'center' }}>
                        <div>ไม่พบข้อมูลนักเตะ</div>
                    </div>
                )}
            </div>
        </div>
    );
}
