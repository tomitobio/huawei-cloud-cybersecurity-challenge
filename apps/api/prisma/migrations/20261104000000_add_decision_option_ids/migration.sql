-- Multi-select decisions: store the full set of chosen option ids per round.
ALTER TABLE "SubmittedDecision" ADD COLUMN "optionIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
