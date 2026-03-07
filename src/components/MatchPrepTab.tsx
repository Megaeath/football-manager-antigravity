'use client';

import { useState, useEffect } from 'react';
import MatchPrepForm from './MatchPrepForm';
import type { MatchPrepConfig } from '@/lib/engine/types';

interface MatchPrepTabProps {
    matchId: string;
    teamId: string;
    opponentPlayers: { id: string; name: string; position: string; power: number; condition?: number; avgRating?: number; goals?: number; assists?: number }[];
}

export default function MatchPrepTab({ matchId, teamId, opponentPlayers }: MatchPrepTabProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [initialConfig, setInitialConfig] = useState<MatchPrepConfig | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [side, setSide] = useState<'home' | 'away' | null>(null);

    useEffect(() => {
        async function loadMatchPrep() {
            try {
                const res = await fetch(`/api/match/${matchId}/prep`);
                if (!res.ok) throw new Error('Failed to load match prep');
                const data = await res.json();
                
                // Determine which config to use (home or away)
                // We need to check the match details first
                const matchRes = await fetch(`/api/match/${matchId}`);
                if (!matchRes.ok) throw new Error('Failed to load match details');
                const matchData = await matchRes.json();
                
                const isHome = matchData.homeTeam.id === teamId;
                setSide(isHome ? 'home' : 'away');
                setInitialConfig(isHome ? data.homePrep : data.awayPrep);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        loadMatchPrep();
    }, [matchId, teamId]);

    const handleSave = async (config: MatchPrepConfig) => {
        if (!side) {
            setError('Cannot determine team side');
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(false);

        try {
            const res = await fetch(`/api/match/${matchId}/prep`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    side,
                    prepConfig: config
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to save match prep');
            }

            setSuccess(true);
            setInitialConfig(config);
            
            // Hide success message after 3 seconds
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="text-gray-400">Loading match preparation...</div>
            </div>
        );
    }

    return (
        <div className="space-y-4 md:space-y-6">
            {error && (
                <div className="bg-gradient-to-r from-red-900/40 to-red-800/40 border-2 border-red-500 text-red-100 px-4 md:px-6 py-4 rounded-lg shadow-lg animate-shake">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">❌</span>
                        <div>
                            <p className="font-bold text-lg">Error</p>
                            <p className="text-sm">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {success && (
                <div className="bg-gradient-to-r from-green-900/40 to-green-800/40 border-2 border-green-500 text-green-100 px-4 md:px-6 py-4 rounded-lg shadow-lg animate-pulse">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">✅</span>
                        <div>
                            <p className="font-bold text-lg">Success!</p>
                            <p className="text-sm">Match preparation saved successfully!</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-gradient-to-br from-blue-900/50 to-cyan-900/50 border-2 border-cyan-400/70 rounded-xl p-4 md:p-6 shadow-xl">
                <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl">💡</span>
                    <div className="flex-1">
                        <p className="font-bold text-2xl text-white mb-3">Match Preparation Guide</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                            <div className="bg-purple-600/20 border-2 border-purple-300/60 rounded-lg p-4 hover:bg-purple-600/30 transition-all">
                                <p className="font-bold text-lg text-purple-100 mb-2">🎯 Neutralization</p>
                                <p className="text-white text-sm leading-relaxed">Mark up to 3 key opponents. <span className="text-yellow-300 font-semibold">-10% team flow</span> per player.</p>
                            </div>
                            <div className="bg-red-600/20 border-2 border-red-300/60 rounded-lg p-4 hover:bg-red-600/30 transition-all">
                                <p className="font-bold text-lg text-red-100 mb-2">🪤 Press Trap</p>
                                <p className="text-white text-sm leading-relaxed">Higher commitment = <span className="text-green-300 font-semibold">better interception</span> + <span className="text-orange-300 font-semibold">more counter risk</span>.</p>
                            </div>
                            <div className="bg-green-600/20 border-2 border-green-300/60 rounded-lg p-4 hover:bg-green-600/30 transition-all">
                                <p className="font-bold text-lg text-green-100 mb-2">⚡ Transitions</p>
                                <p className="text-white text-sm leading-relaxed">Control team behavior when <span className="text-cyan-300 font-semibold">possession changes</span>.</p>
                            </div>
                        </div>
                        <p className="text-sm text-yellow-100 mt-4 bg-yellow-600/20 border-l-4 border-yellow-400 px-4 py-3 rounded font-medium">
                            ⚠️ These settings override your base tactics for this match only
                        </p>
                    </div>
                </div>
            </div>

            <MatchPrepForm
                matchId={matchId}
                teamId={teamId}
                opponentPlayers={opponentPlayers}
                initialConfig={initialConfig}
                onSave={handleSave}
            />
        </div>
    );
}
