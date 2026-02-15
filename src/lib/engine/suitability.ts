import { PlayerAttributes, Position } from './types';

export function calculateSuitability(attributes: PlayerAttributes, targetPosition: string): number {
    let score = 0;
    const weights: Record<string, number> = {};

    // Define weights based on target position
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
        weights.crossing = 1; // Assuming we add crossing later, relying on passing for now
        weights.passing = 1;
    } else if (['DMC', 'DM'].includes(targetPosition)) {
        weights.tackling = 3;
        weights.stamina = 2;
        weights.positioning = 2;
        weights.passing = 2;
        weights.strength = 1;
    } else if (['MC', 'CM'].includes(targetPosition)) {
        weights.passing = 3;
        weights.vision = 3;
        weights.stamina = 2;
        weights.teamwork = 2;
        weights.technique = 1; // relying on dribbling/control proxy
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
        weights.offTheBall = 2; // proxy positioning
        weights.positioning = 2;
    }

    // Calculate weighted sum
    let totalWeight = 0;
    let currentSum = 0;

    Object.keys(weights).forEach(stat => {
        if (stat in attributes) {
            currentSum += (attributes[stat as keyof PlayerAttributes] || 0) * weights[stat];
            totalWeight += 20 * weights[stat]; // Max possible score (attr 20)
        }
    });

    if (totalWeight === 0) return 50; // Fallback

    return Math.round((currentSum / totalWeight) * 100);
}
