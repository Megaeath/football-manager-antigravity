-- Add AI playstyle configuration fields to Team
ALTER TABLE "Team" ADD COLUMN "aiPlaystyleProfileId" TEXT;
ALTER TABLE "Team" ADD COLUMN "aiPlaystyleLocked" BOOLEAN NOT NULL DEFAULT false;