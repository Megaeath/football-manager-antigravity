-- DropIndex
DROP INDEX "Team_lastAIMarketProcessedDate_idx";

-- CreateTable
CREATE TABLE "CupTournament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "season" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "phase" TEXT NOT NULL DEFAULT 'SWISS',
    "currentRound" INTEGER NOT NULL DEFAULT 1,
    "startDate" DATETIME NOT NULL,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SwissStanding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "played" INTEGER NOT NULL DEFAULT 0,
    "win" INTEGER NOT NULL DEFAULT 0,
    "draw" INTEGER NOT NULL DEFAULT 0,
    "loss" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "gd" INTEGER NOT NULL DEFAULT 0,
    "gf" INTEGER NOT NULL DEFAULT 0,
    "buchholzScore" INTEGER NOT NULL DEFAULT 0,
    "form" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SwissStanding_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "CupTournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SwissStanding_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SwissMatchHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "teamAId" TEXT NOT NULL,
    "teamBId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SwissMatchHistory_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "CupTournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "season" INTEGER NOT NULL DEFAULT 1,
    "competitionType" TEXT NOT NULL DEFAULT 'LEAGUE',
    "competitionPhase" TEXT,
    "competitionRound" INTEGER,
    "cupTournamentId" TEXT,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "isPlayed" BOOLEAN NOT NULL DEFAULT false,
    "wentToExtraTime" BOOLEAN NOT NULL DEFAULT false,
    "wentToPenalties" BOOLEAN NOT NULL DEFAULT false,
    "penaltyHome" INTEGER,
    "penaltyAway" INTEGER,
    "homeTactics_formation" TEXT,
    "homeTactics_mentality" TEXT,
    "homeTactics_passing" TEXT,
    "homeTactics_tackling" TEXT,
    "homeTactics_attacking_focus" TEXT,
    "homeTactics_creative_freedom" TEXT,
    "awayTactics_formation" TEXT,
    "awayTactics_mentality" TEXT,
    "awayTactics_passing" TEXT,
    "awayTactics_tackling" TEXT,
    "awayTactics_attacking_focus" TEXT,
    "awayTactics_creative_freedom" TEXT,
    "homePrepConfig" TEXT,
    "awayPrepConfig" TEXT,
    "motmPlayerId" TEXT,
    "stats" TEXT,
    CONSTRAINT "Match_motmPlayerId_fkey" FOREIGN KEY ("motmPlayerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_cupTournamentId_fkey" FOREIGN KEY ("cupTournamentId") REFERENCES "CupTournament" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Match" ("awayPrepConfig", "awayScore", "awayTactics_attacking_focus", "awayTactics_creative_freedom", "awayTactics_formation", "awayTactics_mentality", "awayTactics_passing", "awayTactics_tackling", "awayTeamId", "date", "homePrepConfig", "homeScore", "homeTactics_attacking_focus", "homeTactics_creative_freedom", "homeTactics_formation", "homeTactics_mentality", "homeTactics_passing", "homeTactics_tackling", "homeTeamId", "id", "isPlayed", "motmPlayerId", "season", "stats") SELECT "awayPrepConfig", "awayScore", "awayTactics_attacking_focus", "awayTactics_creative_freedom", "awayTactics_formation", "awayTactics_mentality", "awayTactics_passing", "awayTactics_tackling", "awayTeamId", "date", "homePrepConfig", "homeScore", "homeTactics_attacking_focus", "homeTactics_creative_freedom", "homeTactics_formation", "homeTactics_mentality", "homeTactics_passing", "homeTactics_tackling", "homeTeamId", "id", "isPlayed", "motmPlayerId", "season", "stats" FROM "Match";
DROP TABLE "Match";
ALTER TABLE "new_Match" RENAME TO "Match";
CREATE INDEX "Match_season_competitionType_date_idx" ON "Match"("season", "competitionType", "date");
CREATE INDEX "Match_cupTournamentId_competitionRound_idx" ON "Match"("cupTournamentId", "competitionRound");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CupTournament_season_key" ON "CupTournament"("season");

-- CreateIndex
CREATE INDEX "SwissStanding_tournamentId_points_buchholzScore_gd_gf_idx" ON "SwissStanding"("tournamentId", "points", "buchholzScore", "gd", "gf");

-- CreateIndex
CREATE UNIQUE INDEX "SwissStanding_tournamentId_teamId_key" ON "SwissStanding"("tournamentId", "teamId");

-- CreateIndex
CREATE INDEX "SwissMatchHistory_tournamentId_idx" ON "SwissMatchHistory"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "SwissMatchHistory_tournamentId_teamAId_teamBId_key" ON "SwissMatchHistory"("tournamentId", "teamAId", "teamBId");
