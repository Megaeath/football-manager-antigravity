import type { DefensiveAssignment, MatchFrame, RoleIntent, V2TelemetrySummary } from './types2d';
import type { V2PlayerState } from './types2d';

const DEFAULT_SAMPLE_LIMIT = 160;

type PassSnapshot = {
    minute: number;
    from: string;
    to: string;
    utility: number;
    risk: number;
    successProbability: number;
};

export class V2TelemetryCollector {
    private intentCounts: Record<string, number> = {};
    private passSelections: PassSnapshot[] = [];
    private pressEvents = 0;
    private coverEvents = 0;
    private frameCount = 0;

    constructor(private readonly sampleLimit: number = DEFAULT_SAMPLE_LIMIT) {}

    countIntent(intent: RoleIntent): void {
        this.intentCounts[intent.job] = (this.intentCounts[intent.job] || 0) + 1;
    }

    countDefensiveAssignment(assignment: DefensiveAssignment): void {
        if (assignment.presser) this.pressEvents += 1;
        if (assignment.cover) this.coverEvents += 1;
    }

    recordPassSelection(snapshot: PassSnapshot): void {
        if (this.passSelections.length < this.sampleLimit) {
            this.passSelections.push(snapshot);
        }
    }

    recordFrame(): void {
        this.frameCount += 1;
    }

    finalize(): V2TelemetrySummary {
        const avgPassRisk = this.passSelections.length > 0
            ? this.passSelections.reduce((sum, item) => sum + item.risk, 0) / this.passSelections.length
            : 0;
        const avgPassUtility = this.passSelections.length > 0
            ? this.passSelections.reduce((sum, item) => sum + item.utility, 0) / this.passSelections.length
            : 0;

        return {
            frameCount: this.frameCount,
            intentJobCounts: this.intentCounts,
            pressEvents: this.pressEvents,
            coverEvents: this.coverEvents,
            passSelection: {
                sampleCount: this.passSelections.length,
                avgRisk: avgPassRisk,
                avgUtility: avgPassUtility,
                samples: this.passSelections,
            },
        };
    }
}

export function buildFrameDebug(
    frame: MatchFrame,
    homeIntents: Record<string, RoleIntent>,
    awayIntents: Record<string, RoleIntent>,
    homeAssignment: DefensiveAssignment,
    awayAssignment: DefensiveAssignment,
    homeLineX: number,
    awayLineX: number,
    homePlayers: V2PlayerState[],
    awayPlayers: V2PlayerState[],
): MatchFrame['debug'] {
    const homeIds = new Set(homePlayers.map((p) => p.id));
    const awayIds = new Set(awayPlayers.map((p) => p.id));
    const intents = Object.entries(frame.playerPositions).map(([playerId, position]) => {
        const team: 'home' | 'away' = homeIds.has(playerId) ? 'home' : awayIds.has(playerId) ? 'away' : 'home';
        const intent = homeIntents[playerId] || awayIntents[playerId];
        if (!intent) {
            return {
                playerId,
                team,
                from: position,
                to: position,
                job: 'POSITION' as RoleIntent['job'],
                priority: 0,
                utilityScore: 0,
                context: 'none',
            };
        }

        return {
            playerId,
            team,
            from: position,
            to: intent.targetPosition,
            job: intent.job,
            priority: intent.priority,
            utilityScore: intent.utilityScore,
            context: intent.context,
        };
    });

    return {
        intents,
        defensive: {
            home: {
                presserId: homeAssignment.presser?.id,
                coverId: homeAssignment.cover?.id,
                lineX: homeLineX,
            },
            away: {
                presserId: awayAssignment.presser?.id,
                coverId: awayAssignment.cover?.id,
                lineX: awayLineX,
            },
        },
    };
}

