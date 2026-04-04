-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "season" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "GlobalGameSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "currentDate" DATETIME NOT NULL DEFAULT '2026-01-01',
    "currentSeason" INTEGER NOT NULL DEFAULT 1,
    "isConfigured" BOOLEAN NOT NULL DEFAULT false,
    "userTeamId" TEXT
);

-- CreateTable
CREATE TABLE "SeasonHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "standings" TEXT NOT NULL,
    "winnerId" TEXT,
    CONSTRAINT "SeasonHistory_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "leagueId" TEXT,
    "formation" TEXT NOT NULL DEFAULT '4-4-2',
    "mentality" TEXT NOT NULL DEFAULT 'NORMAL',
    "passing" TEXT NOT NULL DEFAULT 'MIXED',
    "tackling" TEXT NOT NULL DEFAULT 'NORMAL',
    "attacking_focus" TEXT NOT NULL DEFAULT 'MIXED',
    "creative_freedom" TEXT NOT NULL DEFAULT 'NORMAL',
    CONSTRAINT "Team_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "teamId" TEXT NOT NULL,
    "naturalPosition" TEXT NOT NULL,
    "handling" INTEGER NOT NULL DEFAULT 5,
    "tackling" INTEGER NOT NULL,
    "passing" INTEGER NOT NULL,
    "shooting" INTEGER NOT NULL,
    "heading" INTEGER NOT NULL,
    "dribbling" INTEGER NOT NULL,
    "crossing" INTEGER NOT NULL DEFAULT 10,
    "setPieces" INTEGER NOT NULL,
    "aggression" INTEGER NOT NULL,
    "positioning" INTEGER NOT NULL,
    "vision" INTEGER NOT NULL,
    "bravery" INTEGER NOT NULL,
    "leadership" INTEGER NOT NULL,
    "teamwork" INTEGER NOT NULL,
    "composure" INTEGER NOT NULL,
    "pace" INTEGER NOT NULL,
    "acceleration" INTEGER NOT NULL,
    "stamina" INTEGER NOT NULL DEFAULT 15,
    "strength" INTEGER NOT NULL,
    "agility" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "morale" INTEGER NOT NULL DEFAULT 100,
    "condition" INTEGER NOT NULL DEFAULT 100,
    "tacticalPosition" TEXT,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "apps" INTEGER NOT NULL DEFAULT 0,
    "yellowCards" INTEGER NOT NULL DEFAULT 0,
    "redCards" INTEGER NOT NULL DEFAULT 0,
    "avgRating" REAL NOT NULL DEFAULT 0.0,
    "passesAttempted" INTEGER NOT NULL DEFAULT 0,
    "passesCompleted" INTEGER NOT NULL DEFAULT 0,
    "crossesAttempted" INTEGER NOT NULL DEFAULT 0,
    "crossesCompleted" INTEGER NOT NULL DEFAULT 0,
    "birthDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retirementAge" INTEGER NOT NULL DEFAULT 38,
    "isRetired" BOOLEAN NOT NULL DEFAULT false,
    "motmCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "season" INTEGER NOT NULL DEFAULT 1,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "isPlayed" BOOLEAN NOT NULL DEFAULT false,
    "motmPlayerId" TEXT,
    "stats" TEXT,
    CONSTRAINT "Match_motmPlayerId_fkey" FOREIGN KEY ("motmPlayerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "minute" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "teamId" TEXT,
    "playerId" TEXT,
    CONSTRAINT "MatchEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerMatchStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "rating" REAL NOT NULL DEFAULT 6.0,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "passesAttempted" INTEGER NOT NULL DEFAULT 0,
    "passesCompleted" INTEGER NOT NULL DEFAULT 0,
    "crossesAttempted" INTEGER NOT NULL DEFAULT 0,
    "crossesCompleted" INTEGER NOT NULL DEFAULT 0,
    "shots" INTEGER NOT NULL DEFAULT 0,
    "shotsOnTarget" INTEGER NOT NULL DEFAULT 0,
    "tacklesAttempted" INTEGER NOT NULL DEFAULT 0,
    "tacklesWon" INTEGER NOT NULL DEFAULT 0,
    "dribblesAttempted" INTEGER NOT NULL DEFAULT 0,
    "dribblesWon" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "yellowCards" INTEGER NOT NULL DEFAULT 0,
    "redCards" INTEGER NOT NULL DEFAULT 0,
    "fitnessEnd" INTEGER NOT NULL DEFAULT 100,
    CONSTRAINT "PlayerMatchStats_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlayerMatchStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
