'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
    const pathname = usePathname();

    const navItems = [
        { name: 'หน้าหลัก', href: '/', icon: '🏠' },
        { name: 'จัดการทีม', href: '/squad', icon: '📋' },
        { name: 'ตารางการแข่งขัน', href: '/fixtures', icon: '📅' },
        { name: 'ระบบลีก', href: '/league', icon: '🏆' },
        { name: 'สรุปฤดูกาล', href: '/season-summary', icon: '🏅' },
        { name: 'อันดับนักเตะ', href: '/rankings', icon: '📊' },
        { name: 'ค้นหานักเตะ', href: '/players', icon: '🔍' },
        { name: 'การเงิน', href: '/finances', icon: '💰' },
        { name: 'สัญญา', href: '/contracts', icon: '📄' },
        { name: 'จำลองการแข่ง', href: '/match', icon: '⚽' },
    ];

    return (
        <aside style={{
            width: 'var(--sidebar-width)',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            background: 'var(--sidebar-bg)',
            color: 'var(--sidebar-text)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 100,
            borderRight: '1px solid var(--border)'
        }}>
            <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <h1 style={{ fontSize: '1.25rem', margin: 0, color: 'white', letterSpacing: '1px' }}>FM TEXT ⚽</h1>
            </div>

            <nav style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
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
        </aside>
    );
}
