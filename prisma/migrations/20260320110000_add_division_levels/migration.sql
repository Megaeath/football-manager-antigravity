ALTER TABLE "League" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Team" ADD COLUMN "lastDivisionChangeSeason" INTEGER;

CREATE UNIQUE INDEX "League_level_season_key" ON "League"("level", "season");