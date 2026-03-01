// Test suitability calculation

function calculateSuitability(attributes, targetPosition) {
    const weights = {};

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
        weights.crossing = 1;
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

    // Calculate weighted sum
    let totalWeight = 0;
    let currentSum = 0;

    Object.keys(weights).forEach(stat => {
        if (stat in attributes) {
            const attrValue = attributes[stat] || 0;
            currentSum += attrValue * weights[stat];
            totalWeight += weights[stat];
        }
    });

    if (totalWeight === 0) return 50;

    // New formula
    return Math.round((currentSum / totalWeight / 20) * 100);
}

// Test with a typical attribute
const testAttrs = {
    handling: 3,
    tackling: 5,
    passing: 6,
    shooting: 8,
    heading: 4,
    dribbling: 5,
    crossing: 2,
    setPieces: 3,
    throw: 2,
    aggression: 6,
    positioning: 4,
    vision: 5,
    bravery: 4,
    leadership: 3,
    teamwork: 5,
    composure: 6,
    pace: 7,
    acceleration: 6,
    stamina: 5,
    strength: 5,
    agility: 5,
    balance: 5
};

console.log('Testing suitability calculation:');
console.log('FW position: ', calculateSuitability(testAttrs, 'FW'));
console.log('ST position: ', calculateSuitability(testAttrs, 'ST'));
console.log('CM position: ', calculateSuitability(testAttrs, 'CM'));
console.log('DR position: ', calculateSuitability(testAttrs, 'DR'));
