-- Add split role presets for separate attacking/defensive behavior
ALTER TABLE "Player" ADD COLUMN "attackingRolePreset" TEXT;
ALTER TABLE "Player" ADD COLUMN "defensiveRolePreset" TEXT;

-- Backfill existing role into both presets for compatibility
UPDATE "Player"
SET "attackingRolePreset" = "playerRole"
WHERE "attackingRolePreset" IS NULL AND "playerRole" IS NOT NULL;

UPDATE "Player"
SET "defensiveRolePreset" = "playerRole"
WHERE "defensiveRolePreset" IS NULL AND "playerRole" IS NOT NULL;
