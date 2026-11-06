-- Card relations (prerequisite + unlock) and per-session cost/score overrides.
ALTER TABLE "GameCard" ADD COLUMN "requiresCards" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "GameCard" ADD COLUMN "unlocksCards" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "WorkshopSession" ADD COLUMN "cardOverrides" JSONB;
