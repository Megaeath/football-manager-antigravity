'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();
    const [incomingBidsCount, setIncomingBidsCount] = useState(0);
    const [expiringContractsCount, setExpiringContractsCount] = useState(0);
    const [trainingAlertCount, setTrainingAlertCount] = useState(0);

    useEffect(() => {
        if (isOpen) {
            onClose();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    useEffect(() => {
        // Fetch notification counters for sidebar badges
        const fetchMenuNotiCounts = async () => {
            try {
                const userRes = await fetch('/api/game/info');
                const userData = await userRes.json();
                
                if (userData.userTeamId) {
                    const bidsRes = await fetch(`/api/market/incoming-bids?teamId=${userData.userTeamId}`);
                    if (bidsRes.ok) {
                        const data = await bidsRes.json();
                        setIncomingBidsCount(data.count || 0);
                    }

                    const contractsRes = await fetch(`/api/contracts?teamId=${userData.userTeamId}`);
                    if (contractsRes.ok) {
                        const contractsData = await contractsRes.json();
                        setExpiringContractsCount(contractsData.totalExpiring || 0);
                    }

                    // Training alerts:
                    // 1) Empty/unconfigured slots (needs assignment)
                    // 2) Slots where focus attribute already reached cap 20 (needs change)
                    const trainingRes = await fetch('/api/training');
                    if (trainingRes.ok) {
                        const trainingData = await trainingRes.json();

                        const slots: Array<{
                            playerId: string | null;
                            focusAttribute: string | null;
                            isActive: boolean;
                        }> = trainingData?.slots || [];

                        const players: Array<{
                            id: string;
                            effectiveAttributes?: Record<string, number>;
                        }> = trainingData?.players || [];

                        const playerMap = new Map(players.map((p) => [p.id, p]));

                        let emptyOrUnconfigured = 0;
                        let reachedCap = 0;

                        for (const slot of slots) {
                            // Slot needs user action if no player, no attribute, inactive,
                            // OR player has left the team (stale assignment)
                            const player = slot.playerId ? playerMap.get(slot.playerId) : undefined;
                            if (!slot.playerId || !slot.focusAttribute || !slot.isActive || (slot.playerId && !player)) {
                                emptyOrUnconfigured++;
                                continue;
                            }

                            const focusedValue = player?.effectiveAttributes?.[slot.focusAttribute] ?? 0;

                            // If focused training stat is already capped, slot should be reassigned
                            if (focusedValue >= 20) {
                                reachedCap++;
                            }
                        }

                        setTrainingAlertCount(emptyOrUnconfigured + reachedCap);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch sidebar notification counts:', error);
            }
        };

        fetchMenuNotiCounts();
        // Refresh every 30 seconds
        const interval = setInterval(fetchMenuNotiCounts, 30000);
        return () => clearInterval(interval);
    }, []);

    const navItems = [
        { name: 'หน้าหลัก', href: '/', icon: '🏠' },
        { name: 'จัดการทีม', href: '/squad', icon: '📋' },
        { name: 'ตารางการแข่งขัน', href: '/fixtures', icon: '📅' },
        { name: 'ระบบลีก', href: '/league', icon: '🏆' },
        { name: 'ตลาดซื้อขาย', href: '/market', icon: '💱' },
        { name: 'ข่าวสาร', href: '/news', icon: '📰' },
        { name: 'สรุปฤดูกาล', href: '/season-summary', icon: '🏅' },
        { name: 'อันดับนักเตะ', href: '/rankings', icon: '📊' },
        { name: 'ค้นหานักเตะ', href: '/players', icon: '🔍' },
        { name: 'การเงิน', href: '/finances', icon: '💰' },
        { name: 'สัญญา', href: '/contracts', icon: '📄' },
        { name: 'จำลองการแข่ง', href: '/match', icon: '⚽' },
        { name: 'การฝึกซ้อม', href: '/training', icon: '🏋️' },
        { name: 'ตั้งค่า', href: '/settings', icon: '⚙️' },
    ];

    // Sidebar content component
    const SidebarContent = () => (
        <>
            <div style={{ padding: '16px 14px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <h1 style={{ fontSize: '1.1rem', margin: 0, color: 'white', letterSpacing: '0.6px' }}>FM TEXT ⚽</h1>
            </div>

            <nav style={{
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
                flex: 1,
                overflowY: 'auto'
            }}>
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                    const isNews = item.href === '/news';
                    const isContracts = item.href === '/contracts';
                    const isTraining = item.href === '/training';
                    const badgeCount = isNews
                        ? incomingBidsCount
                        : isContracts
                            ? expiringContractsCount
                            : isTraining
                                ? trainingAlertCount
                                : 0;
                    const showBadge = badgeCount > 0;
                    const badgeBg = isNews ? '#ef4444' : isContracts ? '#f59e0b' : '#2563eb';
                    
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={onClose}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '9px 12px',
                                borderRadius: '7px',
                                background: isActive ? 'var(--primary)' : 'transparent',
                                color: isActive ? 'white' : 'var(--sidebar-text)',
                                fontWeight: isActive ? '600' : '400',
                                transition: 'all 0.2s ease',
                                position: 'relative',
                                fontSize: '0.92rem',
                                lineHeight: 1.2
                            }}
                        >
                            <span style={{ fontSize: '1.05rem' }}>{item.icon}</span>
                            {item.name}
                            {showBadge && (
                                <span style={{
                                    position: 'absolute',
                                    right: '12px',
                                    background: badgeBg,
                                    color: 'white',
                                    fontSize: '0.7rem',
                                    fontWeight: 'bold',
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '99px',
                                    minWidth: '20px',
                                    textAlign: 'center',
                                    boxShadow: isNews
                                        ? '0 2px 8px rgba(239, 68, 68, 0.4)'
                                        : isContracts
                                            ? '0 2px 8px rgba(245, 158, 11, 0.4)'
                                            : '0 2px 8px rgba(37, 99, 235, 0.4)'
                                }}>
                                    {badgeCount}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                v0.1.0 Alpha Build
            </div>
        </>
    );

    return (
        <>
            {/* Mobile: Overlay backdrop */}
            <div
                className={`fixed inset-0 z-[110] bg-black/40 transition-opacity md:hidden ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Mobile: Fixed drawer */}
            <aside
                className={`fixed left-0 top-0 z-[120] flex h-screen w-[var(--sidebar-width)] flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)] text-[var(--sidebar-text)] transition-transform duration-300 md:hidden ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <SidebarContent />
            </aside>

            {/* Desktop: Sticky sidebar in document flow */}
            <aside className="hidden md:flex sticky top-0 w-[var(--sidebar-width)] flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)] text-[var(--sidebar-text)] h-screen overflow-y-auto">
                <SidebarContent />
            </aside>
        </>
    );
}
