import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from "next/server";
import { triggerServerSessionEvent } from "@/lib/session/sessionActions";

export const runtime = "nodejs";

async function handler(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    sessionId?: unknown;
    eventId?: unknown;
  } | null;

  if (typeof body?.sessionId !== "string" || typeof body.eventId !== "string") {
    return NextResponse.json(
      { ok: false, error: "sessionId and eventId are required" },
      { status: 400 }
    );
  }

  const result = await triggerServerSessionEvent({
    sessionId: body.sessionId,
    eventId: body.eventId
  });

  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: Request) {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (!currentSigningKey || !nextSigningKey) {
    return NextResponse.json(
      { ok: false, error: "Missing QStash signing keys" },
      { status: 503 }
    );
  }

  return verifySignatureAppRouter(handler, {
    currentSigningKey,
    nextSigningKey
  })(request);
}
