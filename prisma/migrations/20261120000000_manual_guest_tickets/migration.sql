ALTER TABLE "Ticket"
    ALTER COLUMN "userId" DROP NOT NULL,
    ADD COLUMN "guestName" TEXT,
    ADD COLUMN "guestPhone" TEXT,
    ADD CONSTRAINT "Ticket_guest_identity_check" CHECK (
        ("userId" IS NOT NULL AND "guestName" IS NULL AND "guestPhone" IS NULL)
        OR
        ("userId" IS NULL AND "guestName" IS NOT NULL AND length(btrim("guestName")) > 0)
    );
