-- Training system (Phase 1)
ALTER TABLE "Team" ADD COLUMN "trainingFacilityLevel" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "TrainingAssignment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "teamId" TEXT NOT NULL,
  "playerId" TEXT,
  "slotIndex" INTEGER NOT NULL,
  "focusAttribute" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "lastGain" REAL NOT NULL DEFAULT 0,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "TrainingAssignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TrainingAssignment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TrainingAssignment_teamId_slotIndex_key" ON "TrainingAssignment"("teamId", "slotIndex");
CREATE INDEX "TrainingAssignment_teamId_playerId_idx" ON "TrainingAssignment"("teamId", "playerId");

CREATE TABLE "PlayerTrainingFraction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playerId" TEXT NOT NULL,
  "attribute" TEXT NOT NULL,
  "remainder" REAL NOT NULL DEFAULT 0,
  "lifetimeGain" REAL NOT NULL DEFAULT 0,
  CONSTRAINT "PlayerTrainingFraction_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PlayerTrainingFraction_playerId_attribute_key" ON "PlayerTrainingFraction"("playerId", "attribute");

CREATE TABLE "TrainingWeeklyLedger" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "teamId" TEXT NOT NULL,
  "weekKey" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "chargedFee" INTEGER NOT NULL DEFAULT 0,
  "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrainingWeeklyLedger_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TrainingWeeklyLedger_teamId_weekKey_key" ON "TrainingWeeklyLedger"("teamId", "weekKey");
