'use client';

import { useState } from 'react';
import type { PlayerAttributes } from '@/lib/engine/types';
import { getEffectiveAttributes } from '@/lib/engine/playerPower';

interface TeamData {
    id: string;
    name: string;
}

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
}

type ActionType = 'PASS_SHORT' | 'PASS_LONG' | 'DRIBBLE' | 'SHOOT';

interface SimulationResult {
    round: number;
    actionType: ActionType;
    success: boolean;
    successRate: number;
}

interface SimulationStats {
    actionType: ActionType;
    totalAttempts: number;
    successfulAttempts: number;
    successRate: number;
    avgSuccessRate: number;
}

interface TestSimulateClientProps {
    teams: TeamData[];
    players: PlayerData[];
}

export default function TestSimulateClient({ teams, players }: TestSimulateClientProps) {
    // Dropdown selections
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');

    // Simulation settings
    const [selectedAction, setSelectedAction] = useState<ActionType>('PASS_SHORT');
    const [rounds, setRounds] = useState<number>(10);
    const [isSimulating, setIsSimulating] = useState(false);

    // Results
    const [results, setResults] = useState<SimulationResult[]>([]);
    const [stats, setStats] = useState<SimulationStats[]>([]);

    // Filter players by selected team
    const teamPlayers = players.filter(p => p.teamId === selectedTeamId);
    const selectedPlayer = players.find(p => p.id === selectedPlayerId);

    // Build PlayerAttributes from player data
    function getPlayerAttributes(player: PlayerData): PlayerAttributes {
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

    // Simulate action using actual match engine logic
    function simulateAction(player: PlayerData, actionType: ActionType): { success: boolean; successRate: number } {
        const effectiveAttrs = getEffectiveAttributes(getPlayerAttributes(player), player.exp);
        const conditionFactor = player.condition / 100;

        let successRate = 0;

        switch (actionType) {
            case 'PASS_SHORT':
                successRate = 0.5 + (effectiveAttrs.passing / 20) * 0.4 + (effectiveAttrs.vision / 20) * 0.1;
                break;
            case 'PASS_LONG':
                successRate = 0.4 + (effectiveAttrs.passing / 20) * 0.35 + (effectiveAttrs.vision / 20) * 0.25;
                break;
            case 'DRIBBLE':
                successRate = 0.45 + (effectiveAttrs.dribbling / 20) * 0.35 + (effectiveAttrs.agility / 20) * 0.2;
                break;
            case 'SHOOT':
                successRate = 0.3 + (effectiveAttrs.shooting / 20) * 0.4 + (effectiveAttrs.composure / 20) * 0.3;
                break;
        }

        // Apply condition factor
        successRate *= conditionFactor;

        // Clamp to 0-1
        successRate = Math.max(0, Math.min(1, successRate));

        // Random success/fail
        const success = Math.random() < successRate;

        return { success, successRate };
    }

    // Run simulation
    function runSimulation() {
        if (!selectedPlayer) return;

        setIsSimulating(true);
        setResults([]);
        setStats([]);

        const simulationResults: SimulationResult[] = [];

        for (let i = 0; i < rounds; i++) {
            const { success, successRate } = simulateAction(selectedPlayer, selectedAction);

            simulationResults.push({
                round: i + 1,
                actionType: selectedAction,
                success,
                successRate,
            });
        }

        setResults(simulationResults);

        // Calculate statistics
        const statsMap = new Map<ActionType, { total: number; success: number; rates: number[] }>();
        statsMap.set(selectedAction, { total: 0, success: 0, rates: [] });

        simulationResults.forEach(result => {
            const stat = statsMap.get(result.actionType)!;
            stat.total++;
            if (result.success) stat.success++;
            stat.rates.push(result.successRate);
        });

        const statsArray: SimulationStats[] = Array.from(statsMap.entries()).map(([actionType, data]) => ({
            actionType,
            totalAttempts: data.total,
            successfulAttempts: data.success,
            successRate: data.total > 0 ? (data.success / data.total) * 100 : 0,
            avgSuccessRate: data.rates.length > 0 ? (data.rates.reduce((a, b) => a + b, 0) / data.rates.length) * 100 : 0,
        }));

        setStats(statsArray);
        setIsSimulating(false);
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold text-white mb-6">
                    ⚽ Action Simulation Tester
                </h1>
                <p className="text-gray-400 mb-8">
                    เลือกทีม → เลือกนักเตะ → เลือก action → กำหนดจำนวนรอบ → ดูผลลัพธ์ ไม่มีการบันทึกข้อมูล
                </p>

                {/* Configuration Panel */}
                <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6 mb-6">
                    <h2 className="text-xl font-semibold text-white mb-4">เลือกทีมและนักเตะ</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {/* Team Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Team
                            </label>
                            <select
                                value={selectedTeamId}
                                onChange={(e) => {
                                    setSelectedTeamId(e.target.value);
                                    setSelectedPlayerId('');
                                }}
                                className="w-full px-4 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">-- เลือกทีม --</option>
                                {teams.map(team => (
                                    <option key={team.id} value={team.id}>
                                        {team.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Player Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Player
                            </label>
                            <select
                                value={selectedPlayerId}
                                onChange={(e) => setSelectedPlayerId(e.target.value)}
                                disabled={!selectedTeamId}
                                className="w-full px-4 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <option value="">-- เลือกนักเตะ --</option>
                                {teamPlayers.map(player => (
                                    <option key={player.id} value={player.id}>
                                        {player.name} ({player.naturalPosition})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <h2 className="text-xl font-semibold text-white mb-4">Simulation Settings</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Action Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Action Type
                            </label>
                            <select
                                value={selectedAction}
                                onChange={(e) => setSelectedAction(e.target.value as ActionType)}
                                className="w-full px-4 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="PASS_SHORT">Pass Short</option>
                                <option value="PASS_LONG">Pass Long</option>
                                <option value="DRIBBLE">Dribble</option>
                                <option value="SHOOT">Shoot</option>
                            </select>
                        </div>

                        {/* Rounds */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Number of Rounds
                            </label>
                            <input
                                type="number"
                                value={rounds}
                                onChange={(e) => setRounds(parseInt(e.target.value) || 10)}
                                min={1}
                                max={1000}
                                className="w-full px-4 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Simulate Button */}
                    <div className="mt-6">
                        <button
                            onClick={runSimulation}
                            disabled={!selectedPlayer || isSimulating}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                        >
                            {isSimulating ? 'Simulating...' : '🎮 Run Simulation'}
                        </button>
                    </div>
                </div>

                {/* Player Info */}
                {selectedPlayer && (
                    <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6 mb-6">
                        <h2 className="text-xl font-semibold text-white mb-4">
                            Player: {selectedPlayer.name} ({selectedPlayer.naturalPosition})
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-white">
                                    {getEffectiveAttributes(getPlayerAttributes(selectedPlayer), selectedPlayer.exp).passing}
                                </div>
                                <div className="text-xs text-gray-400">PAS</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-white">
                                    {getEffectiveAttributes(getPlayerAttributes(selectedPlayer), selectedPlayer.exp).dribbling}
                                </div>
                                <div className="text-xs text-gray-400">DRB</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-white">
                                    {getEffectiveAttributes(getPlayerAttributes(selectedPlayer), selectedPlayer.exp).shooting}
                                </div>
                                <div className="text-xs text-gray-400">SHO</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-white">
                                    {getEffectiveAttributes(getPlayerAttributes(selectedPlayer), selectedPlayer.exp).vision}
                                </div>
                                <div className="text-xs text-gray-400">VIS</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-white">
                                    {getEffectiveAttributes(getPlayerAttributes(selectedPlayer), selectedPlayer.exp).agility}
                                </div>
                                <div className="text-xs text-gray-400">AGI</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-white">
                                    {getEffectiveAttributes(getPlayerAttributes(selectedPlayer), selectedPlayer.exp).composure}
                                </div>
                                <div className="text-xs text-gray-400">CMP</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-white">{selectedPlayer.condition}%</div>
                                <div className="text-xs text-gray-400">FIT</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-white">{selectedPlayer.exp}</div>
                                <div className="text-xs text-gray-400">EXP</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Statistics Summary */}
                {stats.length > 0 && (
                    <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6 mb-6">
                        <h2 className="text-xl font-semibold text-white mb-4">
                            📊 Statistics Summary
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {stats.map(stat => (
                                <div key={stat.actionType} className="bg-white/5 rounded-lg p-4">
                                    <div className="text-sm text-gray-400 mb-2">{stat.actionType}</div>
                                    <div className="text-3xl font-bold text-white mb-1">
                                        {stat.successRate.toFixed(1)}%
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        {stat.successfulAttempts}/{stat.totalAttempts} attempts
                                    </div>
                                    <div className="text-xs text-gray-400 mt-2">
                                        Expected: {stat.avgSuccessRate.toFixed(1)}%
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Detailed Results Table */}
                {results.length > 0 && (
                    <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
                        <h2 className="text-xl font-semibold text-white mb-4">
                            📋 Detailed Results ({results.length} rounds)
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/20">
                                        <th className="px-4 py-2 text-left text-gray-400 font-medium">Round</th>
                                        <th className="px-4 py-2 text-left text-gray-400 font-medium">Action</th>
                                        <th className="px-4 py-2 text-left text-gray-400 font-medium">Success Rate</th>
                                        <th className="px-4 py-2 text-left text-gray-400 font-medium">Result</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((result) => (
                                        <tr key={result.round} className="border-b border-white/10">
                                            <td className="px-4 py-2 text-white">{result.round}</td>
                                            <td className="px-4 py-2 text-white">
                                                <span className="px-2 py-1 bg-blue-600/20 rounded text-xs">
                                                    {result.actionType}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-white">
                                                {(result.successRate * 100).toFixed(1)}%
                                            </td>
                                            <td className="px-4 py-2">
                                                {result.success ? (
                                                    <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs">
                                                        ✓ SUCCESS
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-1 bg-red-600/20 text-red-400 rounded text-xs">
                                                        ✗ FAIL
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
