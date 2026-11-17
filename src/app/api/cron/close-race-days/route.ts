import { NextResponse, type NextRequest } from "next/server";
import { closeDueRaceDays } from "@/lib/close-race-days";

export async function GET(request: NextRequest) {
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
  const closedCount = await closeDueRaceDays();
  return NextResponse.json({ closedCount });
}
