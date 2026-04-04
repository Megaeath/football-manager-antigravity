-- AlterTable
ALTER TABLE "Player" ADD COLUMN "lastTransferredSeason" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "GlobalGameSettings" ADD COLUMN "lastExpDecayMonth" INTEGER NOT NULL DEFAULT 0;
