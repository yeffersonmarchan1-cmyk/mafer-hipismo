-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "RaceDay" ADD COLUMN     "carryoverAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closesAt" TIMESTAMP(3),
ADD COLUMN     "firstRaceAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RaceDayHorse" ADD COLUMN     "gazetteOrder" INTEGER NOT NULL DEFAULT 0;

-- Existing imported cards were stored in saddlecloth order.
WITH "orderedHorses" AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "raceDayId", "legNumber"
            ORDER BY "saddlecloth"
        ) AS "orderNumber"
    FROM "RaceDayHorse"
)
UPDATE "RaceDayHorse"
SET "gazetteOrder" = "orderedHorses"."orderNumber"
FROM "orderedHorses"
WHERE "RaceDayHorse"."id" = "orderedHorses"."id";

-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN     "commissionUsd" DECIMAL(16,2) NOT NULL DEFAULT 0,
ADD COLUMN     "distributableUsd" DECIMAL(16,2) NOT NULL DEFAULT 0,
ADD COLUMN     "isCarryover" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totalPoolUsd" DECIMAL(16,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "whatsappPhone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "authVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginRateLimit" (
    "keyHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginRateLimit_pkey" PRIMARY KEY ("keyHash")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "ticketNumber" INTEGER NOT NULL,
    "raceDayId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "combinations" BIGINT NOT NULL,
    "unitPriceUsd" DECIMAL(12,2) NOT NULL DEFAULT 5,
    "amountUsd" DECIMAL(16,2) NOT NULL,
    "vesPerUsd" DECIMAL(14,4) NOT NULL,
    "amountVes" DECIMAL(18,2) NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketSelection" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "legNumber" INTEGER NOT NULL,
    "originalHorseId" TEXT NOT NULL,
    "currentHorseId" TEXT NOT NULL,
    "wasSubstituted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TicketSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HorseReplacement" (
    "id" TEXT NOT NULL,
    "ticketSelectionId" TEXT NOT NULL,
    "fromHorseId" TEXT NOT NULL,
    "toHorseId" TEXT NOT NULL,
    "replacedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL DEFAULT 'WITHDRAWN',

    CONSTRAINT "HorseReplacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProof" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL DEFAULT 'payment-proofs',
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "sourcePhone" TEXT NOT NULL,
    "expectedAmountVes" DECIMAL(18,2) NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "paymentBank" TEXT,
    "paymentCedula" TEXT,
    "paymentPhone" TEXT,
    "vesPerUsd" DECIMAL(14,4) NOT NULL DEFAULT 1,
    "infoMessage" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketPayout" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "amountUsd" DECIMAL(16,2) NOT NULL,

    CONSTRAINT "TicketPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_cedula_key" ON "User"("cedula");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "User_fullName_idx" ON "User"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "Ticket_userId_submittedAt_idx" ON "Ticket"("userId", "submittedAt");

-- CreateIndex
CREATE INDEX "Ticket_raceDayId_status_submittedAt_idx" ON "Ticket"("raceDayId", "status", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_raceDayId_ticketNumber_key" ON "Ticket"("raceDayId", "ticketNumber");

-- CreateIndex
CREATE INDEX "TicketSelection_ticketId_legNumber_idx" ON "TicketSelection"("ticketId", "legNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TicketSelection_ticketId_legNumber_originalHorseId_key" ON "TicketSelection"("ticketId", "legNumber", "originalHorseId");

-- CreateIndex
CREATE INDEX "HorseReplacement_ticketSelectionId_replacedAt_idx" ON "HorseReplacement"("ticketSelectionId", "replacedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProof_ticketId_key" ON "PaymentProof"("ticketId");

-- CreateIndex
CREATE INDEX "PaymentProof_uploadedAt_idx" ON "PaymentProof"("uploadedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TicketPayout_ticketId_key" ON "TicketPayout"("ticketId");

-- CreateIndex
CREATE INDEX "TicketPayout_settlementId_idx" ON "TicketPayout"("settlementId");

-- CreateIndex
CREATE INDEX "RaceDayHorse_raceDayId_legNumber_gazetteOrder_idx" ON "RaceDayHorse"("raceDayId", "legNumber", "gazetteOrder");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_raceDayId_fkey" FOREIGN KEY ("raceDayId") REFERENCES "RaceDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketSelection" ADD CONSTRAINT "TicketSelection_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketSelection" ADD CONSTRAINT "TicketSelection_originalHorseId_fkey" FOREIGN KEY ("originalHorseId") REFERENCES "RaceDayHorse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketSelection" ADD CONSTRAINT "TicketSelection_currentHorseId_fkey" FOREIGN KEY ("currentHorseId") REFERENCES "RaceDayHorse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorseReplacement" ADD CONSTRAINT "HorseReplacement_ticketSelectionId_fkey" FOREIGN KEY ("ticketSelectionId") REFERENCES "TicketSelection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorseReplacement" ADD CONSTRAINT "HorseReplacement_fromHorseId_fkey" FOREIGN KEY ("fromHorseId") REFERENCES "RaceDayHorse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorseReplacement" ADD CONSTRAINT "HorseReplacement_toHorseId_fkey" FOREIGN KEY ("toHorseId") REFERENCES "RaceDayHorse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketPayout" ADD CONSTRAINT "TicketPayout_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketPayout" ADD CONSTRAINT "TicketPayout_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
