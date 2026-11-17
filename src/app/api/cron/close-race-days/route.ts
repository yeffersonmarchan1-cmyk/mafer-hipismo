import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { closeDueRaceDays } from "@/lib/close-race-days";

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "El cierre programado no está configurado." },
      { status: 503 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const closedCount = await closeDueRaceDays();
    return NextResponse.json({ closedCount });
  } catch {
    return NextResponse.json(
      { error: "No se pudo completar el cierre programado.", requestId },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
