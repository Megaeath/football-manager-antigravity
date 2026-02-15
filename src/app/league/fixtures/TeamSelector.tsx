'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export default function TeamSelector({
    teams,
    currentTeamId
}: {
    teams: { id: string, name: string }[],
    currentTeamId?: string
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const teamId = e.target.value;
        const params = new URLSearchParams(searchParams);
        if (teamId) {
            params.set('teamId', teamId);
        } else {
            params.delete('teamId');
        }
        router.push(`${pathname}?${params.toString()}`);
    };

    return (
        <select
            name="teamId"
            defaultValue={currentTeamId || ""}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            onChange={handleChange}
        >
            <option value="">ทั้งหมด (All Teams)</option>
            {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
            ))}
        </select>
    );
}
