-- Add configurable yellow-card suspension threshold
ALTER TABLE "GlobalGameSettings" ADD COLUMN "yellowSuspensionThreshold" INTEGER NOT NULL DEFAULT 4;

-- Add player disciplinary + injury availability fields
ALTER TABLE "Player" ADD COLUMN "suspensionMatchesRemaining" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Player" ADD COLUMN "yellowCardAccumulation" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Player" ADD COLUMN "injuryWeeksRemaining" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Player" ADD COLUMN "injurySeverity" TEXT;
