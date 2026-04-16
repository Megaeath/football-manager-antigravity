export type PlaystyleFormation = '4-4-2' | '4-3-3' | '4-5-1' | '3-4-3' | '3-5-2' | '4-2-4' | '5-3-1' | '5-4-1';
export type PlaystyleMentality = 'ALL_OUT_ATTACK' | 'ATTACKING' | 'NORMAL' | 'DEFENSIVE' | 'ULTRA_DEFENSIVE';
export type PlaystylePassing = 'SHORT' | 'MIXED' | 'DIRECT';
export type PlaystyleTackling = 'SOFT' | 'NORMAL' | 'HARD';
export type PlaystyleAttackingFocus = 'CENTER' | 'MIXED' | 'WINGS';
export type PlaystyleCreativeFreedom = 'RESTRICTED' | 'NORMAL' | 'MAXIMUM';

export interface AIPlaystyleTactics {
    formation: PlaystyleFormation;
    mentality: PlaystyleMentality;
    passing: PlaystylePassing;
    tackling: PlaystyleTackling;
    attacking_focus: PlaystyleAttackingFocus;
    creative_freedom: PlaystyleCreativeFreedom;
}

export interface AITransferPolicy {
    preferAgeMin: number;
    preferAgeMax: number;
    budgetUsage: number; // 0-1
    riskBias: 'LOW' | 'MEDIUM' | 'HIGH';
    attributeWeights: Partial<Record<
        'pace'
        | 'acceleration'
        | 'passing'
        | 'shooting'
        | 'tackling'
        | 'vision'
        | 'stamina'
        | 'strength'
        | 'dribbling'
        | 'crossing'
        | 'composure'
        | 'aggression'
        | 'positioning'
        | 'heading',
        number
    >>;
}

export interface AIPlaystyleProfile {
    id: string;
    name: string;
    description: string;
    tactics: AIPlaystyleTactics;
    transferPolicy: AITransferPolicy;
}

