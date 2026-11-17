import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserFromToken, SESSION_COOKIE } from "@/lib/auth";
import { downloadPaymentProof } from "@/lib/payment-storage";
import { recordOperationalAlert } from "@/lib/operational-alerts";
import { prisma } from "@/lib/prisma";

const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function failureResponse(
  status: number,
  message: string,
  requestId: string,
) {
  return NextResponse.json(
    { error: message, requestId },
    {
      status,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  const requestId = randomUUID();
  let phase = "session";
  try {
    const user = await getCurrentUserFromToken(
      request.cookies.get(SESSION_COOKIE)?.value,
    );
    if (!user) {
      return failureResponse(
        401,
        "Tu sesión no está activa. Inicia sesión nuevamente.",
        requestId,
      );
    }

    phase = "ticket lookup";
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
      return failureResponse(
        404,
        "El comprobante no está disponible para esta cuenta.",
        requestId,
      );
    }

    phase = "storage download";
    const image = await downloadPaymentProof(
      proof.storageBucket,
      proof.storageKey,
    );
    const contentType = proof.contentType ?? image.type;
    if (!allowedContentTypes.has(contentType)) {
      return failureResponse(
        415,
        "El comprobante no tiene un formato de imagen permitido.",
        requestId,
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
    if (phase === "storage download" || phase === "ticket lookup") {
      await recordOperationalAlert({
        source:
          phase === "storage download"
            ? "payment-proof-storage"
            : "payment-proof-lookup",
        fingerprint: `payment-proof:${phase}`,
        message:
          phase === "storage download"
            ? "Falló la descarga de un comprobante privado desde Supabase Storage."
            : "Falló la consulta del registro de acceso a un comprobante.",
        error,
      });
    }
    const errorName = error instanceof Error ? error.name : "UnknownError";
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Could not load payment proof", {
      requestId,
      phase,
      errorName,
      errorMessage: errorMessage.replace(
        /(?:postgres(?:ql)?:\/\/)[^\s"']+/gi,
        "[redacted database URL]",
      ),
    });
    return failureResponse(
      phase === "storage download" ? 503 : 500,
      phase === "storage download"
        ? "Supabase no pudo leer el archivo del comprobante."
        : "Ocurrió un error interno al validar la sesión o consultar el comprobante.",
      requestId,
    );
  }
}
