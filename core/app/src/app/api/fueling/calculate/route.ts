import { NextResponse } from "next/server";
import {
  parseFuelingCoreInput,
  runFuelingCore
} from "@/lib/fueling/coreApi";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const input = parseFuelingCoreInput(body);

  if (!input.ok) {
    return NextResponse.json({ ok: false, error: input.error }, { status: 400 });
  }

  try {
    const result = await runFuelingCore(input.value, request);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fueling calculation failed";
    console.error("[fueling-calculate]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
