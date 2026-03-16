import prisma from '@/lib/prisma';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
    const [teams, settings] = await Promise.all([
        prisma.team.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        }),
        prisma.globalGameSettings.findUnique({ where: { id: 1 } })
    ]);

    const currentUserTeamName = settings?.userTeamId
        ? (teams.find((t) => t.id === settings.userTeamId)?.name || '')
        : '';

    return (
        <SettingsClient
            teams={teams}
            currentUserTeamName={currentUserTeamName}
            yellowSuspensionThreshold={settings?.yellowSuspensionThreshold || 4}
        />
    );
}
