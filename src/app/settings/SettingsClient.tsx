'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { resetGameWithSelectedTeam, updateTeamPlaystyleProfile, updateYellowSuspensionThreshold } from '../actions';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SETTINGS, ACTIONS } from '@/lib/constants/uiLabels';

type TeamOption = {
    id: string;
    name: string;
    aiPlaystyleProfileId?: string | null;
    divisionLevel?: number;
    divisionName?: string;
};

type PlaystyleOption = {
    id: string;
    name: string;
    description: string;
};

type NewGameDivision = { level: number; name: string; teams: string[] };

export default function SettingsClient({
    teams,
    newGameDivisionTeams,
    currentUserTeamName,
    yellowSuspensionThreshold,
    currentUserTeamId,
    currentUserTeamStyleProfileId,
    playstyleOptions
}: {
    teams: TeamOption[];
    newGameDivisionTeams: NewGameDivision[];
    currentUserTeamName: string;
    yellowSuspensionThreshold: number;
    currentUserTeamId: string;
    currentUserTeamStyleProfileId: string;
    playstyleOptions: PlaystyleOption[];
}) {
    const router = useRouter();
    const [step, setStep] = useState<'idle' | 'confirm' | 'choose'>('idle');
    const [loading, setLoading] = useState(false);
    const [selectedTeamName, setSelectedTeamName] = useState(currentUserTeamName || newGameDivisionTeams[0]?.teams[0] || '');
    const [yellowThreshold, setYellowThreshold] = useState(yellowSuspensionThreshold || 4);
    const [selectedPlaystyle, setSelectedPlaystyle] = useState(currentUserTeamStyleProfileId);
    const [message, setMessage] = useState('');

    const handleSaveDisciplineSettings = async () => {
        setLoading(true);
        setMessage('Saving yellow card suspension rules...');
        try {
            await updateYellowSuspensionThreshold(yellowThreshold);
            setMessage(`✅ Saved: ${yellowThreshold} yellow cards = 1 match suspension`);
            router.refresh();
        } catch (error) {
            console.error('Failed to update yellow suspension threshold', error);
            setMessage('❌ Failed to save discipline rules');
        } finally {
            setLoading(false);
        }
    };

    const handleStartNewGame = async () => {
        if (!selectedTeamName) {
            setMessage('Please select a team before starting a new game');
            return;
        }

        setLoading(true);
        setMessage('Starting new game...');

        try {
            const result = await resetGameWithSelectedTeam(selectedTeamName);
            setMessage(`✅ New game started! Selected team: ${result.userTeamName || 'Unknown'}`);
            router.push('/squad');
            router.refresh();
        } catch (error) {
            console.error('Failed to reset game', error);
            setMessage('❌ Error starting new game');
        } finally {
            setLoading(false);
        }
    };

    const handleSavePlaystyle = async () => {
        if (!currentUserTeamId) {
            setMessage('❌ No active user team');
            return;
        }

        setLoading(true);
        setMessage('Saving playstyle profile...');
        try {
            await updateTeamPlaystyleProfile(currentUserTeamId, selectedPlaystyle);
            const chosen = playstyleOptions.find((p) => p.id === selectedPlaystyle);
            setMessage(`✅ Saved playstyle: ${chosen?.name || selectedPlaystyle}`);
            router.refresh();
        } catch (error) {
            console.error('Failed to update playstyle profile', error);
            setMessage('❌ Failed to save playstyle profile');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 md:gap-8">
            {/* Header */}
            <div className="hero-gradient">
                <h1 className="text-2xl md:text-4xl" style={{ margin: 0 }}>⚙️ {SETTINGS.TITLE}</h1>
                <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9 }}>Manage game settings and preferences</p>
            </div>

            {/* Current Team Info */}
            <Card>
                <CardHeader>
                    <CardTitle>📋 Current Status</CardTitle>
                </CardHeader>
                <div style={{ fontSize: '1.1rem' }}>
                    Current Team: <strong style={{ color: 'var(--primary)', fontSize: '1.2rem' }}>{currentUserTeamName || 'None'}</strong>
                </div>
            </Card>

            {/* Discipline Settings */}
            <Card>
                <CardHeader>
                    <CardTitle>🟨 Yellow Card Suspension Rules</CardTitle>
                </CardHeader>
                <div style={{ padding: '1rem', background: 'var(--primary-light)', borderRadius: '10px' }}>
                    <p style={{ marginBottom: '1rem', color: 'var(--muted)' }}>
                        Set the number of yellow card accumulations that trigger an automatic suspension (recommended: 4)
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
                        <input
                            type="number"
                            min={1}
                            max={10}
                            value={yellowThreshold}
                            onChange={(e) => setYellowThreshold(Math.max(1, Math.min(10, Number(e.target.value) || 4)))}
                            disabled={loading}
                            className="input"
                            style={{ width: '90px' }}
                        />
                        <span style={{ color: 'var(--foreground)', fontSize: '0.95rem' }}>yellow cards = 1 match suspension</span>
                        <Button 
                            variant="primary" 
                            size="sm"
                            onClick={handleSaveDisciplineSettings}
                            disabled={loading}
                        >
                            {loading ? '⏳ Saving...' : ACTIONS.SAVE}
                        </Button>
                    </div>
                </div>
            </Card>

            {/* AI Playstyle Profile */}
            <Card>
                <CardHeader>
                    <CardTitle>🧠 AI Team Playstyle Profile</CardTitle>
                </CardHeader>
                <div style={{ padding: '1rem', background: 'var(--primary-light)', borderRadius: '10px' }}>
                    <p style={{ marginBottom: '1rem', color: 'var(--muted)' }}>
                        Choose your team identity profile. This affects AI auto-tactics and transfer targeting behavior.
                    </p>
                    <div style={{ display: 'grid', gap: '0.75rem', maxWidth: '620px' }}>
                        <select
                            value={selectedPlaystyle}
                            onChange={(e) => setSelectedPlaystyle(e.target.value)}
                            disabled={loading}
                            className="select"
                        >
                            {playstyleOptions.map((profile) => (
                                <option key={profile.id} value={profile.id}>
                                    {profile.name}
                                </option>
                            ))}
                        </select>

                        <div style={{ fontSize: '0.92rem', color: 'var(--muted)' }}>
                            {playstyleOptions.find((p) => p.id === selectedPlaystyle)?.description}
                        </div>

                        <div>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={handleSavePlaystyle}
                                disabled={loading}
                            >
                                {loading ? '⏳ Saving...' : 'Save Playstyle'}
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>

            {/* New Game */}
            <Card>
                <CardHeader>
                    <CardTitle>🧨 New Game</CardTitle>
                </CardHeader>
                <div style={{ padding: '1rem', background: '#fff1f2', borderRadius: '10px', border: '1px solid #fecaca' }}>
                    <p style={{ marginBottom: '1rem', color: '#7f1d1d' }}>
                        ⚠️ This action will delete all existing game data including league standings, match results, transfer market, news, and statistics.
                    </p>

                    {step === 'idle' && (
                        <Button
                            variant="primary"
                            onClick={() => {
                                setStep('confirm');
                                setMessage('');
                            }}
                            style={{ background: '#b91c1c' }}
                        >
                            Start New Game
                        </Button>
                    )}

                    {step === 'confirm' && (
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <Button
                                variant="primary"
                                style={{ background: '#b91c1c' }}
                                onClick={() => setStep('choose')}
                            >
                                ✅ Confirm
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setStep('idle');
                                    setMessage('Cancelled');
                                }}
                            >
                                {ACTIONS.CANCEL}
                            </Button>
                        </div>
                    )}

                    {step === 'choose' && (
                        <div style={{ display: 'grid', gap: '0.75rem', maxWidth: '420px' }}>
                            <label style={{ fontWeight: 600 }}>Select team to manage in new game</label>
                            <select
                                value={selectedTeamName}
                                onChange={(e) => setSelectedTeamName(e.target.value)}
                                className="select"
                                disabled={loading}
                                size={1}
                            >
                                {newGameDivisionTeams.map((div) => (
                                    <optgroup key={div.level} label={`── ${div.name} ──`}>
                                        {div.teams.map((teamName) => (
                                            <option key={teamName} value={teamName}>
                                                {teamName}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>

                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                                <Button
                                    variant="primary"
                                    style={{ background: '#b91c1c' }}
                                    onClick={handleStartNewGame}
                                    disabled={loading}
                                >
                                    {loading ? '⏳ Resetting...' : '✅ Confirm New Game'}
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        setStep('confirm');
                                        setMessage('');
                                    }}
                                    disabled={loading}
                                >
                                    Back
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {/* Message Display */}
            {message && (
                <div className="card" style={{ 
                    padding: '1rem', 
                    borderColor: message.includes('✅') || message.includes('Saved') || message.includes('started') ? 'var(--success)' : 'var(--danger)',
                    background: message.includes('✅') || message.includes('Saved') || message.includes('started') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: message.includes('✅') || message.includes('Saved') || message.includes('started') ? 'var(--success)' : 'var(--danger)',
                    fontWeight: '600'
                }}>
                    {message}
                </div>
            )}
        </div>
    );
}
