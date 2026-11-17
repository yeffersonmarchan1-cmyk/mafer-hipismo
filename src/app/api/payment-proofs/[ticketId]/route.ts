import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserFromToken, SESSION_COOKIE } from "@/lib/auth";
import { downloadPaymentProof } from "@/lib/payment-storage";
import { prisma } from "@/lib/prisma";

const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  const user = await getCurrentUserFromToken(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { ticketId } = await params;
  const proof = await prisma.paymentProof.findUnique({
    where: { ticketId },
    select: {
      storageBucket: true,
      storageKey: true,
      contentType: true,
      ticket: { select: { userId: true } },
    },
  });
  if (
    !proof ||
    !proof.storageBucket ||
    !proof.storageKey ||
    (user.role !== "ADMIN" && proof.ticket.userId !== user.id)
  ) {
    return NextResponse.json({ error: "Comprobante no disponible." }, { status: 404 });
  }

  try {
    const image = await downloadPaymentProof(
      proof.storageBucket,
      proof.storageKey,
    );
    const contentType = proof.contentType ?? image.type;
    if (!allowedContentTypes.has(contentType)) {
      return NextResponse.json(
        { error: "El comprobante no tiene un formato de imagen permitido." },
        { status: 415 },
      );
    }
    return new NextResponse(image, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": contentType,
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Could not load payment proof:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo abrir el comprobante.",
      },
      { status: 503 },
    );
  }
}
