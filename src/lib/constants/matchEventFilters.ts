export const MASTER_EVENT_FILTER_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'SHOT', label: 'Shoot' },
    { value: 'PASS', label: 'Pass' },
    { value: 'DRIBBLE', label: 'Dribble' },
] as const;

export type MasterEventFilterValue = typeof MASTER_EVENT_FILTER_OPTIONS[number]['value'];

export function toMasterEventCategory(eventType?: string | null): Exclude<MasterEventFilterValue, 'all'> | null {
    const normalized = String(eventType || '').toUpperCase();

    if (normalized === 'SHOT' || normalized === 'SHOOT' || normalized === 'GOAL' || normalized === 'MISS') {
        return 'SHOT';
    }

    if (normalized === 'PASS' || normalized === 'PASS_SHORT' || normalized === 'PASS_LONG') {
        return 'PASS';
    }

    if (normalized === 'DRIBBLE') {
        return 'DRIBBLE';
    }

    return null;
}
