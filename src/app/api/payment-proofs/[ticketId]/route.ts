import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createPaymentProofUrl } from "@/lib/payment-storage";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { ticketId } = await params;
  const proof = await prisma.paymentProof.findUnique({
    where: { ticketId },
    select: {
      storageBucket: true,
      storageKey: true,
      ticket: { select: { userId: true } },
    },
  });
  if (!proof || (user.role !== "ADMIN" && proof.ticket.userId !== user.id)) {
    return NextResponse.json({ error: "Comprobante no disponible." }, { status: 404 });
  }

  try {
    const signedUrl = await createPaymentProofUrl(
      proof.storageBucket,
      proof.storageKey,
    );
    return NextResponse.redirect(signedUrl, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Could not sign payment proof URL:", error);
    return NextResponse.json(
      { error: "No se pudo abrir el comprobante." },
      { status: 503 },
    );
  }
}
