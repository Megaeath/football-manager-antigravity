'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import PlayerModal from '@/components/PlayerModal';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';

type LeaderRow = {
    playerId: string;
    playerName: string;
    teamId: string;
    teamName: string;
    value: number;
    matches: number;
};

type CleanSheetLeader = {
    playerId: string;
    playerName: string;
    teamId: string;
    teamName: string;
    cleanSheets: number;
};

type MatchData = {
    id: string;
    homeTeamId: string;
    homeTeamName: string;
    awayTeamId: string;
    awayTeamName: string;
    homeScore: number;
    awayScore: number;
};

type TransferData = {
    id: string;
    playerId: string;
    playerName: string;
    fromTeamId: string | null;
    fromTeamName: string | null;
    toTeamId: string;
    toTeamName: string;
    fee: number;
};

interface SeasonSummaryClientProps {
    competition: 'all' | 'league' | 'cup';
    topScorers: LeaderRow[];
    topAssisters: LeaderRow[];
    topPassers: LeaderRow[];
    topDribblers: LeaderRow[];
    topPlayersOfSeason: LeaderRow[];
    topGoalkeepers: CleanSheetLeader[];
    highestTotalGoalsMatch: MatchData | null;
    highestWinnerGoalsMatch: MatchData | null;
    topTransferFees: TransferData[];
}

const PlayerLinkButton = ({ playerId, playerName, onClick }: { playerId: string; playerName: string; onClick: (id: string) => void }) => (
    <button
        onClick={() => onClick(playerId)}
        style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary)',
            cursor: 'pointer',
            padding: 0,
            font: 'inherit',
            fontWeight: 700,
            textDecoration: 'underline',
            textUnderlineOffset: '2px'
        }}
    >
        {playerName}
    </button>
);

