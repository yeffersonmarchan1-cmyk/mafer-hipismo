-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('VES', 'USD');

-- CreateEnum
CREATE TYPE "RaceDayStatus" AS ENUM ('OPEN', 'CLOSED', 'SETTLED');

-- CreateEnum
CREATE TYPE "HorseStatus" AS ENUM ('ACTIVE', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaceDay" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "venue" TEXT NOT NULL DEFAULT 'La Rinconada',
    "status" "RaceDayStatus" NOT NULL DEFAULT 'OPEN',
    "carryoverCents" INTEGER NOT NULL DEFAULT 0,
    "inscriptionSource" TEXT,
    "inscriptionsUpdatedAt" TIMESTAMP(3),
    "rolloverFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaceDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaceDayHorse" (
    "id" TEXT NOT NULL,
    "raceDayId" TEXT NOT NULL,
    "legNumber" INTEGER NOT NULL,
    "saddlecloth" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" "HorseStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "RaceDayHorse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" TEXT NOT NULL,
    "raceDayId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "stakeMinor" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "usdPerCurrencyUnitMicros" INTEGER NOT NULL,
    "poolContributionCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetSelection" (
    "id" TEXT NOT NULL,
    "betId" TEXT NOT NULL,
    "legNumber" INTEGER NOT NULL,
    "horse" INTEGER NOT NULL,

    CONSTRAINT "BetSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "betId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "reference" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WinningSelection" (
    "id" TEXT NOT NULL,
    "raceDayId" TEXT NOT NULL,
    "legNumber" INTEGER NOT NULL,
    "horse" INTEGER NOT NULL,

    CONSTRAINT "WinningSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "raceDayId" TEXT NOT NULL,
    "totalPoolCents" INTEGER NOT NULL,
    "commissionCents" INTEGER NOT NULL,
    "distributableCents" INTEGER NOT NULL,
    "payoutEachCents" INTEGER NOT NULL,
    "remainderCents" INTEGER NOT NULL,
    "winnerCount" INTEGER NOT NULL,
    "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "betId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Player_name_idx" ON "Player"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RaceDay_rolloverFromId_key" ON "RaceDay"("rolloverFromId");

-- CreateIndex
CREATE INDEX "RaceDay_date_idx" ON "RaceDay"("date");

-- CreateIndex
CREATE INDEX "RaceDay_status_date_idx" ON "RaceDay"("status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RaceDay_date_venue_key" ON "RaceDay"("date", "venue");

-- CreateIndex
CREATE INDEX "RaceDayHorse_raceDayId_legNumber_status_idx" ON "RaceDayHorse"("raceDayId", "legNumber", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RaceDayHorse_raceDayId_legNumber_saddlecloth_key" ON "RaceDayHorse"("raceDayId", "legNumber", "saddlecloth");

-- CreateIndex
CREATE INDEX "Bet_raceDayId_createdAt_idx" ON "Bet"("raceDayId", "createdAt");

-- CreateIndex
CREATE INDEX "Bet_playerId_idx" ON "Bet"("playerId");

-- CreateIndex
CREATE INDEX "BetSelection_betId_legNumber_idx" ON "BetSelection"("betId", "legNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BetSelection_betId_legNumber_horse_key" ON "BetSelection"("betId", "legNumber", "horse");

-- CreateIndex
CREATE INDEX "Payment_betId_paidAt_idx" ON "Payment"("betId", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_reference_idx" ON "Payment"("reference");

-- CreateIndex
CREATE INDEX "WinningSelection_raceDayId_idx" ON "WinningSelection"("raceDayId");

-- CreateIndex
CREATE UNIQUE INDEX "WinningSelection_raceDayId_legNumber_key" ON "WinningSelection"("raceDayId", "legNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_raceDayId_key" ON "Settlement"("raceDayId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_betId_key" ON "Payout"("betId");

-- CreateIndex
CREATE INDEX "Payout_settlementId_idx" ON "Payout"("settlementId");

-- AddForeignKey
ALTER TABLE "RaceDay" ADD CONSTRAINT "RaceDay_rolloverFromId_fkey" FOREIGN KEY ("rolloverFromId") REFERENCES "RaceDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceDayHorse" ADD CONSTRAINT "RaceDayHorse_raceDayId_fkey" FOREIGN KEY ("raceDayId") REFERENCES "RaceDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_raceDayId_fkey" FOREIGN KEY ("raceDayId") REFERENCES "RaceDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetSelection" ADD CONSTRAINT "BetSelection_betId_fkey" FOREIGN KEY ("betId") REFERENCES "Bet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_betId_fkey" FOREIGN KEY ("betId") REFERENCES "Bet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WinningSelection" ADD CONSTRAINT "WinningSelection_raceDayId_fkey" FOREIGN KEY ("raceDayId") REFERENCES "RaceDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_raceDayId_fkey" FOREIGN KEY ("raceDayId") REFERENCES "RaceDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_betId_fkey" FOREIGN KEY ("betId") REFERENCES "Bet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
