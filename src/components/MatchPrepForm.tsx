'use client';

import { useState, useEffect } from 'react';
import type { MatchPrepConfig, NeutralizationIntensity, PressCommitment, FieldZone, TransitionSpeed, RecoveryUrgency } from '@/lib/engine/types';

interface MatchPrepFormProps {
    matchId: string;
    teamId: string; // Which team is configuring (home or away)
    opponentPlayers: { id: string; name: string; position: string; power?: number; condition?: number; avgRating?: number; goals?: number; assists?: number }[];
    initialConfig?: MatchPrepConfig | null;
    onSave: (config: MatchPrepConfig) => Promise<void>;
}

export default function MatchPrepForm({ matchId, teamId, opponentPlayers, initialConfig, onSave }: MatchPrepFormProps) {
    // Neutralization state
    const [targetPlayerIds, setTargetPlayerIds] = useState<string[]>(initialConfig?.neutralization?.targetPlayerIds ?? []);
    const [neutralizationIntensity, setNeutralizationIntensity] = useState<NeutralizationIntensity>(
        initialConfig?.neutralization?.intensity ?? 'MODERATE'
    );

    // Press trap state
    const [pressCommitment, setPressCommitment] = useState<PressCommitment>(initialConfig?.pressTrap?.commitment ?? 'BALANCED');
    const [pressTriggerZone, setPressTriggerZone] = useState<FieldZone>(initialConfig?.pressTrap?.triggerZones?.[0] ?? 'MIDDLE');

    // Transition state
    const [defenseToAttack, setDefenseToAttack] = useState<TransitionSpeed>(initialConfig?.transitionRules?.defenseToAttack ?? 'QUICK');
    const [attackToDefense, setAttackToDefense] = useState<RecoveryUrgency>(initialConfig?.transitionRules?.attackToDefense ?? 'CONTROLLED');

    const [saving, setSaving] = useState(false);

    const handleTargetPlayerToggle = (playerId: string) => {
        setTargetPlayerIds(prev => {
            if (prev.includes(playerId)) {
                return prev.filter(id => id !== playerId);
            } else if (prev.length < 3) {
                return [...prev, playerId];
            }
            return prev; // Max 3
        });
    };



    const handleSubmit = async () => {
        setSaving(true);
        try {
            const config: MatchPrepConfig = {};

            // Always include neutralization if players are selected
            if (targetPlayerIds.length > 0) {
                config.neutralization = {
                    targetPlayerIds,
                    intensity: neutralizationIntensity
                };
            }

            // Always include press trap with selected zone
            config.pressTrap = {
                commitment: pressCommitment,
                triggerZones: [pressTriggerZone] // Always include the selected zone
            };

            // Always include transition rules
            config.transitionRules = {
                defenseToAttack,
                attackToDefense
            };

            await onSave(config);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 border border-gray-300 rounded-lg p-4 md:p-6 bg-white">
            <h2 className="text-xl font-bold text-gray-900 border-b border-gray-300 pb-3">
                ⚙️ Match Preparation
            </h2>

            {/* Neutralization Section */}
            <div className="space-y-3 p-4 rounded-lg bg-gray-50 border border-gray-300">
                <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-lg font-bold text-gray-900">🎯 Key Player Neutralization</h3>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between bg-white px-3 py-2 rounded border border-gray-300">
                        <p className="text-sm font-medium text-gray-700">Select opponent players to mark (max 3)</p>
                        <span className={`text-sm font-bold ${targetPlayerIds.length >= 3 ? 'text-red-400' : 'text-green-400'}`}>
                            {targetPlayerIds.length}/3
                        </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-2">
                        {opponentPlayers.map((player, index) => (
                            <label 
                                key={player.id} 
                                className={`flex items-center gap-3 cursor-pointer p-3 rounded border transition-all ${
                                    targetPlayerIds.includes(player.id) 
                                        ? 'bg-blue-100 border-blue-400' 
                                        : 'bg-white border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={targetPlayerIds.includes(player.id)}
                                    onChange={() => handleTargetPlayerToggle(player.id)}
                                    disabled={!targetPlayerIds.includes(player.id) && targetPlayerIds.length >= 3}
                                    className="w-4 h-4 accent-blue-500 cursor-pointer disabled:opacity-50"
                                />
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-900">{player.name}</span>
                                        {index < 3 && <span className="text-xs bg-yellow-500 text-white px-2 py-0.5 rounded">★ {index + 1}</span>}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">{player.position}</span>
                                        {player.power && <span className="text-xs text-gray-600">PWR: {player.power.toFixed(1)}</span>}
                                        {player.condition !== undefined && <span className="text-xs text-gray-600">FIT: {player.condition}%</span>}
                                        {player.avgRating !== undefined && <span className="text-xs text-gray-600">AVG: {player.avgRating.toFixed(1)}</span>}
                                        {player.goals !== undefined && <span className="text-xs text-gray-600">G: {player.goals}</span>}
                                        {player.assists !== undefined && <span className="text-xs text-gray-600">A: {player.assists}</span>}
                                    </div>
                                </div>
                            </label>
                        ))}
                    </div>

                    <div className="mt-3 bg-white p-3 rounded border border-gray-300">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Marking Intensity</label>
                        <select
                            value={neutralizationIntensity}
                            onChange={(e) => setNeutralizationIntensity(e.target.value as NeutralizationIntensity)}
                            className="w-full bg-white text-gray-900 border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="MODERATE">Moderate: -15% effectiveness, -10% team flow/player</option>
                            <option value="TIGHT">Tight: -30% effectiveness, -10% team flow/player</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Press Trap Section */}
            <div className="space-y-3 p-4 rounded-lg bg-gray-50 border border-gray-300">
                <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-gray-900">🎣 Press Trap</span>
                </div>

                <div className="space-y-4">
                    <div className="bg-white p-3 rounded border border-gray-300">
                        <label className="block text-sm font-bold text-gray-700 mb-3">Commitment Level</label>
                        <div className="space-y-2">
                            <label className={`flex items-center gap-3 cursor-pointer p-3 rounded border transition-all ${
                                pressCommitment === 'SAFE' 
                                    ? 'bg-green-100 border-green-500' 
                                    : 'bg-white border-gray-300 hover:bg-gray-50'
                            }`}>
                                <input
                                    type="radio"
                                    name="pressCommitment"
                                    value="SAFE"
                                    checked={pressCommitment === 'SAFE'}
                                    onChange={(e) => setPressCommitment(e.target.value as PressCommitment)}
                                    className="w-4 h-4 accent-green-500 cursor-pointer"
                                />
                                <div className="flex-1">
                                    <div className="text-gray-900 font-medium">Safe</div>
                                    <div className="text-xs text-gray-600 mt-1">+5% interception • No counter risk</div>
                                </div>
                            </label>
                            <label className={`flex items-center gap-3 cursor-pointer p-3 rounded border transition-all ${
                                pressCommitment === 'BALANCED' 
                                    ? 'bg-yellow-100 border-yellow-500' 
                                    : 'bg-white border-gray-300 hover:bg-gray-50'
                            }`}>
                                <input
                                    type="radio"
                                    name="pressCommitment"
                                    value="BALANCED"
                                    checked={pressCommitment === 'BALANCED'}
                                    onChange={(e) => setPressCommitment(e.target.value as PressCommitment)}
                                    className="w-4 h-4 accent-yellow-500 cursor-pointer"
                                />
                                <div className="flex-1">
                                    <div className="text-gray-900 font-medium">Balanced</div>
                                    <div className="text-xs text-gray-600 mt-1">+10% interception • +10% counter vulnerability</div>
                                </div>
                            </label>
                            <label className={`flex items-center gap-3 cursor-pointer p-3 rounded border transition-all ${
                                pressCommitment === 'AGGRESSIVE' 
                                    ? 'bg-red-100 border-red-500' 
                                    : 'bg-white border-gray-300 hover:bg-gray-50'
                            }`}>
                                <input
                                    type="radio"
                                    name="pressCommitment"
                                    value="AGGRESSIVE"
                                    checked={pressCommitment === 'AGGRESSIVE'}
                                    onChange={(e) => setPressCommitment(e.target.value as PressCommitment)}
                                    className="w-4 h-4 accent-red-500 cursor-pointer"
                                />
                                <div className="flex-1">
                                    <div className="text-gray-900 font-medium">Aggressive</div>
                                    <div className="text-xs text-gray-600 mt-1">+15% interception • +20% counter vulnerability</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="bg-white p-3 rounded border border-gray-300">
                        <label className="block text-sm font-bold text-gray-700 mb-3">Trigger Zone (เลือก 1 อัน)</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            {(['DEFENSIVE', 'MIDDLE', 'ATTACKING'] as FieldZone[]).map((zone) => (
                                <label 
                                    key={zone} 
                                    className={`flex items-center gap-2 cursor-pointer p-3 rounded-lg transition-all ${
                                        pressTriggerZone === zone 
                                            ? 'bg-blue-100 border border-blue-500' 
                                            : 'bg-white border border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="pressTriggerZone"
                                        checked={pressTriggerZone === zone}
                                        onChange={() => setPressTriggerZone(zone)}
                                        className="w-4 h-4 accent-blue-500 cursor-pointer"
                                    />
                                    <span className="text-sm font-medium text-gray-900">
                                        {zone === 'DEFENSIVE' && 'Defensive'}
                                        {zone === 'MIDDLE' && 'Middle'}
                                        {zone === 'ATTACKING' && 'Attacking'}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Transition Rules Section */}
            <div className="space-y-3 p-4 rounded-lg bg-gray-50 border border-gray-300">
                <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-gray-900">⚡ Transition Rules</span>
                </div>

                <div className="space-y-4">
                    <div className="bg-white p-3 rounded border border-gray-300">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Defense → Attack</label>
                        <select
                            value={defenseToAttack}
                            onChange={(e) => setDefenseToAttack(e.target.value as TransitionSpeed)}
                            className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                        >
                            <option value="HOLD">Hold → +15% retention, build possession slowly</option>
                            <option value="QUICK">Quick → +20% long pass, +15% dribble</option>
                            <option value="DIRECT">Direct → +40% long pass, -30% short pass</option>
                        </select>
                    </div>

                    <div className="bg-white p-3 rounded border border-gray-300">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Attack → Defense</label>
                        <select
                            value={attackToDefense}
                            onChange={(e) => setAttackToDefense(e.target.value as RecoveryUrgency)}
                            className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                        >
                            <option value="URGENT">Urgent → +30% defensive action speed, fast recovery</option>
                            <option value="CONTROLLED">Controlled → +10% positioning, maintain shape</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex gap-3 pt-4 border-t border-gray-300">
                <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-300 disabled:text-gray-500 text-white font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                >
                    {saving ? (
                        <>
                            <span className="animate-spin">⏳</span>
                            <span>Saving...</span>
                        </>
                    ) : (
                        <span>Save Match Preparation</span>
                    )}
                </button>
            </div>
        </div>
    );
};
