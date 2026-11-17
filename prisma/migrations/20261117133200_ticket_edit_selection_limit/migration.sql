ALTER TABLE "Ticket"
ADD COLUMN "selectedHorseCount" INTEGER NOT NULL DEFAULT 6;

UPDATE "Ticket" AS ticket
SET "selectedHorseCount" = (
  SELECT COUNT(*)::INTEGER
  FROM "TicketSelection" AS selection
  WHERE selection."ticketId" = ticket."id"
);

ALTER TABLE "Ticket"
ALTER COLUMN "selectedHorseCount" DROP DEFAULT;
