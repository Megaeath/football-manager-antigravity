'use client';

import { useState } from 'react';
import { getEffectiveAttributes } from '@/lib/engine/playerPower';
import type { PlayerAttributes } from '@/lib/engine/types';

interface PlayerData {
    id: string;
    name: string;
    naturalPosition: string;
    passing: number;
    dribbling: number;
    shooting: number;
    vision: number;
    agility: number;
    composure: number;
    condition: number;
    exp: number;
    handling: number;
    tackling: number;
    heading: number;
    crossing: number;
    setPieces: number;
    throw: number;
    aggression: number;
    positioning: number;
    bravery: number;
    leadership: number;
    teamwork: number;
    pace: number;
    acceleration: number;
    stamina: number;
    strength: number;
    balance: number;
    teamId: string;
    teamName: string;
    mentality: string;
}

interface SimulationRound {
    round: number;
    // Shooter variables
    shooterShootScore: number;
    shooterPositionFactor: number;
    shooterMentalityBuff: number;
    shooterRoleMod: number;
    defenderPenalty: number;
    shooterVariance: number;
    shooterFinalShoot: number;
    // GK variables
    gkSaveScore: number;
    gkSaveEffectiveness: number;
    gkMentalityBuff: number;
    gkVariance: number;
    gkFinalSave: number;
    // Result
    miracle: boolean;
    blunder: boolean;
    isGoal: boolean;
    distanceToGoal: number;
}

interface ShootSaveSimulateClientProps {
    shooters: PlayerData[];
    goalkeepers: PlayerData[];
}

