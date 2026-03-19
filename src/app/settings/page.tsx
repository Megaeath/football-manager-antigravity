import prisma from '@/lib/prisma';
import SettingsClient from './SettingsClient';
import { AI_PLAYSTYLE_PROFILES, DEFAULT_AI_PLAYSTYLE_ID } from '@/lib/services/aiPlaystyleProfiles';

export default async function SettingsPage() {
    const [teams, settings] = await Promise.all([
        prisma.team.findMany({
            select: { id: true, name: true, aiPlaystyleProfileId: true },
            orderBy: { name: 'asc' }
        }),
        prisma.globalGameSettings.findUnique({ where: { id: 1 } })
    ]);

    const currentUserTeamName = settings?.userTeamId
        ? (teams.find((t) => t.id === settings.userTeamId)?.name || '')
        : '';

    const currentUserTeamStyleProfileId = settings?.userTeamId
        ? (teams.find((t) => t.id === settings.userTeamId)?.aiPlaystyleProfileId || DEFAULT_AI_PLAYSTYLE_ID)
        : DEFAULT_AI_PLAYSTYLE_ID;

    const playstyleOptions = AI_PLAYSTYLE_PROFILES.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description
    }));

    return (
        <SettingsClient
            teams={teams}
            currentUserTeamName={currentUserTeamName}
            yellowSuspensionThreshold={settings?.yellowSuspensionThreshold || 4}
            currentUserTeamId={settings?.userTeamId || ''}
            currentUserTeamStyleProfileId={currentUserTeamStyleProfileId}
            playstyleOptions={playstyleOptions}
        />
    );
}
