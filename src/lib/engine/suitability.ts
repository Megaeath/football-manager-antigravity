import { PlayerAttributes, Position } from './types';

export function calculateSuitability(attributes: PlayerAttributes, targetPosition: string): number {
    const weights: Record<string, number> = {};
    let defaultWeight = 0.5;

    // Define weights based on target position - these are relative importances, not absolute
    if (targetPosition === 'GK') {
        weights.handling = 3;
        weights.positioning = 2;
        weights.agility = 2;
        weights.composure = 1;
    } else if (['DC', 'CD'].includes(targetPosition)) {
        weights.tackling = 3;
        weights.heading = 3;
        weights.positioning = 2;
        weights.strength = 2;
        weights.bravery = 1;
    } else if (['DR', 'DL', 'FB'].includes(targetPosition)) {
        weights.tackling = 2;
        weights.pace = 3;
        weights.stamina = 2;
        weights.positioning = 1;
        weights.crossing = 1;
        weights.passing = 1;
    } else if (['DMC', 'DM'].includes(targetPosition)) {
        // Defensive Midfielder = ball-winner + deep playmaker bridge
        // Balance toward midfield intelligence/build-up, not pure center-back profile
        weights.tackling = 2.5;
        weights.passing = 2.5;
        weights.vision = 2;
        weights.teamwork = 2;
        weights.positioning = 2;
        weights.composure = 1.5;
        weights.stamina = 1.5;
        weights.aggression = 1;
        weights.strength = 0.75;
        defaultWeight = 0.2;
    } else if (['MC', 'CM'].includes(targetPosition)) {
        weights.passing = 3;
        weights.vision = 3;
        weights.stamina = 2;
        weights.teamwork = 2;
        weights.dribbling = 1;
    } else if (['MR', 'ML', 'W'].includes(targetPosition)) {
        weights.pace = 3;
        weights.dribbling = 3;
        weights.passing = 2;
        weights.acceleration = 2;
        weights.stamina = 1;
    } else if (['AMC', 'AM'].includes(targetPosition)) {
        weights.passing = 3;
        weights.dribbling = 3;
        weights.vision = 3;
        weights.shooting = 2;
        weights.composure = 1;
    } else if (['FW', 'ST', 'FWC', 'FWR', 'FWL'].includes(targetPosition)) {
        weights.shooting = 3;
        weights.heading = 2;
        weights.pace = 2;
        weights.composure = 2;
        weights.positioning = 2;
    }

    // Calculate weighted sum of attributes that matter for the position
    let weightedSum = 0;
    let totalWeight = 0;
    let attributeCount = 0;

    // Include all attributes but weight those relevant to position more heavily
    const allAttributeKeys: (keyof PlayerAttributes)[] = [
        'handling', 'tackling', 'passing', 'shooting', 'heading', 'dribbling',
        'crossing', 'setPieces', 'throw', 'aggression', 'positioning', 'vision',
        'bravery', 'leadership', 'teamwork', 'composure', 'pace', 'acceleration',
        'stamina', 'strength', 'agility', 'balance'
    ];

    allAttributeKeys.forEach(stat => {
        const attrValue = attributes[stat] || 0;
        const weight = weights[stat] || defaultWeight; // Default weight for non-position attributes
        weightedSum += attrValue * weight;
        totalWeight += weight;
        if (attrValue > 0) attributeCount++;
    });

    if (totalWeight === 0) return 50;

    const baseScore = (weightedSum / totalWeight / 20) * 100;

    // --- Role profile correction ---
    // Helps prevent ball-winning/connector midfielders from being rated as better DC than MC.
    const midfieldProfile = (
        (attributes.passing || 0) +
        (attributes.vision || 0) +
        (attributes.teamwork || 0) +
        (attributes.composure || 0) +
        (attributes.stamina || 0) +
        (attributes.positioning || 0)
    ) / 6;

    const defenderProfile = (
        (attributes.tackling || 0) +
        (attributes.heading || 0) +
        (attributes.strength || 0) +
        (attributes.bravery || 0) +
        (attributes.positioning || 0)
    ) / 5;

    let adjustedBaseScore = baseScore;
    const profileDelta = midfieldProfile - defenderProfile;

    if (['MC', 'CM', 'DMC', 'DM', 'AMC'].includes(targetPosition)) {
        // Midfielders get a lift when midfield traits exceed defender traits
        adjustedBaseScore += profileDelta * 0.9;
    } else if (['DC', 'CD'].includes(targetPosition)) {
        // DC gets a mild penalty when player is clearly midfield-oriented
        adjustedBaseScore -= Math.max(0, profileDelta) * 0.9;
    }

    // DMC should remain close to midfield profile (link play), not purely defender profile.
    if (['DMC', 'DM'].includes(targetPosition)) {
        const bridgeWeights: Record<keyof PlayerAttributes, number> = {
            handling: 0,
            tackling: 1.5,
            passing: 3,
            shooting: 0,
            heading: 0,
            dribbling: 1,
            crossing: 0,
            setPieces: 0,
            throw: 0,
            aggression: 1,
            positioning: 2,
            vision: 2.5,
            bravery: 0.5,
            leadership: 0.5,
            teamwork: 2.5,
            composure: 2,
            pace: 0,
            acceleration: 0,
            stamina: 2,
            strength: 1,
            agility: 0,
            balance: 0
        };

        let bridgeSum = 0;
        let bridgeWeightTotal = 0;
        for (const stat of allAttributeKeys) {
            const w = bridgeWeights[stat] || 0;
            if (w <= 0) continue;
            bridgeSum += (attributes[stat] || 0) * w;
            bridgeWeightTotal += w;
        }

        const bridgeScore = bridgeWeightTotal > 0 ? (bridgeSum / bridgeWeightTotal / 20) * 100 : adjustedBaseScore;
        return Math.round(adjustedBaseScore * 0.7 + bridgeScore * 0.3);
    }

    // Return as percentage where 20 = 100%
    return Math.round(adjustedBaseScore);
}
