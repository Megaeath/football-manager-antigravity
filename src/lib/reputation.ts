export type ReputationLevel = {
    min: number;
    max: number;
    label: string;
    definition: string;
    impact: string;
};

const playerReputationLevels: ReputationLevel[] = [
    { min: 91, max: 100, label: 'Global Icon', definition: 'ระดับตำนานที่คนทั้งโลกต้องรู้จัก', impact: 'ขายเสื้อถล่มทลาย, สปอนเซอร์แย่งตัว' },
    { min: 81, max: 90, label: 'Superstar', definition: 'ตัวท็อปของลีกและติดทีมชาติชุดใหญ่', impact: 'ดึงดูดแฟนบอลเข้าสนามได้มหาศาล' },
    { min: 71, max: 80, label: 'Star Player', definition: 'นักเตะชื่อดังที่เป็นแกนหลักของทีม', impact: 'มีอิทธิพลต่อยอดขายของที่ระลึก' },
    { min: 51, max: 70, label: 'Well-Known', definition: 'นักเตะที่แฟนบอลทั่วไปเริ่มรู้จักชื่อ', impact: 'เริ่มมีสปอนเซอร์ส่วนตัวเล็กน้อย' },
    { min: 31, max: 50, label: 'Local Hero', definition: 'ขวัญใจแฟนบอลเฉพาะกลุ่มในสโมสร', impact: 'เป็นที่นิยมในเมืองที่สโมสรตั้งอยู่' },
    { min: 11, max: 30, label: 'Rising Prospect', definition: 'ดาวรุ่งที่เริ่มถูกพูดถึงในข่าวบ้าง', impact: 'ความดังเพิ่มไวหากฟอร์มดีต่อเนื่อง' },
    { min: 0, max: 10, label: 'Unknown', definition: 'นักเตะโนเนม หรือเด็กปั้นเพิ่งขึ้นชุดใหญ่', impact: 'ไม่มีผลต่อรายได้ด้านการตลาด' }
];

const clubReputationLevels: ReputationLevel[] = [
    { min: 91, max: 100, label: 'Elite Giant', definition: 'สโมสรยักษ์ใหญ่ระดับโลก (เช่น Real Madrid)', impact: 'สปอนเซอร์จ่ายหนัก, ดึงสตาร์ 90+ ได้' },
    { min: 81, max: 90, label: 'Continental Power', definition: 'ทีมขาใหญ่ที่ได้ไปเล่นถ้วยระดับทวีปบ่อยๆ', impact: 'ดึงนักเตะเกรด Superstar ได้ง่าย' },
    { min: 71, max: 80, label: 'National Heavyweight', definition: 'ทีมหัวตารางของประเทศ', impact: 'รายได้ค่าตั๋วและสปอนเซอร์สูงคงที่' },
    { min: 51, max: 70, label: 'Established Club', definition: 'ทีมระดับกลางที่มีฐานแฟนบอลมั่นคง', impact: 'เป็นจุดหมายที่นักเตะเกรดดีอยากมา' },
    { min: 31, max: 50, label: 'Professional Side', definition: 'ทีมอาชีพทั่วไปที่ผลงานยังทรงๆ', impact: 'ต้องพยายามชนะเพื่อขยับ Reputation' },
    { min: 11, max: 30, label: 'Small Town Club', definition: 'ทีมเล็กๆ ที่คนรู้จักเฉพาะในพื้นที่', impact: 'สปอนเซอร์น้อย, ต้องเน้นปั้นเด็กขาย' },
    { min: 0, max: 10, label: 'Underdog / Amateur', definition: 'ทีมสมัครเล่น หรือทีมเพิ่งก่อตั้งใหม่', impact: 'ไม่มีงบประมาณ, ดึงสตาร์ไม่ได้เลย' }
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
