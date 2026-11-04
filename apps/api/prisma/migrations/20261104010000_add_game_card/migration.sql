-- Global, reusable card library ("fixed pool").
CREATE TABLE "GameCard" (
    "id" TEXT NOT NULL,
    "cardKey" TEXT NOT NULL,
    "label" JSONB NOT NULL,
    "description" JSONB NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "controls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "kind" TEXT NOT NULL DEFAULT 'action',
    "immediate" JSONB,
    "delayed" JSONB,
    "scoreDelta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clarityDelta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revealsSignals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "premiumOnFocus" BOOLEAN NOT NULL DEFAULT false,
    "serviceCard" BOOLEAN NOT NULL DEFAULT false,
    "baseWeight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GameCard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GameCard_cardKey_key" ON "GameCard"("cardKey");
