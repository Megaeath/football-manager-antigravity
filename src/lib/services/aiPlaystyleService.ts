import {
    AI_PLAYSTYLE_PROFILE_MAP,
    AI_PLAYSTYLE_PROFILES,
    DEFAULT_AI_PLAYSTYLE_ID,
    type PlaystyleCreativeFreedom,
    type PlaystylePassing,
    type AIPlaystyleProfile,
    type AIPlaystyleTactics,
} from './aiPlaystyleProfiles';

type TeamIdentity = {
    id: string;
    name?: string;
    aiPlaystyleProfileId?: string | null;
};

function hashString(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        hash = ((hash << 5) - hash) + input.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function normalizePassing(value: string | undefined | null): PlaystylePassing {
    const v = (value || '').toUpperCase();
    if (v === 'LONG') return 'DIRECT';
    if (v === 'DIRECT') return 'DIRECT';
    if (v === 'SHORT') return 'SHORT';
    return 'MIXED';
}

function normalizeCreativeFreedom(value: string | undefined | null): PlaystyleCreativeFreedom {
    const v = (value || '').toUpperCase();
    if (v === 'STRICT') return 'RESTRICTED';
    if (v === 'RESTRICTED') return 'RESTRICTED';
    if (v === 'FREEDOM') return 'MAXIMUM';
    if (v === 'MAXIMUM') return 'MAXIMUM';
    return 'NORMAL';
}

function normalizeAttackingFocus(value: string | undefined | null): AIPlaystyleTactics['attacking_focus'] {
    const v = (value || '').toUpperCase();
    if (v === 'CENTRAL' || v === 'FORWARD') return 'CENTER';
    if (v === 'LEFT' || v === 'RIGHT') return 'WINGS';
    if (v === 'CENTER' || v === 'WINGS') return v;
    return 'MIXED';
}

function normalizeTackling(value: string | undefined | null): AIPlaystyleTactics['tackling'] {
    const v = (value || '').toUpperCase();
    if (v === 'SOFT' || v === 'HARD') return v;
    return 'NORMAL';
}

function normalizeMentality(value: string | undefined | null): AIPlaystyleTactics['mentality'] {
    const v = (value || '').toUpperCase();
    if (v === 'ALL_OUT_ATTACK' || v === 'ATTACKING' || v === 'DEFENSIVE' || v === 'ULTRA_DEFENSIVE') {
        return v;
    }
    return 'NORMAL';
}

function normalizeFormation(value: string | undefined | null): AIPlaystyleTactics['formation'] {
    const v = (value || '').toUpperCase();
    if (v === '4-3-3' || v === '4-5-1') return v;
    return '4-4-2';
}

export function normalizePlaystyleTactics(tactics: AIPlaystyleTactics): AIPlaystyleTactics {
    return {
        formation: normalizeFormation(tactics.formation),
        mentality: normalizeMentality(tactics.mentality),
        passing: normalizePassing(tactics.passing),
        tackling: normalizeTackling(tactics.tackling),
        attacking_focus: normalizeAttackingFocus(tactics.attacking_focus),
        creative_freedom: normalizeCreativeFreedom(tactics.creative_freedom),
    };
}

export function getDefaultAIPlaystyle(): AIPlaystyleProfile {
    return AI_PLAYSTYLE_PROFILE_MAP.get(DEFAULT_AI_PLAYSTYLE_ID) || AI_PLAYSTYLE_PROFILES[0];
}

export function getAIPlaystyleById(id?: string | null): AIPlaystyleProfile {
    if (!id) return getDefaultAIPlaystyle();
    return AI_PLAYSTYLE_PROFILE_MAP.get(id) || getDefaultAIPlaystyle();
}

export function pickDeterministicAIPlaystyle(teamId: string): AIPlaystyleProfile {
    if (AI_PLAYSTYLE_PROFILES.length === 0) return getDefaultAIPlaystyle();
    const idx = hashString(teamId) % AI_PLAYSTYLE_PROFILES.length;
    return AI_PLAYSTYLE_PROFILES[idx];
}

export function resolveAIPlaystyleForTeam(team: TeamIdentity): AIPlaystyleProfile {
    if (team.aiPlaystyleProfileId) {
        return getAIPlaystyleById(team.aiPlaystyleProfileId);
    }
    return pickDeterministicAIPlaystyle(team.id);
}
