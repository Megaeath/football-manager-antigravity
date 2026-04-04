-- CreateTable
CREATE TABLE "PlayerReputation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "popularity" INTEGER NOT NULL DEFAULT 50,
    "trendChange" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerReputation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamReputation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "reputation" INTEGER NOT NULL DEFAULT 50,
    "trendChange" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamReputation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClubFinance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "weeklyIncome" INTEGER NOT NULL,
    "weeklyExpenses" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClubFinance_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamTactics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "normalFormation" TEXT NOT NULL DEFAULT '4-4-2',
    "normalMentality" TEXT NOT NULL DEFAULT 'NORMAL',
    "normalPassing" TEXT NOT NULL DEFAULT 'MIXED',
    "normalTackling" TEXT NOT NULL DEFAULT 'NORMAL',
    "normalAttacking_focus" TEXT NOT NULL DEFAULT 'MIXED',
    "normalCreative_freedom" TEXT NOT NULL DEFAULT 'NORMAL',
    "behindFormation" TEXT NOT NULL DEFAULT '4-4-2',
    "behindMentality" TEXT NOT NULL DEFAULT 'ALL_OUT_ATTACK',
    "behindPassing" TEXT NOT NULL DEFAULT 'DIRECT',
    "behindTackling" TEXT NOT NULL DEFAULT 'HARD',
    "behindAttacking_focus" TEXT NOT NULL DEFAULT 'WINGS',
    "behindCreative_freedom" TEXT NOT NULL DEFAULT 'MAXIMUM',
    "leadingFormation" TEXT NOT NULL DEFAULT '4-4-2',
    "leadingMentality" TEXT NOT NULL DEFAULT 'ULTRA_DEFENSIVE',
    "leadingPassing" TEXT NOT NULL DEFAULT 'SHORT',
    "leadingTackling" TEXT NOT NULL DEFAULT 'HARD',
    "leadingAttacking_focus" TEXT NOT NULL DEFAULT 'CENTER',
    "leadingCreative_freedom" TEXT NOT NULL DEFAULT 'NORMAL',
    CONSTRAINT "TeamTactics_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinancialEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    CONSTRAINT "FinancialEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Player" (
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
    "throw" INTEGER NOT NULL DEFAULT 10,
    "aggression" INTEGER NOT NULL,
    "positioning" INTEGER NOT NULL,
    "vision" INTEGER NOT NULL,
    "bravery" INTEGER NOT NULL,
    "leadership" INTEGER NOT NULL,
    "teamwork" INTEGER NOT NULL,
    "composure" INTEGER NOT NULL,
    "exp" INTEGER NOT NULL DEFAULT 0,
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
    "freeKicks" INTEGER NOT NULL DEFAULT 0,
    "corners" INTEGER NOT NULL DEFAULT 0,
    "throws" INTEGER NOT NULL DEFAULT 0,
    "birthDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retirementAge" INTEGER NOT NULL DEFAULT 38,
    "isRetired" BOOLEAN NOT NULL DEFAULT false,
    "motmCount" INTEGER NOT NULL DEFAULT 0,
    "popularity" INTEGER NOT NULL DEFAULT 50,
    "contractStartWeek" INTEGER NOT NULL DEFAULT 0,
    "contractEndWeek" INTEGER NOT NULL DEFAULT 52,
    "weeklyWage" INTEGER NOT NULL DEFAULT 10000,
    CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Player" ("acceleration", "age", "aggression", "agility", "apps", "assists", "avgRating", "balance", "birthDate", "bravery", "composure", "condition", "corners", "crossesAttempted", "crossesCompleted", "crossing", "dribbling", "freeKicks", "goals", "handling", "heading", "id", "isRetired", "leadership", "morale", "motmCount", "name", "naturalPosition", "pace", "passesAttempted", "passesCompleted", "passing", "positioning", "redCards", "retirementAge", "setPieces", "shooting", "stamina", "strength", "tackling", "tacticalPosition", "teamId", "teamwork", "throws", "vision", "yellowCards") SELECT "acceleration", "age", "aggression", "agility", "apps", "assists", "avgRating", "balance", "birthDate", "bravery", "composure", "condition", "corners", "crossesAttempted", "crossesCompleted", "crossing", "dribbling", "freeKicks", "goals", "handling", "heading", "id", "isRetired", "leadership", "morale", "motmCount", "name", "naturalPosition", "pace", "passesAttempted", "passesCompleted", "passing", "positioning", "redCards", "retirementAge", "setPieces", "shooting", "stamina", "strength", "tackling", "tacticalPosition", "teamId", "teamwork", "throws", "vision", "yellowCards" FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
CREATE TABLE "new_Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "leagueId" TEXT,
    "formation" TEXT NOT NULL DEFAULT '4-4-2',
    "mentality" TEXT NOT NULL DEFAULT 'NORMAL',
    "passing" TEXT NOT NULL DEFAULT 'MIXED',
    "tackling" TEXT NOT NULL DEFAULT 'NORMAL',
    "attacking_focus" TEXT NOT NULL DEFAULT 'MIXED',
    "creative_freedom" TEXT NOT NULL DEFAULT 'NORMAL',
    "balance" INTEGER NOT NULL DEFAULT 5000000,
    "reputation" INTEGER NOT NULL DEFAULT 50,
    "stadiumCapacity" INTEGER NOT NULL DEFAULT 50000,
    CONSTRAINT "Team_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Team" ("attacking_focus", "creative_freedom", "formation", "id", "leagueId", "mentality", "name", "passing", "tackling") SELECT "attacking_focus", "creative_freedom", "formation", "id", "leagueId", "mentality", "name", "passing", "tackling" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PlayerReputation_playerId_week_key" ON "PlayerReputation"("playerId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "TeamReputation_teamId_week_key" ON "TeamReputation"("teamId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "ClubFinance_teamId_week_key" ON "ClubFinance"("teamId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "TeamTactics_teamId_key" ON "TeamTactics"("teamId");
