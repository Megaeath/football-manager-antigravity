'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { V2MatchState } from '@/lib/engine/v2/types2d';

const MatchCanvas = dynamic(
    () => import('../components/MatchCanvas').then((m) => m.MatchCanvas),
    {
        ssr: false,
        loading: () => (
            <div className="flex items-center justify-center h-[600px] bg-slate-900 rounded-lg text-slate-300">
                Loading canvas...
            </div>
        )
    }
);

interface TeamInfo {
    id: string;
    name: string;
    formation: string;
}

/**
 * Test page for V2 Match Canvas Visualization
 * 
 * This page demonstrates the 2D match engine visualization with sample data.
 * It loads a test match simulation and renders it using the Konva canvas.
 */
export default function TestV2Page() {
    const [matchData, setMatchData] = useState<V2MatchState | null>(null);
    const [homeTeam, setHomeTeam] = useState<TeamInfo | null>(null);
    const [awayTeam, setAwayTeam] = useState<TeamInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadTestMatch() {
            try {
                setIsLoading(true);
                setError(null);
                
                // Fetch test match data from the V2 test endpoint
                const response = await fetch('/api/test-v2-match');
                
                if (!response.ok) {
                    throw new Error(`Failed to load test match: ${response.statusText}`);
                }
                
                const data = await response.json();
                setMatchData(data.match);
                setHomeTeam(data.teams.home);
                setAwayTeam(data.teams.away);
            } catch (err) {
                console.error('Error loading test match:', err);
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setIsLoading(false);
            }
        }
        
        loadTestMatch();
    }, []);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
                <div className="text-white text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-xl">Loading test match...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
                <div className="bg-red-900/50 border border-red-500 rounded-lg p-6 max-w-md">
                    <h2 className="text-red-200 text-xl font-bold mb-2">Error</h2>
                    <p className="text-red-100">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!matchData || !homeTeam || !awayTeam) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
                <div className="text-white text-xl">No match data available</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-white mb-8">
                    <h1 className="text-4xl font-bold mb-2">V2 Match Engine Test</h1>
                    <p className="text-slate-300">
                        2D Spatial Visualization with Konva Canvas
                    </p>
                </div>

                {/* Match Info */}
                <div className="bg-slate-800/50 rounded-lg p-6 mb-6 text-white">
                    <div className="grid grid-cols-3 gap-4 items-center">
                        <div className="text-right">
                            <div className="text-2xl font-bold">{homeTeam.name}</div>
                            <div className="text-slate-400 text-sm">{homeTeam.formation}</div>
                        </div>
                        
                        <div className="text-center">
                            <div className="text-5xl font-bold">
                                {matchData.homeScore} - {matchData.awayScore}
                            </div>
                            <div className="text-slate-400 text-sm mt-2">Full Time</div>
                        </div>
                        
                        <div className="text-left">
                            <div className="text-2xl font-bold">{awayTeam.name}</div>
                            <div className="text-slate-400 text-sm">{awayTeam.formation}</div>
                        </div>
                    </div>
                </div>

                {/* Stats Summary */}
                <div className="bg-slate-800/50 rounded-lg p-6 mb-6 text-white">
                    <h3 className="text-xl font-bold mb-4">Match Statistics</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                            <div className="text-3xl font-bold text-blue-400">
                                {matchData.frames.length}
                            </div>
                            <div className="text-slate-400 text-sm">Frames</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-green-400">
                                {Object.keys(matchData.playerStats).length}
                            </div>
                            <div className="text-slate-400 text-sm">Players</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-yellow-400">
                                {matchData.events.length}
                            </div>
                            <div className="text-slate-400 text-sm">Events</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-purple-400">
                                {matchData.frames[matchData.frames.length - 1]?.minute || 90}&apos;
                            </div>
                            <div className="text-slate-400 text-sm">Duration</div>
                        </div>
                    </div>
                </div>

                {/* Canvas Visualization */}
                <div className="bg-slate-800/50 rounded-lg p-6">
                    <h3 className="text-xl font-bold text-white mb-4">Match Replay</h3>
                    <MatchCanvas 
                        matchData={matchData}
                        width={900}
                        height={600}
                    />
                </div>

                {/* Debug Info (collapsible) */}
                <details className="bg-slate-800/50 rounded-lg p-6 mt-6 text-white">
                    <summary className="text-lg font-bold cursor-pointer hover:text-slate-300">
                        Debug Information
                    </summary>
                    <div className="mt-4 space-y-4">
                        <div>
                            <h4 className="font-semibold mb-2">Frame Sample (First Frame):</h4>
                            <pre className="bg-slate-900 p-4 rounded overflow-x-auto text-sm">
                                {JSON.stringify(matchData.frames[0], null, 2)}
                            </pre>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Player Stats Sample:</h4>
                            <pre className="bg-slate-900 p-4 rounded overflow-x-auto text-sm">
                                {JSON.stringify(
                                    Object.values(matchData.playerStats)[0],
                                    null,
                                    2
                                )}
                            </pre>
                        </div>
                    </div>
                </details>
            </div>
        </div>
    );
}
