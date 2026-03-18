export type ReputationLevel = {
    min: number;
    max: number;
    label: string;
    definition: string;
    impact: string;
};

const playerReputationLevels: ReputationLevel[] = [
    { min: 91, max: 100, label: 'Global Icon', definition: 'Legendary player known worldwide', impact: 'Massive jersey sales, high sponsor demand' },
    { min: 81, max: 90, label: 'Superstar', definition: 'Top player in league and national team', impact: 'Huge fan attraction to stadium' },
    { min: 71, max: 80, label: 'Star Player', definition: 'Famous player who is team core', impact: 'Significant merchandise sales influence' },
    { min: 51, max: 70, label: 'Well-Known', definition: 'Player recognized by general fans', impact: 'Some personal sponsorships' },
    { min: 31, max: 50, label: 'Local Hero', definition: 'Fan favorite within the club', impact: 'Popular in club\'s city' },
    { min: 11, max: 30, label: 'Rising Prospect', definition: 'Young player getting media attention', impact: 'Fast popularity growth with good form' },
    { min: 0, max: 10, label: 'Unknown', definition: 'Unknown player or youth academy graduate', impact: 'No marketing impact' }
];

const clubReputationLevels: ReputationLevel[] = [
    { min: 91, max: 100, label: 'Elite Giant', definition: 'World-class club (e.g., Real Madrid)', impact: 'Heavy sponsor investment, can attract 90+ players' },
    { min: 81, max: 90, label: 'Continental Power', definition: 'Regular continental competition participant', impact: 'Easy to attract Superstar players' },
    { min: 71, max: 80, label: 'National Heavyweight', definition: 'Top team in the country', impact: 'High and stable ticket/sponsor revenue' },
    { min: 51, max: 70, label: 'Established Club', definition: 'Mid-table club with stable fanbase', impact: 'Destination for good quality players' },
    { min: 31, max: 50, label: 'Professional Side', definition: 'Average professional club', impact: 'Must win to improve reputation' },
    { min: 11, max: 30, label: 'Small Town Club', definition: 'Small club known only locally', impact: 'Few sponsors, must develop youth' },
    { min: 0, max: 10, label: 'Underdog / Amateur', definition: 'Amateur club or newly founded team', impact: 'No budget, cannot attract stars' }
];

const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

const getLevel = (score: number, levels: ReputationLevel[]) => {
    const safe = clampScore(score);
    return levels.find(level => safe >= level.min && safe <= level.max) || levels[levels.length - 1];
};

export const getPlayerReputation = (score: number) => {
    const level = getLevel(score, playerReputationLevels);
    return { score: clampScore(score), ...level };
};

export const getClubReputation = (score: number) => {
    const level = getLevel(score, clubReputationLevels);
    return { score: clampScore(score), ...level };
};