const TeamLink = ({ teamId, teamName }: { teamId: string; teamName: string }) => (
    <Link href={`/team/${teamId}`} style={{ color: 'var(--muted)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
        {teamName}
    </Link>
);

const MatchLink = ({ match }: { match: MatchData }) => (
    <Link href={`/match?matchId=${match.id}`} style={{ color: 'var(--primary)', textDecoration: 'underline', textUnderlineOffset: '2px', fontWeight: 700 }}>
        {match.homeTeamName} {match.homeScore} - {match.awayScore} {match.awayTeamName}
    </Link>
);

function formatCurrency(num: number) {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
    return `$${num.toLocaleString()}`;
}

function renderLeaderValue(value: number) {
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
}

function LeaderboardCard({
    title,
    icon,
    rows,
    valueLabel,
    onPlayerClick
}: {
    title: string;
    icon: string;
    rows: LeaderRow[];
    valueLabel: string;
    onPlayerClick: (playerId: string) => void;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{icon} {title}</CardTitle>
            </CardHeader>
            {rows.length === 0 ? (
                <div style={{ color: 'var(--muted)', padding: '0.5rem 0' }}>No data available.</div>
            ) : (
                <div style={{ display: 'grid', gap: '0.65rem' }}>
                    {rows.map((row, index) => (
                        <div key={`${title}-${row.playerId}-${index}`} style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: '0.75rem', alignItems: 'center', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.8rem 0.9rem' }}>
                            <div style={{ fontWeight: 800, color: index === 0 ? '#f59e0b' : 'var(--muted)' }}>#{index + 1}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <PlayerLinkButton playerId={row.playerId} playerName={row.playerName} onClick={onPlayerClick} />
                                <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                                    <TeamLink teamId={row.teamId} teamName={row.teamName} /> · {row.matches} matches
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{renderLeaderValue(row.value)}</div>
                                <div style={{ fontSize: '0.74rem', color: 'var(--muted)', textTransform: 'uppercase' }}>{valueLabel}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}

function GoalkeeperCard({ rows, onPlayerClick }: { rows: CleanSheetLeader[]; onPlayerClick: (playerId: string) => void }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>🧤 Top Goalkeepers</CardTitle>
            </CardHeader>
            {rows.length === 0 ? (
                <div style={{ color: 'var(--muted)', padding: '0.5rem 0' }}>No data available.</div>
            ) : (
                <div style={{ display: 'grid', gap: '0.65rem' }}>
                    {rows.map((row, index) => (
                        <div key={`${row.playerId}-${index}`} style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: '0.75rem', alignItems: 'center', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.8rem 0.9rem' }}>
                            <div style={{ fontWeight: 800, color: index === 0 ? '#f59e0b' : 'var(--muted)' }}>#{index + 1}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <PlayerLinkButton playerId={row.playerId} playerName={row.playerName} onClick={onPlayerClick} />
                                <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                                    <TeamLink teamId={row.teamId} teamName={row.teamName} />
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{row.cleanSheets}</div>
                                <div style={{ fontSize: '0.74rem', color: 'var(--muted)', textTransform: 'uppercase' }}>clean sheets</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}

export default function SeasonSummaryClient({
    competition,
    topScorers,
    topAssisters,
    topPassers,
    topDribblers,
    topPlayersOfSeason,
    topGoalkeepers,
    highestTotalGoalsMatch,
    highestWinnerGoalsMatch,
    topTransferFees
}: SeasonSummaryClientProps) {
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

    const handlePlayerClick = useCallback((playerId: string) => {
        setSelectedPlayerId(playerId);
    }, []);

    const handleCloseModal = useCallback(() => {
        setSelectedPlayerId(null);
    }, []);

    return (
        <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                <LeaderboardCard title="Top Scorers" icon="🥅" rows={topScorers} valueLabel="goals" onPlayerClick={handlePlayerClick} />
                <LeaderboardCard title="Top Assists" icon="🎯" rows={topAssisters} valueLabel="assists" onPlayerClick={handlePlayerClick} />
                <LeaderboardCard title="Top Passers" icon="📨" rows={topPassers} valueLabel="passes" onPlayerClick={handlePlayerClick} />
                <LeaderboardCard title="Top Dribblers" icon="🌀" rows={topDribblers} valueLabel="dribbles" onPlayerClick={handlePlayerClick} />
                <LeaderboardCard title="Player of Season Ranking" icon="🌟" rows={topPlayersOfSeason} valueLabel="rating" onPlayerClick={handlePlayerClick} />
                <GoalkeeperCard rows={topGoalkeepers} onPlayerClick={handlePlayerClick} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                <Card>
                    <CardHeader>
                        <CardTitle>⚽ Match Records</CardTitle>
                    </CardHeader>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '0.9rem' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Highest Total Goals</div>
                            {highestTotalGoalsMatch ? <MatchLink match={highestTotalGoalsMatch} /> : <div style={{ color: 'var(--muted)' }}>No record available.</div>}
                        </div>
                        <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '0.9rem' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Most Goals By Winner</div>
                            {highestWinnerGoalsMatch ? <MatchLink match={highestWinnerGoalsMatch} /> : <div style={{ color: 'var(--muted)' }}>No record available.</div>}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                            Scope: {competition === 'cup' ? 'Cup' : competition === 'league' ? 'League' : 'All competitions'}
                        </div>
                    </div>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>💸 Top Transfer Fees</CardTitle>
                    </CardHeader>
                    {topTransferFees.length === 0 ? (
                        <div style={{ color: 'var(--muted)', padding: '0.5rem 0' }}>No transfer fees recorded.</div>
                    ) : (
                        <div style={{ display: 'grid', gap: '0.65rem' }}>
                            {topTransferFees.map((row, index) => (
                                <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: '0.75rem', alignItems: 'center', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.8rem 0.9rem' }}>
                                    <div style={{ fontWeight: 800, color: index === 0 ? '#f59e0b' : 'var(--muted)' }}>#{index + 1}</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <PlayerLinkButton playerId={row.playerId} playerName={row.playerName} onClick={handlePlayerClick} />
                                        <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                                            {row.fromTeamId && row.fromTeamName ? <TeamLink teamId={row.fromTeamId} teamName={row.fromTeamName} /> : <span>Free Agent</span>} → <TeamLink teamId={row.toTeamId} teamName={row.toTeamName} />
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', fontWeight: 800, color: 'var(--success)' }}>{formatCurrency(row.fee)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>

            {selectedPlayerId && (
                <PlayerModal playerId={selectedPlayerId} onClose={handleCloseModal} />
            )}
        </>
    );
}
