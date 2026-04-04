-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "fromTeamId" TEXT NOT NULL,
    "toTeamId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isFreeAgent" BOOLEAN NOT NULL DEFAULT false,
    "signOnBonus" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "windowEnds" DATETIME NOT NULL,
    CONSTRAINT "Bid_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Bid_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Bid_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "transferStatus" TEXT NOT NULL DEFAULT 'NOT_LISTED',
    "askingPrice" INTEGER,
    "squadStatus" TEXT NOT NULL DEFAULT 'ROTATION',
    CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Player" ("acceleration", "age", "aggression", "agility", "apps", "assists", "avgRating", "balance", "birthDate", "bravery", "composure", "condition", "contractEndWeek", "contractStartWeek", "corners", "crossesAttempted", "crossesCompleted", "crossing", "dribbling", "exp", "freeKicks", "goals", "handling", "heading", "id", "isRetired", "leadership", "morale", "motmCount", "name", "naturalPosition", "pace", "passesAttempted", "passesCompleted", "passing", "popularity", "positioning", "redCards", "retirementAge", "setPieces", "shooting", "stamina", "strength", "tackling", "tacticalPosition", "teamId", "teamwork", "throw", "throws", "vision", "weeklyWage", "yellowCards") SELECT "acceleration", "age", "aggression", "agility", "apps", "assists", "avgRating", "balance", "birthDate", "bravery", "composure", "condition", "contractEndWeek", "contractStartWeek", "corners", "crossesAttempted", "crossesCompleted", "crossing", "dribbling", "exp", "freeKicks", "goals", "handling", "heading", "id", "isRetired", "leadership", "morale", "motmCount", "name", "naturalPosition", "pace", "passesAttempted", "passesCompleted", "passing", "popularity", "positioning", "redCards", "retirementAge", "setPieces", "shooting", "stamina", "strength", "tackling", "tacticalPosition", "teamId", "teamwork", "throw", "throws", "vision", "weeklyWage", "yellowCards" FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
