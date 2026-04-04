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
    "freeKicks" INTEGER NOT NULL DEFAULT 0,
    "corners" INTEGER NOT NULL DEFAULT 0,
    "throws" INTEGER NOT NULL DEFAULT 0,
    "birthDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retirementAge" INTEGER NOT NULL DEFAULT 38,
    "isRetired" BOOLEAN NOT NULL DEFAULT false,
    "motmCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Player" ("acceleration", "age", "aggression", "agility", "apps", "assists", "avgRating", "balance", "birthDate", "bravery", "composure", "condition", "crossesAttempted", "crossesCompleted", "crossing", "dribbling", "goals", "handling", "heading", "id", "isRetired", "leadership", "morale", "motmCount", "name", "naturalPosition", "pace", "passesAttempted", "passesCompleted", "passing", "positioning", "redCards", "retirementAge", "setPieces", "shooting", "stamina", "strength", "tackling", "tacticalPosition", "teamId", "teamwork", "vision", "yellowCards") SELECT "acceleration", "age", "aggression", "agility", "apps", "assists", "avgRating", "balance", "birthDate", "bravery", "composure", "condition", "crossesAttempted", "crossesCompleted", "crossing", "dribbling", "goals", "handling", "heading", "id", "isRetired", "leadership", "morale", "motmCount", "name", "naturalPosition", "pace", "passesAttempted", "passesCompleted", "passing", "positioning", "redCards", "retirementAge", "setPieces", "shooting", "stamina", "strength", "tackling", "tacticalPosition", "teamId", "teamwork", "vision", "yellowCards" FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
CREATE TABLE "new_PlayerMatchStats" (
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
    "freeKicks" INTEGER NOT NULL DEFAULT 0,
    "corners" INTEGER NOT NULL DEFAULT 0,
    "throws" INTEGER NOT NULL DEFAULT 0,
    "fitnessEnd" INTEGER NOT NULL DEFAULT 100,
    CONSTRAINT "PlayerMatchStats_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlayerMatchStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PlayerMatchStats" ("assists", "crossesAttempted", "crossesCompleted", "dribblesAttempted", "dribblesWon", "fitnessEnd", "goals", "id", "matchId", "minutes", "passesAttempted", "passesCompleted", "playerId", "rating", "redCards", "saves", "shots", "shotsOnTarget", "tacklesAttempted", "tacklesWon", "teamId", "yellowCards") SELECT "assists", "crossesAttempted", "crossesCompleted", "dribblesAttempted", "dribblesWon", "fitnessEnd", "goals", "id", "matchId", "minutes", "passesAttempted", "passesCompleted", "playerId", "rating", "redCards", "saves", "shots", "shotsOnTarget", "tacklesAttempted", "tacklesWon", "teamId", "yellowCards" FROM "PlayerMatchStats";
DROP TABLE "PlayerMatchStats";
ALTER TABLE "new_PlayerMatchStats" RENAME TO "PlayerMatchStats";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
