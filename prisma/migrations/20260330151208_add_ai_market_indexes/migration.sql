-- CreateIndex
CREATE INDEX "Bid_status_windowEnds_idx" ON "Bid"("status", "windowEnds");

-- CreateIndex
CREATE INDEX "Bid_playerId_status_idx" ON "Bid"("playerId", "status");

-- CreateIndex
CREATE INDEX "Match_season_idx" ON "Match"("season");

-- CreateIndex
CREATE INDEX "Player_transferStatus_isRetired_idx" ON "Player"("transferStatus", "isRetired");

-- CreateIndex
CREATE INDEX "Player_teamId_isRetired_idx" ON "Player"("teamId", "isRetired");

-- CreateIndex
CREATE INDEX "Player_age_transferStatus_idx" ON "Player"("age", "transferStatus");

-- CreateIndex
CREATE INDEX "Player_lastTransferredSeason_idx" ON "Player"("lastTransferredSeason");

-- CreateIndex
CREATE INDEX "PlayerMatchStats_matchId_playerId_idx" ON "PlayerMatchStats"("matchId", "playerId");
