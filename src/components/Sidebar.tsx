'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();

    useEffect(() => {
        if (isOpen) {
            onClose();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

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
    ];

    // Sidebar content component
    const SidebarContent = () => (
        <>
            <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <h1 style={{ fontSize: '1.25rem', margin: 0, color: 'white', letterSpacing: '1px' }}>FM TEXT ⚽</h1>
            </div>

            <nav style={{
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                flex: 1,
                overflowY: 'auto'
            }}>
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={onClose}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px 16px',
                                borderRadius: '8px',
                                background: isActive ? 'var(--primary)' : 'transparent',
                                color: isActive ? 'white' : 'var(--sidebar-text)',
                                fontWeight: isActive ? '600' : '400',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
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

            {/* Desktop: Static sidebar in document flow */}
            <aside className="hidden md:flex w-[var(--sidebar-width)] flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)] text-[var(--sidebar-text)] h-screen">
                <SidebarContent />
            </aside>
        </>
    );
}