export const AI_PLAYSTYLE_PROFILES: AIPlaystyleProfile[] = [
    {
        id: 'balanced_control',
        name: 'Balanced Control',
        description: 'สมดุลเกมรุก-รับ เน้นความนิ่งและยืนระยะ',
        tactics: { formation: '4-4-2', mentality: 'NORMAL', passing: 'MIXED', tackling: 'NORMAL', attacking_focus: 'MIXED', creative_freedom: 'NORMAL' },
        transferPolicy: {
            preferAgeMin: 22,
            preferAgeMax: 29,
            budgetUsage: 0.72,
            riskBias: 'LOW',
            attributeWeights: { passing: 0.2, vision: 0.15, stamina: 0.15, composure: 0.15, tackling: 0.1 }
        }
    },
    {
        id: 'gegenpress_intense',
        name: 'Gegenpress Intense',
        description: 'เพรสหนัก ตัดบอลสูง ใช้พลังงานสูง',
        tactics: { formation: '4-3-3', mentality: 'ATTACKING', passing: 'MIXED', tackling: 'HARD', attacking_focus: 'WINGS', creative_freedom: 'MAXIMUM' },
        transferPolicy: {
            preferAgeMin: 19,
            preferAgeMax: 26,
            budgetUsage: 0.82,
            riskBias: 'HIGH',
            attributeWeights: { stamina: 0.28, pace: 0.2, aggression: 0.12, tackling: 0.16, composure: 0.08 }
        }
    },
    {
        id: 'wing_counter_direct',
        name: 'Wing Counter Direct',
        description: 'รอจังหวะสวนกลับริมเส้น จ่ายตรงเร็ว',
        tactics: { formation: '4-5-1', mentality: 'DEFENSIVE', passing: 'DIRECT', tackling: 'NORMAL', attacking_focus: 'WINGS', creative_freedom: 'MAXIMUM' },
        transferPolicy: {
            preferAgeMin: 20,
            preferAgeMax: 27,
            budgetUsage: 0.68,
            riskBias: 'MEDIUM',
            attributeWeights: { pace: 0.25, acceleration: 0.16, crossing: 0.2, dribbling: 0.15, stamina: 0.1 }
        }
    },
    {
        id: 'possession_short_build',
        name: 'Possession Short Build',
        description: 'ครองบอลสั้น เน้นกลางสนามและความแม่นยำ',
        tactics: { formation: '4-3-3', mentality: 'NORMAL', passing: 'SHORT', tackling: 'SOFT', attacking_focus: 'CENTER', creative_freedom: 'RESTRICTED' },
        transferPolicy: {
            preferAgeMin: 22,
            preferAgeMax: 30,
            budgetUsage: 0.78,
            riskBias: 'LOW',
            attributeWeights: { passing: 0.3, vision: 0.22, composure: 0.18, dribbling: 0.1 }
        }
    },
    {
        id: 'low_block_counter',
        name: 'Low Block Counter',
        description: 'เกมรับลึก รอสวนด้วยสปีดแนวรุก',
        tactics: { formation: '4-5-1', mentality: 'ULTRA_DEFENSIVE', passing: 'DIRECT', tackling: 'NORMAL', attacking_focus: 'WINGS', creative_freedom: 'NORMAL' },
        transferPolicy: {
            preferAgeMin: 21,
            preferAgeMax: 29,
            budgetUsage: 0.65,
            riskBias: 'LOW',
            attributeWeights: { tackling: 0.2, positioning: 0.16, strength: 0.15, pace: 0.15, composure: 0.1 }
        }
    },
    {
        id: 'youth_development',
        name: 'Youth Development',
        description: 'ปั้นดาวรุ่ง ซื้อเด็กเก่งและขายทำกำไร',
        tactics: { formation: '4-3-3', mentality: 'ATTACKING', passing: 'MIXED', tackling: 'SOFT', attacking_focus: 'WINGS', creative_freedom: 'MAXIMUM' },
        transferPolicy: {
            preferAgeMin: 17,
            preferAgeMax: 23,
            budgetUsage: 0.55,
            riskBias: 'HIGH',
            attributeWeights: { pace: 0.2, dribbling: 0.2, passing: 0.15, stamina: 0.12 }
        }
    },
    {
        id: 'galactico_star_hunt',
        name: 'Galactico Star Hunt',
        description: 'ไล่ล่าซูเปอร์สตาร์ ผลงาน+ชื่อเสียงมาก่อน',
        tactics: { formation: '4-4-2', mentality: 'ATTACKING', passing: 'MIXED', tackling: 'NORMAL', attacking_focus: 'CENTER', creative_freedom: 'MAXIMUM' },
        transferPolicy: {
            preferAgeMin: 23,
            preferAgeMax: 30,
            budgetUsage: 0.9,
            riskBias: 'MEDIUM',
            attributeWeights: { shooting: 0.22, passing: 0.16, composure: 0.14, vision: 0.12 }
        }
    },
    {
        id: 'moneyball_value',
        name: 'Moneyball Value',
        description: 'เน้นความคุ้มค่า overperform ด้วยงบจำกัด',
        tactics: { formation: '4-4-2', mentality: 'NORMAL', passing: 'DIRECT', tackling: 'NORMAL', attacking_focus: 'MIXED', creative_freedom: 'NORMAL' },
        transferPolicy: {
            preferAgeMin: 20,
            preferAgeMax: 27,
            budgetUsage: 0.5,
            riskBias: 'LOW',
            attributeWeights: { stamina: 0.18, tackling: 0.16, passing: 0.16, pace: 0.12 }
        }
    },
    {
        id: 'physical_duelists',
        name: 'Physical Duelists',
        description: 'ทีมสายปะทะ ชนหนัก เล่นลูกกลางอากาศ',
        tactics: { formation: '4-4-2', mentality: 'NORMAL', passing: 'DIRECT', tackling: 'HARD', attacking_focus: 'CENTER', creative_freedom: 'NORMAL' },
        transferPolicy: {
            preferAgeMin: 22,
            preferAgeMax: 30,
            budgetUsage: 0.7,
            riskBias: 'MEDIUM',
            attributeWeights: { strength: 0.25, stamina: 0.2, heading: 0.14, tackling: 0.14 }
        }
    },
    {
        id: 'defensive_steel',
        name: 'Defensive Steel',
        description: 'วินัยเกมรับสูง เล่นเพื่อผลการแข่งขัน',
        tactics: { formation: '4-5-1', mentality: 'DEFENSIVE', passing: 'SHORT', tackling: 'SOFT', attacking_focus: 'CENTER', creative_freedom: 'RESTRICTED' },
        transferPolicy: {
            preferAgeMin: 24,
            preferAgeMax: 32,
            budgetUsage: 0.62,
            riskBias: 'LOW',
            attributeWeights: { tackling: 0.24, composure: 0.18, passing: 0.14, strength: 0.12 }
        }
    }
];

export const DEFAULT_AI_PLAYSTYLE_ID = 'balanced_control';

export const AI_PLAYSTYLE_PROFILE_MAP = new Map(
    AI_PLAYSTYLE_PROFILES.map((p) => [p.id, p])
);
