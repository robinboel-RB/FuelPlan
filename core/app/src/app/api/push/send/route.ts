import { NextResponse } from "next/server";
import { getSubscriptionCount } from "@/lib/push/subscriptions";
import { sendPushToAll, validatePushPayload } from "@/lib/push/webpush";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const payload = validatePushPayload(body);

  if (!payload) {
    return NextResponse.json(
      { ok: false, error: "Invalid push payload" },
      { status: 400 }
    );
  }

  if (getSubscriptionCount() === 0) {
    return NextResponse.json({
      ok: false,
      error: "No active subscription",
      total: 0,
      successful: 0,
      failed: 0,
      removed: 0
    });
  }

  try {
    const summary = await sendPushToAll(payload);
    return NextResponse.json({ ok: true, ...summary });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Push send failed" },
      { status: 500 }
    );
  }
}