export default function ShootSaveSimulateClient({ shooters, goalkeepers }: ShootSaveSimulateClientProps) {
    // Selections
    const [selectedShooterId, setSelectedShooterId] = useState<string>('');
    const [selectedGKId, setSelectedGKId] = useState<string>('');

    // Simulation parameters
    const [distanceToGoal, setDistanceToGoal] = useState<number>(16); // 16m = penalty area
    const [rounds, setRounds] = useState<number>(10);
    const [isSimulating, setIsSimulating] = useState(false);

    // Results
    const [results, setResults] = useState<SimulationRound[]>([]);

    const selectedShooter = shooters.find(p => p.id === selectedShooterId);
    const selectedGK = goalkeepers.find(p => p.id === selectedGKId);

    // Helper: Get attributes
    function getAttributes(player: PlayerData): PlayerAttributes {
        return {
            handling: player.handling,
            tackling: player.tackling,
            passing: player.passing,
            shooting: player.shooting,
            heading: player.heading,
            dribbling: player.dribbling,
            crossing: player.crossing,
            setPieces: player.setPieces,
            throw: player.throw,
            aggression: player.aggression,
            positioning: player.positioning,
            vision: player.vision,
            bravery: player.bravery,
            leadership: player.leadership,
            teamwork: player.teamwork,
            composure: player.composure,
            pace: player.pace,
            acceleration: player.acceleration,
            stamina: player.stamina,
            strength: player.strength,
            agility: player.agility,
            balance: player.balance,
        };
    }

    // Helper: Calculate action score (from match.ts formulas)
    function calculateActionScore(
        actionType: 'shoot' | 'save',
        attributes: PlayerAttributes,
        role: 'attacker' | 'defender',
        condition: number
    ): number {
        const conditionFactor = condition / 100;

        if (actionType === 'shoot') {
            return (
                (attributes.shooting / 20) * 0.6 +
                (attributes.composure / 20) * 0.3 +
                (attributes.vision / 20) * 0.1
            ) * conditionFactor;
        } else {
            return (
                (attributes.handling / 20) * 0.5 +
                (attributes.positioning / 20) * 0.3 +
                (attributes.bravery / 20) * 0.2
            ) * conditionFactor;
        }
    }

    // Helper: Get mentality buff
    function getMentalityBuff(mentality: string, type: 'shooting' | 'save'): number {
        switch (mentality) {
            case 'ALL_OUT_ATTACK':
                return type === 'shooting' ? 1.5 : 0.7;
            case 'ATTACKING':
                return type === 'shooting' ? 1.3 : 0.8;
            case 'ULTRA_DEFENSIVE':
                return type === 'shooting' ? 0.7 : 1.4;
            case 'DEFENSIVE':
                return type === 'shooting' ? 0.8 : 1.2;
            default:
                return 1.0;
        }
    }

    // Simulate one shot
    function simulateOneRound(shooter: PlayerData, gk: PlayerData, distance: number): SimulationRound {
        // === SHOOTER CALCULATIONS ===
        const shootAttributes = getEffectiveAttributes(getAttributes(shooter), shooter.exp);
        const shootScore = calculateActionScore('shoot', shootAttributes, 'attacker', shooter.condition);

        // Position factor: closer to goal = better
        const positionFactor = Math.max(0.3, (100 - distance) / 100);

        // Mentality buff
        const mentalityBuff = getMentalityBuff(shooter.mentality, 'shooting');

        // Role modifier (simplified)
        const roleMod = 1.0;

        // Defender penalty (simplified - no defender in this test)
        const defenderPenalty = 1.0;

        // Variance (randomness)
        const variance = 0.2; // 20% variance
        const shootVariance = 1 - variance / 2 + Math.random() * variance;

        // Final shoot score
        const finalShoot = shootScore * positionFactor * mentalityBuff * roleMod * defenderPenalty * shootVariance;

        // === GOALKEEPER CALCULATIONS ===
        const gkAttributes = getEffectiveAttributes(getAttributes(gk), gk.exp);
        const saveScore = calculateActionScore('save', gkAttributes, 'defender', gk.condition);

        // Save effectiveness increases with distance (easier saves from far)
        const saveEffectiveness = distance < 10 ? 0.9 : distance < 20 ? 1.0 : 1.1;

        // GK mentality buff
        const gkMentalityBuff = getMentalityBuff(gk.mentality, 'save');

        // GK variance
        const gkVariance = 1 - variance / 2 + Math.random() * variance;

        // Final save score
        const finalSave = saveScore * saveEffectiveness * gkMentalityBuff * gkVariance;

        // === MIRACLE/BLUNDER ===
        const miracleChance = 0.02;
        const blunderChance = 0.02;
        const miracle = Math.random() < miracleChance;
        const blunder = Math.random() < blunderChance;

        let adjustedFinalSave = finalSave;
        if (blunder) {
            adjustedFinalSave *= 0.4;
        }
        if (miracle) {
            if (finalShoot <= adjustedFinalSave) {
                adjustedFinalSave = Math.max(0.1, adjustedFinalSave);
            }
        }

        // Result
        const isGoal = finalShoot > adjustedFinalSave;

        return {
            round: 0, // Will be set later
            shooterShootScore: shootScore,
            shooterPositionFactor: positionFactor,
            shooterMentalityBuff: mentalityBuff,
            shooterRoleMod: roleMod,
            defenderPenalty: defenderPenalty,
            shooterVariance: shootVariance,
            shooterFinalShoot: finalShoot,
            gkSaveScore: saveScore,
            gkSaveEffectiveness: saveEffectiveness,
            gkMentalityBuff: gkMentalityBuff,
            gkVariance: gkVariance,
            gkFinalSave: adjustedFinalSave,
            miracle,
            blunder,
            isGoal,
            distanceToGoal: distance,
        };
    }

    // Run simulation
    function runSimulation() {
        if (!selectedShooter || !selectedGK) return;

        setIsSimulating(true);
        setResults([]);

        const simResults: SimulationRound[] = [];

        for (let i = 0; i < rounds; i++) {
            const result = simulateOneRound(selectedShooter, selectedGK, distanceToGoal);
            result.round = i + 1;
            simResults.push(result);
        }

        setResults(simResults);
        setIsSimulating(false);
    }

    // Statistics
    const totalShots = results.length;
    const totalGoals = results.filter(r => r.isGoal).length;
    const goalRate = totalShots > 0 ? (totalGoals / totalShots) * 100 : 0;
    const miracles = results.filter(r => r.miracle).length;
    const blunders = results.filter(r => r.blunder).length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold text-white mb-6">
                    ⚽ Shoot vs Save Simulator
                </h1>
                <p className="text-gray-400 mb-8">
                    จำลองการยิง vs ผู้รักษาประตูเซฟ - แสดงตัวแปรทั้งหมดที่มีผล
                </p>

                {/* Selection Panel */}
                <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6 mb-6">
                    <h2 className="text-xl font-semibold text-white mb-4">เลือกผู้เล่น</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {/* Shooter Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                🔴 Shooter (ผู้ยิง)
                            </label>
                            <select
                                value={selectedShooterId}
                                onChange={(e) => setSelectedShooterId(e.target.value)}
                                className="w-full px-4 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                                <option value="">-- เลือกผู้ยิง --</option>
                                {shooters.map(player => (
                                    <option key={player.id} value={player.id}>
                                        {player.name} ({player.naturalPosition}) - SHO: {player.shooting}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Goalkeeper Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                🟢 Goalkeeper (ผู้รักษาประตู)
                            </label>
                            <select
                                value={selectedGKId}
                                onChange={(e) => setSelectedGKId(e.target.value)}
                                className="w-full px-4 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                                <option value="">-- เลือกผู้รักษาประตู --</option>
                                {goalkeepers.map(player => (
                                    <option key={player.id} value={player.id}>
                                        {player.name} ({player.naturalPosition}) - HAN: {player.handling}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Simulation Parameters */}
                    <h2 className="text-xl font-semibold text-white mb-4">ตัวแปรการจำลอง</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {/* Distance to Goal */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                ระยะยิง (Distance to Goal)
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    min={5}
                                    max={50}
                                    value={distanceToGoal}
                                    onChange={(e) => setDistanceToGoal(parseInt(e.target.value))}
                                    className="flex-1"
                                />
                                <span className="text-white font-bold w-16 text-center">
                                    {distanceToGoal}m
                                </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                                {distanceToGoal <= 10 ? '🎯 ระยะประชิด (Penalty Area)' : 
                                 distanceToGoal <= 20 ? '🎯 ระยะกลาง (Inside Box)' : 
                                 '🎯 ระยะไกล (Outside Box)'}
                            </p>
                        </div>

                        {/* Rounds */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                จำนวนรอบ
                            </label>
                            <input
                                type="number"
                                value={rounds}
                                onChange={(e) => setRounds(parseInt(e.target.value) || 10)}
                                min={1}
                                max={100}
                                className="w-full px-4 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Simulate Button */}
                        <div className="flex items-end">
                            <button
                                onClick={runSimulation}
                                disabled={!selectedShooter || !selectedGK || isSimulating}
                                className="w-full px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                            >
                                {isSimulating ? 'Simulating...' : '🎮 Run Simulation'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Player Stats Comparison */}
                {selectedShooter && selectedGK && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Shooter Stats */}
                        <div className="bg-red-900/30 backdrop-blur-md rounded-xl border border-red-500/30 p-6">
                            <h3 className="text-lg font-semibold text-red-400 mb-4">
                                🔴 Shooter: {selectedShooter.name}
                            </h3>
                            <div className="grid grid-cols-4 gap-4">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">
                                        {getEffectiveAttributes(getAttributes(selectedShooter), selectedShooter.exp).shooting}
                                    </div>
                                    <div className="text-xs text-gray-400">SHO</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">
                                        {getEffectiveAttributes(getAttributes(selectedShooter), selectedShooter.exp).composure}
                                    </div>
                                    <div className="text-xs text-gray-400">CMP</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">
                                        {getEffectiveAttributes(getAttributes(selectedShooter), selectedShooter.exp).vision}
                                    </div>
                                    <div className="text-xs text-gray-400">VIS</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">{selectedShooter.condition}%</div>
                                    <div className="text-xs text-gray-400">FIT</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">{selectedShooter.exp}</div>
                                    <div className="text-xs text-gray-400">EXP</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">
                                        {getEffectiveAttributes(getAttributes(selectedShooter), selectedShooter.exp).agility}
                                    </div>
                                    <div className="text-xs text-gray-400">AGI</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">{selectedShooter.mentality}</div>
                                    <div className="text-xs text-gray-400">MENT</div>
                                </div>
                            </div>
                        </div>

                        {/* Goalkeeper Stats */}
                        <div className="bg-green-900/30 backdrop-blur-md rounded-xl border border-green-500/30 p-6">
                            <h3 className="text-lg font-semibold text-green-400 mb-4">
                                🟢 Goalkeeper: {selectedGK.name}
                            </h3>
                            <div className="grid grid-cols-4 gap-4">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">
                                        {getEffectiveAttributes(getAttributes(selectedGK), selectedGK.exp).handling}
                                    </div>
                                    <div className="text-xs text-gray-400">HAN</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">
                                        {getEffectiveAttributes(getAttributes(selectedGK), selectedGK.exp).positioning}
                                    </div>
                                    <div className="text-xs text-gray-400">POS</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">
                                        {getEffectiveAttributes(getAttributes(selectedGK), selectedGK.exp).bravery}
                                    </div>
                                    <div className="text-xs text-gray-400">BRA</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">{selectedGK.condition}%</div>
                                    <div className="text-xs text-gray-400">FIT</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">{selectedGK.exp}</div>
                                    <div className="text-xs text-gray-400">EXP</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">
                                        {getEffectiveAttributes(getAttributes(selectedGK), selectedGK.exp).agility}
                                    </div>
                                    <div className="text-xs text-gray-400">AGI</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">{selectedGK.mentality}</div>
                                    <div className="text-xs text-gray-400">MENT</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Statistics Summary */}
                {results.length > 0 && (
                    <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6 mb-6">
                        <h2 className="text-xl font-semibold text-white mb-4">
                            📊 สรุปผลลัพธ์ ({totalShots} shots)
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-red-900/30 rounded-lg p-4 text-center">
                                <div className="text-3xl font-bold text-red-400">{totalGoals}</div>
                                <div className="text-sm text-gray-400">Goals</div>
                            </div>
                            <div className="bg-green-900/30 rounded-lg p-4 text-center">
                                <div className="text-3xl font-bold text-green-400">{totalShots - totalGoals}</div>
                                <div className="text-sm text-gray-400">Saves/Misses</div>
                            </div>
                            <div className="bg-yellow-900/30 rounded-lg p-4 text-center">
                                <div className="text-3xl font-bold text-yellow-400">{goalRate.toFixed(1)}%</div>
                                <div className="text-sm text-gray-400">Goal Rate</div>
                            </div>
                            <div className="bg-purple-900/30 rounded-lg p-4 text-center">
                                <div className="text-3xl font-bold text-purple-400">{miracles}/{blunders}</div>
                                <div className="text-sm text-gray-400">Miracles/Blunders</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Detailed Results Table */}
                {results.length > 0 && (
                    <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
                        <h2 className="text-xl font-semibold text-white mb-4">
                            📋 รายละเอียดทุกรอบ ({results.length} rounds)
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-white/20">
                                        <th className="px-2 py-2 text-left text-gray-400">#</th>
                                        <th className="px-2 py-2 text-left text-gray-400">Dist</th>
                                        <th className="px-2 py-2 text-left text-red-400">Shoot Score</th>
                                        <th className="px-2 py-2 text-left text-green-400">Save Score</th>
                                        <th className="px-2 py-2 text-left text-gray-400">Variance</th>
                                        <th className="px-2 py-2 text-left text-gray-400">Final</th>
                                        <th className="px-2 py-2 text-left text-gray-400">Result</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((result) => (
                                        <tr key={result.round} className="border-b border-white/10">
                                            <td className="px-2 py-2 text-white">{result.round}</td>
                                            <td className="px-2 py-2 text-white">{result.distanceToGoal}m</td>
                                            <td className="px-2 py-2 text-red-400 font-mono">
                                                {result.shooterFinalShoot.toFixed(3)}
                                            </td>
                                            <td className="px-2 py-2 text-green-400 font-mono">
                                                {result.gkFinalSave.toFixed(3)}
                                            </td>
                                            <td className="px-2 py-2 text-gray-400 font-mono">
                                                {(result.shooterVariance).toFixed(2)} / {(result.gkVariance).toFixed(2)}
                                            </td>
                                            <td className="px-2 py-2 text-white font-mono">
                                                {result.shooterFinalShoot > result.gkFinalSave ? '⚽' : '🧤'}
                                            </td>
                                            <td className="px-2 py-2">
                                                {result.miracle ? (
                                                    <span className="px-2 py-1 bg-purple-600/20 text-purple-400 rounded text-xs">
                                                        ✨ MIRACLE
                                                    </span>
                                                ) : result.blunder ? (
                                                    <span className="px-2 py-1 bg-orange-600/20 text-orange-400 rounded text-xs">
                                                        💥 BLUNDER
                                                    </span>
                                                ) : result.isGoal ? (
                                                    <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs">
                                                        ⚽ GOAL
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs">
                                                        🧤 SAVE
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Variables Explanation */}
                        <div className="mt-6 p-4 bg-gray-800/50 rounded-lg">
                            <h3 className="text-lg font-semibold text-white mb-3">📖 ตัวแปรที่มีผล</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                <div>
                                    <h4 className="font-semibold text-red-400 mb-2">🔴 Shooter Variables:</h4>
                                    <ul className="space-y-1 text-gray-300">
                                        <li>• <strong>Shooting</strong> - ความสามารถในการยิง (0-20)</li>
                                        <li>• <strong>Composure</strong> - ความเยือกเย็น (0-20)</li>
                                        <li>• <strong>Vision</strong> - การมองเห็น (0-20)</li>
                                        <li>• <strong>Condition</strong> - ความฟิต (0-100%)</li>
                                        <li>• <strong>EXP</strong> - ประสบการณ์ → bonus attributes</li>
                                        <li>• <strong>Distance</strong> - ระยะยิง (ใกล้ = ง่าย)</li>
                                        <li>• <strong>Mentality</strong> - แทคติก (ATTACKING = +shooting)</li>
                                        <li>• <strong>Variance</strong> - ความแปรปรวน (±20%)</li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-green-400 mb-2">🟢 Goalkeeper Variables:</h4>
                                    <ul className="space-y-1 text-gray-300">
                                        <li>• <strong>Handling</strong> - การจับบอล (0-20)</li>
                                        <li>• <strong>Positioning</strong> - การวางตัว (0-20)</li>
                                        <li>• <strong>Bravery</strong> - ความกล้า (0-20)</li>
                                        <li>• <strong>Condition</strong> - ความฟิต (0-100%)</li>
                                        <li>• <strong>EXP</strong> - ประสบการณ์ → bonus attributes</li>
                                        <li>• <strong>Distance</strong> - ระยะยิง (ไกล = เซฟง่าย)</li>
                                        <li>• <strong>Mentality</strong> - แทคติก (DEFENSIVE = +save)</li>
                                        <li>• <strong>Variance</strong> - ความแปรปรวน (±20%)</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
