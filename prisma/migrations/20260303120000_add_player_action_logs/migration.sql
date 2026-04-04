-- Add field-third usage columns to PlayerMatchStats
ALTER TABLE "PlayerMatchStats" ADD COLUMN "defensiveThirdTouches" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlayerMatchStats" ADD COLUMN "middleThirdTouches" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlayerMatchStats" ADD COLUMN "attackingThirdTouches" INTEGER NOT NULL DEFAULT 0;

-- Create raw action log table for per-action analytics
CREATE TABLE "PlayerActionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "minute" INTEGER NOT NULL,
    "ballPosition" INTEGER NOT NULL,
    "zone" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "isSuccessful" BOOLEAN NOT NULL,
    "expectedSuccessRate" REAL,
    "targetPlayerId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerActionLog_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlayerActionLog_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "PlayerActionLog_matchId_playerId_idx" ON "PlayerActionLog"("matchId", "playerId");
CREATE INDEX "PlayerActionLog_playerId_actionType_idx" ON "PlayerActionLog"("playerId", "actionType");
CREATE INDEX "PlayerActionLog_teamId_zone_idx" ON "PlayerActionLog"("teamId", "zone");
