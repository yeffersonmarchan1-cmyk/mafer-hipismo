import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { requireAdmin } from "@/lib/auth";
import { formatBsFromCents } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { raceDayVenueLabel } from "@/lib/race-day";
import { ticketOwnerName } from "@/lib/ticket-owner";

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 42;
const contentWidth = pageWidth - margin * 2;

function toCents(amount: Prisma.Decimal) {
  return BigInt(
    amount.mul(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toFixed(0),
  );
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = rgb(0.12, 0.16, 0.19),
) {
  page.drawText(text, { x, y, font, size, color });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ raceDayId: string }> },
) {
  await requireAdmin();
  const { raceDayId } = await params;
  const raceDay = await prisma.raceDay.findUnique({
    where: { id: raceDayId },
    include: {
      tickets: {
        where: { status: "APPROVED" },
        orderBy: { ticketNumber: "asc" },
        include: {
          user: { select: { fullName: true } },
          selections: {
            orderBy: { legNumber: "asc" },
            include: { currentHorse: { select: { saddlecloth: true, name: true } } },
          },
        },
      },
      settlement: {
        select: {
          isCarryover: true,
          winnerCount: true,
          commissionCents: true,
          distributableCents: true,
          remainderCents: true,
        },
      },
    },
  });
  if (!raceDay || raceDay.status === "OPEN") {
    return NextResponse.json({ error: "El reporte está disponible cuando se cierran las apuestas." }, { status: 404 });
  }
  const settlement = raceDay.settlement;

  const approvedCents = raceDay.tickets.reduce(
    (total, ticket) => total + toCents(ticket.amountVes),
    BigInt(0),
  );
  const totalPoolCents = toCents(raceDay.carryoverAmountVes) + approvedCents;
  const estimatedCommissionCents = totalPoolCents / BigInt(10);
  const estimatedPrizeCents = totalPoolCents - estimatedCommissionCents;

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Cuadros jugados - ${raceDay.venue}`);
  pdf.setSubject("Reporte administrativo de tickets aprobados y acumulado");
  pdf.setCreator("Cuadro Perfecto");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  const heading = `${raceDayVenueLabel(raceDay.venue)} - Cuadro Perfecto`;
  const dateLabel = new Intl.DateTimeFormat("es-VE", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(raceDay.date);

  function drawPageHeading() {
    drawText(page, heading, margin, y, bold, 16);
    y -= 23;
    drawText(page, dateLabel, margin, y, regular, 10, rgb(0.35, 0.4, 0.43));
    y -= 17;
    drawText(
      page,
      `Estado: ${settlement ? "Liquidada" : "Apuestas cerradas / carreras en curso"}`,
      margin,
      y,
      regular,
      9,
      rgb(0.35, 0.4, 0.43),
    );
    y -= 20;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.7,
      color: rgb(0.78, 0.81, 0.82),
    });
    y -= 18;
  }

  drawPageHeading();
  const summary = [
    `Pozo total (arrastre + aprobados): ${formatBsFromCents(totalPoolCents)}`,
    settlement
      ? `Comision liquidada: ${formatBsFromCents(settlement.commissionCents)}`
      : `Comision logistica estimada 10%: ${formatBsFromCents(estimatedCommissionCents)}`,
    settlement
      ? settlement.isCarryover
        ? `Arrastre neto a la proxima jornada del mismo hipodromo: ${formatBsFromCents(settlement.distributableCents > BigInt(0) ? settlement.distributableCents : totalPoolCents)}`
        : `Premios pagados: ${formatBsFromCents(settlement.distributableCents - settlement.remainderCents)} (${settlement.winnerCount} tickets ganadores)`
      : `Premio o arrastre estimado 90%: ${formatBsFromCents(estimatedPrizeCents)}`,
    ...(settlement && settlement.remainderCents > BigInt(0)
      ? [`Residuo acumulado para la proxima jornada: ${formatBsFromCents(settlement.remainderCents)}`]
      : []),
    `Tickets aprobados: ${raceDay.tickets.length} | Recaudacion aprobada: ${formatBsFromCents(approvedCents)}`,
  ];
  for (const line of summary) {
    drawText(page, line, margin, y, bold, 9);
    y -= 15;
  }
  if (!settlement) {
    drawText(
      page,
      "Se retiene el 10% como comision logistica; el 90% restante se reparte entre ganadores o pasa como arrastre si no hay ganadores.",
      margin,
      y,
      regular,
      8,
      rgb(0.35, 0.4, 0.43),
    );
    y -= 17;
  } else {
    y -= 5;
  }
  y -= 8;

  if (!raceDay.tickets.length) {
    drawText(page, "No hay tickets aprobados en esta jornada.", margin, y, regular, 10);
  }

  for (const ticket of raceDay.tickets) {
    const lines = Array.from({ length: 6 }, (_, index) => {
      const leg = index + 1;
      const names = ticket.selections
        .filter((selection) => selection.legNumber === leg)
        .map(({ currentHorse }) => `${currentHorse.saddlecloth} ${currentHorse.name}`)
        .join(", ");
      return `V${leg}: ${names || "-"}`;
    }).flatMap((line) => wrapText(line, regular, 8.5, contentWidth - 12));
    if (y - 40 < margin) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      drawPageHeading();
    }
    drawText(
      page,
      `Ticket #${ticket.ticketNumber} - ${ticketOwnerName(ticket)}`,
      margin + 7,
      y - 11,
      bold,
      9,
    );
    const amount = formatBsFromCents(toCents(ticket.amountVes));
    drawText(
      page,
      `${ticket.combinations.toString()} combinaciones - ${amount}`,
      margin + 7,
      y - 23,
      regular,
      8,
    );
    y -= 36;
    for (const line of lines) {
      if (y - 12 < margin) {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
        drawPageHeading();
        drawText(
          page,
          `Ticket #${ticket.ticketNumber} - continuacion`,
          margin,
          y,
          bold,
          9,
        );
        y -= 16;
      }
      drawText(page, line, margin + 7, y, regular, 8.5);
      y -= 12;
    }
    page.drawLine({
      start: { x: margin, y: y + 3 },
      end: { x: pageWidth - margin, y: y + 3 },
      thickness: 0.4,
      color: rgb(0.85, 0.87, 0.88),
    });
    y -= 7;
  }

  for (const [index, pageItem] of pdf.getPages().entries()) {
    drawText(pageItem, `Pagina ${index + 1} de ${pdf.getPageCount()}`, pageWidth - margin - 80, 22, regular, 8, rgb(0.4, 0.43, 0.45));
  }
  const bytes = await pdf.save();
  const dateSlug = raceDay.date.toISOString().slice(0, 10);
  const venueSlug = raceDay.venue.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="cuadros-${venueSlug}-${dateSlug}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
