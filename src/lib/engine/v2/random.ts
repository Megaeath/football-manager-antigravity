type RandomSource = () => number;

let activeRandomSource: RandomSource = Math.random;

export function v2Random(): number {
    return activeRandomSource();
}

export function createSeededRandom(seedInput: string): RandomSource {
    let seed = 2166136261;

    for (let index = 0; index < seedInput.length; index += 1) {
        seed ^= seedInput.charCodeAt(index);
        seed = Math.imul(seed, 16777619);
    }

    if (seed === 0) {
        seed = 0x6d2b79f5;
    }

    return () => {
        seed += 0x6d2b79f5;
        let t = seed;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function runWithV2Random<T>(randomSource: RandomSource, callback: () => T): T {
    const previousRandomSource = activeRandomSource;
    activeRandomSource = randomSource;

    try {
        return callback();
    } finally {
        activeRandomSource = previousRandomSource;
    }
}