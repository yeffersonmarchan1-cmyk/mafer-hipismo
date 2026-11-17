import { connection } from "next/server";
import { notFound } from "next/navigation";
import { TicketEditor } from "@/app/app/tickets/[ticketId]/edit/ticket-editor";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function EditTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  await connection();
  const user = await requireUser();
  const { ticketId } = await params;
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, userId: user.id },
    select: {
      id: true,
      ticketNumber: true,
      amountVes: true,
      selectedHorseCount: true,
      selections: {
        select: { legNumber: true, currentHorseId: true },
      },
      raceDay: {
        select: {
          date: true,
          status: true,
          closesAt: true,
          entries: {
            where: { status: "ACTIVE" },
            orderBy: [{ legNumber: "asc" }, { gazetteOrder: "asc" }],
            select: {
              id: true,
              legNumber: true,
              saddlecloth: true,
              name: true,
              gazetteOrder: true,
            },
          },
        },
      },
    },
  });
  if (
    !ticket ||
    ticket.raceDay.status !== "OPEN" ||
    (ticket.raceDay.closesAt && ticket.raceDay.closesAt <= new Date())
  ) {
    notFound();
  }

  return (
    <TicketEditor
      amountPaidCents={ticket.amountVes.mul(100).toFixed(0)}
      dateLabel={new Intl.DateTimeFormat("es-VE", {
        dateStyle: "long",
        timeZone: "UTC",
      }).format(ticket.raceDay.date)}
      horses={ticket.raceDay.entries}
      initialSelections={ticket.selections.map((selection) => ({
        legNumber: selection.legNumber,
        horseId: selection.currentHorseId,
      }))}
      requiredHorseCount={ticket.selectedHorseCount}
      ticketId={ticket.id}
      ticketNumber={ticket.ticketNumber}
    />
  );
}
