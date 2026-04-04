-- AddColumn: Add lastAIMarketProcessedDate to Team
ALTER TABLE "Team" ADD COLUMN "lastAIMarketProcessedDate" DATETIME;

-- Create index for efficient filtering of overdue teams
CREATE INDEX "Team_lastAIMarketProcessedDate_idx" ON "Team"("lastAIMarketProcessedDate");
