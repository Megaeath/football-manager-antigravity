'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useBreadcrumb } from './BreadcrumbContext';

export default function Breadcrumbs() {
    const pathname = usePathname();
    const { names } = useBreadcrumb();

    if (pathname === '/') return null;

    const paths = pathname.split('/').filter(p => p);

    const translations: Record<string, string> = {
        'squad': 'จัดการทีม',
        'league': 'ระบบลีก',
        'match': 'จำลองการแข่ง',
        'fixtures': 'ผลการแข่งขัน',
        'stats': 'สถิติผู้เล่น',
        'table': 'ตารางคะแนน',
        'team': 'ข้อมูลทีม',
        'player': 'ข้อมูลนักเตะ'
    };

    return (
        <nav style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            fontSize: '0.85rem',
            color: 'var(--muted)',
            background: 'white',
            borderBottom: '1px solid var(--border)',
            overflowX: 'auto',
            whiteSpace: 'nowrap'
        }}>
            <Link href="/" style={{ color: 'var(--primary)', fontWeight: '500' }}>หน้าหลัก</Link>

            {paths.map((path, index) => {
                const href = `/${paths.slice(0, index + 1).join('/')}`;
                const isLast = index === paths.length - 1;

                // Priority: Dynamic Name > Translation > Path
                const name = names[path] || translations[path] || path;

                return (
                    <div key={href} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>/</span>
                        {isLast ? (
                            <span style={{ color: 'var(--foreground)', fontWeight: '600' }}>{name}</span>
                        ) : (
                            <Link href={href} style={{ color: 'var(--primary)', fontWeight: '500' }}>{name}</Link>
                        )}
                    </div>
                );
            })}
        </nav>
    );
}
