import { NextResponse } from "next/server";
import { parsePushSubscription } from "@/lib/push/subscriptions";
import {
  createTestPushPayload,
  sendPushToAll,
  sendPushToSubscription
} from "@/lib/push/webpush";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const subscription = parsePushSubscription(
    body && typeof body === "object" && "subscription" in body
      ? (body as { subscription?: unknown }).subscription
      : body
  );

  try {
    const summary = subscription
      ? await sendPushToSubscription(subscription, createTestPushPayload())
      : await sendPushToAll(createTestPushPayload());

    return NextResponse.json({ ok: true, ...summary });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Push send failed" },
      { status: 500 }
    );
  }
}
