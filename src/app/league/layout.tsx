import Link from 'next/link';

export default function LeagueLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {children}
        </div>
    );
}
