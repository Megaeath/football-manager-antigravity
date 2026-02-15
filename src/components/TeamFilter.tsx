'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

interface TeamFilterProps {
    teams: { id: string, name: string }[];
    selectedTeamId: string;
    selectedSeason: number;
}

export default function TeamFilter({ teams, selectedTeamId, selectedSeason }: TeamFilterProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    return (
        <div className="card" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <span>กรองตามทีม:</span>
            <select
                value={selectedTeamId}
                onChange={(e) => {
                    const id = e.target.value;
                    const params = new URLSearchParams(searchParams);
                    if (id) {
                        params.set('teamId', id);
                    } else {
                        params.delete('teamId');
                    }
                    router.push(`${pathname}?${params.toString()}`);
                }}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer' }}
            >
                <option value="">-- ทั้งหมด --</option>
                {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                ))}
            </select>
        </div>
    );
}
