import Link from 'next/link';
import { getGameTime } from '@/lib/services/gameTime';

export default async function Home() {
    const gameInfo = await getGameTime();
    const gameDate = new Date(gameInfo.currentDate);
    const dateStr = gameDate.toLocaleDateString('th-TH', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'var(--primary)', color: 'white', padding: '2.5rem', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', margin: 0, fontWeight: '800' }}>แดชบอร์ด (Dashboard)</h1>
                    <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '1.1rem' }}>ยินดีต้อนรับกลับสู่ FOOTBALL MANAGER (TEXT)</p>
                </div>
                <div style={{ textAlign: 'right', background: 'rgba(255,255,255,0.2)', padding: '12px 24px', borderRadius: '12px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)' }}>
                    <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', opacity: 0.8 }}>วันที่ปัจจุบันในเกม</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700' }}>{dateStr}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                <section className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '24px' }}>
                    <div>
                        <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>🥅</div>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>การแข่งขันนัดถัดไป</h3>
                        <p style={{ color: 'var(--muted)', fontSize: '1rem', lineHeight: '1.5' }}>
                            เตรียมพร้อมสำหรับแมตช์ที่กำลังจะมาถึง จัดตารางซ้อมและวางแผนการเล่นให้พร้อม
                        </p>
                    </div>
                    <Link href="/match" className="btn btn-primary" style={{ marginTop: '2rem', padding: '12px' }}>
                        ไปที่สนามแข่ง
                    </Link>
                </section>

                <section className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '24px' }}>
                    <div>
                        <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>📈</div>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>ระบบลีก</h3>
                        <p style={{ color: 'var(--muted)', fontSize: '1rem', lineHeight: '1.5' }}>ติดตามความเคลื่อนไหวของลีก ตารางคะแนน และสถิติแข้งทอง</p>
                    </div>
                    <Link href="/league" className="btn" style={{ marginTop: '2rem', background: 'var(--accent)', color: 'white', padding: '12px' }}>
                        ดูตารางคะแนน
                    </Link>
                </section>

                <section className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '24px' }}>
                    <div>
                        <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>👕</div>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>จัดการทีม</h3>
                        <p style={{ color: 'var(--muted)', fontSize: '1rem', lineHeight: '1.5' }}>บริหารจัดการรายชื่อนักเตะ ต่อสัญญา และดูแลสภาพร่างกาย</p>
                    </div>
                    <Link href="/squad" className="btn" style={{ marginTop: '2rem', background: 'var(--sidebar-bg)', color: 'white', padding: '12px' }}>
                        จัดการนักเตะ
                    </Link>
                </section>
            </div>

            <footer style={{ marginTop: '2rem', padding: '2rem', borderTop: '1px solid var(--border)', textAlign: 'center', color: 'var(--muted)' }}>
                <div style={{ fontWeight: '600' }}>FOOTBALL MANAGER (TEXT)</div>
                <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>v0.2.0 - Season Management Update</div>
            </footer>
        </div>
    );
}
