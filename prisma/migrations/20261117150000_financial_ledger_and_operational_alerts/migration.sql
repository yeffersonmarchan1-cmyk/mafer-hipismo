CREATE TYPE "FinancialLedgerType" AS ENUM (
    'TICKET_APPROVED',
    'LOGISTICS_COMMISSION',
    'PRIZE_PAYOUT',
    'CARRYOVER_IN',
    'CARRYOVER_OUT',
    'OPENING_BALANCE',
    'ADJUSTMENT'
);

CREATE TYPE "OperationalAlertSeverity" AS ENUM ('WARNING', 'ERROR');

CREATE TABLE "FinancialLedgerEntry" (
    "id" TEXT NOT NULL,
    "raceDayId" TEXT,
    "raceDayDate" TIMESTAMP(3),
    "venue" TEXT,
    "ticketId" TEXT,
    "ticketNumber" INTEGER,
    "settlementId" TEXT,
    "actorUserId" TEXT,
    "actorName" TEXT,
    "type" "FinancialLedgerType" NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "reference" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperationalAlert" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "severity" "OperationalAlertSeverity" NOT NULL DEFAULT 'ERROR',
    "message" TEXT NOT NULL,
    "metadataJson" TEXT,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,

    CONSTRAINT "OperationalAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinancialLedgerEntry_reference_key" ON "FinancialLedgerEntry"("reference");
CREATE INDEX "FinancialLedgerEntry_raceDayId_createdAt_idx" ON "FinancialLedgerEntry"("raceDayId", "createdAt");
CREATE INDEX "FinancialLedgerEntry_type_createdAt_idx" ON "FinancialLedgerEntry"("type", "createdAt");
CREATE UNIQUE INDEX "OperationalAlert_fingerprint_key" ON "OperationalAlert"("fingerprint");
CREATE INDEX "OperationalAlert_acknowledgedAt_lastSeenAt_idx" ON "OperationalAlert"("acknowledgedAt", "lastSeenAt");
CREATE INDEX "OperationalAlert_severity_lastSeenAt_idx" ON "OperationalAlert"("severity", "lastSeenAt");

ALTER TABLE "OperationalAlert"
    ADD CONSTRAINT "OperationalAlert_acknowledgedById_fkey"
    FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "FinancialLedgerEntry" (
    "id", "raceDayId", "raceDayDate", "venue", "ticketId", "ticketNumber",
    "actorUserId", "actorName", "type", "amountCents", "reference", "description", "createdAt"
)
SELECT
    'ledger_approved_' || ticket."id",
    day."id",
    day."date",
    day."venue",
    ticket."id",
    ticket."ticketNumber",
    ticket."reviewedById",
    reviewer."fullName",
    'TICKET_APPROVED'::"FinancialLedgerType",
    ROUND(ticket."amountVes" * 100)::BIGINT,
    'ticket-approved:' || ticket."id",
    'Pago aprobado al pozo',
    COALESCE(ticket."reviewedAt", ticket."submittedAt")
FROM "Ticket" AS ticket
JOIN "RaceDay" AS day ON day."id" = ticket."raceDayId"
LEFT JOIN "User" AS reviewer ON reviewer."id" = ticket."reviewedById"
WHERE ticket."status" = 'APPROVED';

INSERT INTO "FinancialLedgerEntry" (
    "id", "raceDayId", "raceDayDate", "venue", "settlementId",
    "type", "amountCents", "reference", "description", "createdAt"
)
SELECT
    'ledger_commission_' || settlement."id",
    day."id",
    day."date",
    day."venue",
    settlement."id",
    'LOGISTICS_COMMISSION'::"FinancialLedgerType",
    -settlement."commissionCents",
    'settlement-commission:' || settlement."id",
    'Comisión logística del 10%',
    settlement."settledAt"
FROM "Settlement" AS settlement
JOIN "RaceDay" AS day ON day."id" = settlement."raceDayId"
WHERE settlement."commissionCents" <> 0;

INSERT INTO "FinancialLedgerEntry" (
    "id", "raceDayId", "raceDayDate", "venue", "ticketId", "ticketNumber",
    "settlementId", "type", "amountCents", "reference", "description", "createdAt"
)
SELECT
    'ledger_prize_' || payout."id",
    day."id",
    day."date",
    day."venue",
    ticket."id",
    ticket."ticketNumber",
    payout."settlementId",
    'PRIZE_PAYOUT'::"FinancialLedgerType",
    -ROUND(payout."amountVes" * 100)::BIGINT,
    'ticket-payout:' || payout."id",
    'Premio de ticket',
    settlement."settledAt"
FROM "TicketPayout" AS payout
JOIN "Ticket" AS ticket ON ticket."id" = payout."ticketId"
JOIN "RaceDay" AS day ON day."id" = ticket."raceDayId"
JOIN "Settlement" AS settlement ON settlement."id" = payout."settlementId";

WITH carryovers AS (
    SELECT
        source."id" AS "sourceId",
        source."date" AS "sourceDate",
        source."venue" AS "sourceVenue",
        target."id" AS "targetId",
        target."date" AS "targetDate",
        target."venue" AS "targetVenue",
        settlement."id" AS "settlementId",
        CASE
            WHEN settlement."distributableCents" > 0
                THEN settlement."distributableCents"
            ELSE settlement."totalPoolCents" - settlement."commissionCents"
        END AS "amountCents",
        settlement."settledAt" AS "settledAt"
    FROM "Settlement" AS settlement
    JOIN "RaceDay" AS source ON source."id" = settlement."raceDayId"
    JOIN "RaceDay" AS target ON target."rolloverFromId" = source."id"
    WHERE settlement."isCarryover" = TRUE
)
INSERT INTO "FinancialLedgerEntry" (
    "id", "raceDayId", "raceDayDate", "venue", "settlementId",
    "type", "amountCents", "reference", "description", "createdAt"
)
SELECT
    'ledger_carryout_' || carry."settlementId",
    carry."sourceId",
    carry."sourceDate",
    carry."sourceVenue",
    carry."settlementId",
    'CARRYOVER_OUT'::"FinancialLedgerType",
    -carry."amountCents",
    'carryover-out:' || carry."settlementId",
    'Acumulado neto transferido a la próxima jornada',
    carry."settledAt"
FROM carryovers AS carry
WHERE carry."amountCents" > 0
UNION ALL
SELECT
    'ledger_carryin_' || carry."settlementId",
    carry."targetId",
    carry."targetDate",
    carry."targetVenue",
    carry."settlementId",
    'CARRYOVER_IN'::"FinancialLedgerType",
    carry."amountCents",
    'carryover-in:' || carry."settlementId",
    'Acumulado recibido de la jornada anterior',
    carry."settledAt"
FROM carryovers AS carry
WHERE carry."amountCents" > 0;

WITH carryover_in AS (
    SELECT "raceDayId", SUM("amountCents") AS "amountCents"
    FROM "FinancialLedgerEntry"
    WHERE "type" = 'CARRYOVER_IN'
    GROUP BY "raceDayId"
),
opening_balances AS (
    SELECT
        day."id",
        day."date",
        day."venue",
        ROUND(day."carryoverAmountVes" * 100)::BIGINT
            - COALESCE(carryover_in."amountCents", 0) AS "amountCents"
    FROM "RaceDay" AS day
    LEFT JOIN carryover_in ON carryover_in."raceDayId" = day."id"
)
INSERT INTO "FinancialLedgerEntry" (
    "id", "raceDayId", "raceDayDate", "venue", "type", "amountCents",
    "reference", "description", "createdAt"
)
SELECT
    'ledger_opening_' || opening."id",
    opening."id",
    opening."date",
    opening."venue",
    'OPENING_BALANCE'::"FinancialLedgerType",
    opening."amountCents",
    'opening-balance:' || opening."id",
    'Saldo acumulado existente al iniciar el libro contable',
    CURRENT_TIMESTAMP
FROM opening_balances AS opening
WHERE opening."amountCents" > 0;

CREATE FUNCTION prevent_financial_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Financial ledger entries are append-only';
END;
$$;

CREATE TRIGGER "FinancialLedgerEntry_append_only"
BEFORE UPDATE OR DELETE ON "FinancialLedgerEntry"
FOR EACH ROW EXECUTE FUNCTION prevent_financial_ledger_mutation();

CREATE TRIGGER "FinancialLedgerEntry_no_truncate"
BEFORE TRUNCATE ON "FinancialLedgerEntry"
FOR EACH STATEMENT EXECUTE FUNCTION prevent_financial_ledger_mutation();
