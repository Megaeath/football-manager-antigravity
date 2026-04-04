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
                // Get basic info and user team ID first
                const infoRes = await fetch('/api/game/info');
                const infoData = await infoRes.json();
                const teamId = infoData.userTeamId;

                if (teamId) {
                    // Fetch consolidated notifications
                    const summaryRes = await fetch(`/api/game/sidebar-summary?teamId=${teamId}`);
                    if (summaryRes.ok) {
                        const summary = await summaryRes.json();
                        setIncomingBidsCount(summary.notifications.incomingBids || 0);
                        setExpiringContractsCount(summary.notifications.expiringContracts || 0);
                    }

                    // Training alerts (separate for now as it needs full state for logic)
                    const trainingRes = await fetch('/api/training');
                    if (trainingRes.ok) {
                        const trainingData = await trainingRes.json();
                        const slots = trainingData?.slots || [];
                        const players = trainingData?.players || [];
                        const playerMap = new Map(players.map((p: any) => [p.id, p]));

                        let alerts = 0;
                        for (const slot of slots) {
                            const player = slot.playerId ? playerMap.get(slot.playerId) : undefined;
                            if (!slot.playerId || !slot.focusAttribute || !slot.isActive || (slot.playerId && !player)) {
                                alerts++;
                                continue;
                            }
                            const focusedValue = player?.effectiveAttributes?.[slot.focusAttribute] ?? 0;
                            if (focusedValue >= 20) {
                                alerts++;
                            }
                        }
                        setTrainingAlertCount(alerts);
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
        { name: 'Home', href: '/', icon: '🏠' },
        { name: 'Squad', href: '/squad', icon: '📋' },
        { name: 'Fixtures', href: '/fixtures', icon: '📅' },
        { name: 'League', href: '/league', icon: '🏆' },
        { name: 'Cup', href: '/cup', icon: '🥇' },
        { name: 'Market', href: '/market', icon: '💱' },
        { name: 'News', href: '/news', icon: '📰' },
        { name: 'Season Summary', href: '/season-summary', icon: '🏅' },
        { name: 'Rankings', href: '/rankings', icon: '📊' },
        { name: 'Players', href: '/players', icon: '🔍' },
        { name: 'Finances', href: '/finances', icon: '💰' },
        { name: 'Contracts', href: '/contracts', icon: '📄' },
        { name: 'Match', href: '/match', icon: '⚽' },
        { name: 'Training', href: '/training', icon: '🏋️' },
        { name: 'Settings', href: '/settings', icon: '⚙️' },
    ];

    // Sidebar content component
    const SidebarContent = () => (
        <>
            <div style={{ padding: '16px 14px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <h1 style={{ fontSize: '1.1rem', margin: 0, color: 'white', letterSpacing: '0.6px' }}>FM ⚽</h1>
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
