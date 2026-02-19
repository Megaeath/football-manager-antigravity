import calculations from '../../data/calculations.json';
import { PlayerAttributes } from './types';

type ActionType = keyof typeof calculations.actions;
interface BonusCondition {
    stat: string;
    threshold: number;
    bonus: number;
}

export function calculateActionScore(
    action: ActionType,
    attributes: PlayerAttributes,
    role: 'attacker' | 'defender',
    condition: number // 0-100
): number {
    const config = calculations.actions[action];
    if (!config) return 0;

    const formula = role === 'attacker' ? config.attacker_formula : config.defender_formula;
    const bonuses = role === 'attacker' ? config.attacker_bonus : config.defender_bonus;

    // 1. Evaluate Formula
    // Replace attribute names with values
    // We sort keys by length desc to avoid replacing substrings (e.g. 'pace' inside 'space' if we had it)
    const attributeKeys = Object.keys(attributes) as (keyof PlayerAttributes)[];

    // Create a context object for the formula
    const context: Record<string, number> = {};
    attributeKeys.forEach(key => {
        context[key] = attributes[key];
    });

    // Simple parser: replace known tokens with values
    let parsedFormula = formula;
    attributeKeys.forEach(key => {
        // Use regex with word boundary to ensure exact match
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        parsedFormula = parsedFormula.replace(regex, context[key].toString());
    });

    let score = 0;
    try {
        // Limited eval using Function (safe-ish as input is controlled via JSON artifact and substituted with numbers)
        // "return (10 * 1.0) + (15 * 0.8)"
        score = new Function(`return ${parsedFormula}`)();
    } catch (e) {
        console.error(`Error evaluating formula: ${parsedFormula}`, e);
        score = 0;
    }

    // 2. Apply Bonuses
    (bonuses as BonusCondition[]).forEach((bonus: BonusCondition) => {
        const statValue = attributes[bonus.stat as keyof PlayerAttributes];
        if (statValue >= bonus.threshold) {
            score += bonus.bonus;
        }
    });

    // 3. Apply Condition Impact (0-100)
    // Use a steeper curve so low fitness hurts success more
    const normalized = Math.max(0, Math.min(1, condition / 100));
    const conditionFactor = Math.pow(normalized, 1.8);
    score = score * conditionFactor;

    return score;
}
