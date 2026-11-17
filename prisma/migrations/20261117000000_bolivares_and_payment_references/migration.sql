-- Keep saved VES ticket totals as the historical amounts and make VES the
-- authoritative currency for all future ticket, pool, and settlement values.
ALTER TABLE "RaceDay" RENAME COLUMN "carryoverAmount" TO "carryoverAmountVes";
ALTER TABLE "Settlement" RENAME COLUMN "totalPoolUsd" TO "totalPoolVes";
ALTER TABLE "Settlement" RENAME COLUMN "commissionUsd" TO "commissionVes";
ALTER TABLE "Settlement" RENAME COLUMN "distributableUsd" TO "distributableVes";
ALTER TABLE "TicketPayout" RENAME COLUMN "amountUsd" TO "amountVes";

ALTER TABLE "RaceDay"
    ALTER COLUMN "carryoverAmountVes" TYPE DECIMAL(18,2);
ALTER TABLE "Settlement"
    ALTER COLUMN "totalPoolVes" TYPE DECIMAL(18,2),
    ALTER COLUMN "commissionVes" TYPE DECIMAL(18,2),
    ALTER COLUMN "distributableVes" TYPE DECIMAL(18,2);
ALTER TABLE "TicketPayout"
    ALTER COLUMN "amountVes" TYPE DECIMAL(18,2);
ALTER TABLE "RaceDay"
    ALTER COLUMN "carryoverCents" TYPE BIGINT USING "carryoverCents"::BIGINT;
ALTER TABLE "Settlement"
    ALTER COLUMN "totalPoolCents" TYPE BIGINT USING "totalPoolCents"::BIGINT,
    ALTER COLUMN "commissionCents" TYPE BIGINT USING "commissionCents"::BIGINT,
    ALTER COLUMN "distributableCents" TYPE BIGINT USING "distributableCents"::BIGINT,
    ALTER COLUMN "payoutEachCents" TYPE BIGINT USING "payoutEachCents"::BIGINT,
    ALTER COLUMN "remainderCents" TYPE BIGINT USING "remainderCents"::BIGINT;

ALTER TABLE "PaymentProof"
    ADD COLUMN "paymentReference" TEXT,
    ALTER COLUMN "storageBucket" DROP NOT NULL,
    ALTER COLUMN "storageBucket" DROP DEFAULT,
    ALTER COLUMN "storageKey" DROP NOT NULL,
    ALTER COLUMN "contentType" DROP NOT NULL,
    ALTER COLUMN "fileSizeBytes" DROP NOT NULL;

WITH RECURSIVE "approvedAmounts" AS MATERIALIZED (
    SELECT "raceDayId", COALESCE(SUM("amountVes"), 0)::DECIMAL(18,2) AS "amountVes"
    FROM "Ticket"
    WHERE "status" = 'APPROVED'
    GROUP BY "raceDayId"
),
"carryovers" ("id", "amountVes") AS (
    SELECT
        day."id",
        ROUND(
            CASE
                WHEN day."carryoverAmountVes" = 0 THEN day."carryoverCents" / 100.0
                ELSE day."carryoverAmountVes"
            END * COALESCE(
                (SELECT config."vesPerUsd" FROM "SystemConfig" AS config WHERE config."id" = 1),
                1
            ),
            2
        )::DECIMAL(18,2)
    FROM "RaceDay" AS day
    WHERE day."rolloverFromId" IS NULL

    UNION ALL

    SELECT
        next_day."id",
        (carryovers."amountVes" + COALESCE(approved."amountVes", 0))::DECIMAL(18,2)
    FROM "RaceDay" AS next_day
    JOIN "carryovers" ON next_day."rolloverFromId" = carryovers."id"
    LEFT JOIN "approvedAmounts" AS approved ON approved."raceDayId" = carryovers."id"
)
UPDATE "RaceDay" AS day
SET "carryoverAmountVes" = carryovers."amountVes",
    "carryoverCents" = ROUND(carryovers."amountVes" * 100)::BIGINT
FROM "carryovers"
WHERE day."id" = carryovers."id";

WITH "poolTotals" AS (
    SELECT
        settlement."id",
        settlement."winnerCount",
        ROUND(
            (day."carryoverAmountVes" + COALESCE(SUM(ticket."amountVes"), 0)) * 100
        )::BIGINT AS "totalPoolCents"
    FROM "Settlement" AS settlement
    JOIN "RaceDay" AS day ON day."id" = settlement."raceDayId"
    LEFT JOIN "Ticket" AS ticket
        ON ticket."raceDayId" = day."id"
        AND ticket."status" = 'APPROVED'
    GROUP BY settlement."id", settlement."winnerCount", day."carryoverAmountVes"
),
"commissions" AS (
    SELECT
        *,
        CASE WHEN "winnerCount" = 0 THEN 0 ELSE "totalPoolCents" / 10 END AS "commissionCents"
    FROM "poolTotals"
),
"distributions" AS (
    SELECT
        *,
        CASE
            WHEN "winnerCount" = 0 THEN 0
            ELSE "totalPoolCents" - "commissionCents"
        END AS "distributableCents"
    FROM "commissions"
),
"payouts" AS (
    SELECT
        *,
        CASE
            WHEN "winnerCount" = 0 THEN 0
            ELSE "distributableCents" / "winnerCount"
        END AS "payoutEachCents",
        CASE
            WHEN "winnerCount" = 0 THEN 0
            ELSE "distributableCents" % "winnerCount"
        END AS "remainderCents"
    FROM "distributions"
)
UPDATE "Settlement" AS settlement
SET "totalPoolCents" = payouts."totalPoolCents",
    "commissionCents" = payouts."commissionCents",
    "distributableCents" = payouts."distributableCents",
    "payoutEachCents" = payouts."payoutEachCents",
    "remainderCents" = payouts."remainderCents",
    "totalPoolVes" = payouts."totalPoolCents" / 100.0,
    "commissionVes" = payouts."commissionCents" / 100.0,
    "distributableVes" = payouts."distributableCents" / 100.0
FROM "payouts"
WHERE settlement."id" = payouts."id";

UPDATE "TicketPayout" AS payout
SET "amountVes" = settlement."payoutEachCents" / 100.0
FROM "Settlement" AS settlement
WHERE payout."settlementId" = settlement."id";

ALTER TABLE "PaymentProof"
    ADD CONSTRAINT "PaymentProof_source_check" CHECK (
        ("paymentReference" IS NOT NULL OR "storageKey" IS NOT NULL)
        AND (
            ("storageBucket" IS NULL AND "storageKey" IS NULL AND "contentType" IS NULL AND "fileSizeBytes" IS NULL)
            OR
            ("storageBucket" IS NOT NULL AND "storageKey" IS NOT NULL AND "contentType" IS NOT NULL AND "fileSizeBytes" IS NOT NULL)
        )
    );

ALTER TABLE "Ticket"
    DROP COLUMN "unitPriceUsd",
    DROP COLUMN "amountUsd",
    DROP COLUMN "vesPerUsd";
ALTER TABLE "SystemConfig" DROP COLUMN "vesPerUsd";
