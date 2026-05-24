import { NextResponse } from "next/server";
import { isAdminRequest, readPushRequestAuth } from "@/lib/push/auth";
import { sendPushRecordsWithStore } from "@/lib/push/delivery";
import { resolvePushEventPayload } from "@/lib/push/events";
import { checkPushRateLimit } from "@/lib/push/rateLimit";
import { resolveTargetSubscriptions } from "@/lib/push/routeHelpers";
import { getPushSubscriptionStore } from "@/lib/push/subscriptions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = readPushRequestAuth(request);
  const isAdmin = isAdminRequest(request);

  if (!auth && !isAdmin) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const event = resolvePushEventPayload(
    body && typeof body === "object" && "eventType" in body
      ? (body as { eventType?: unknown }).eventType
      : null
  );

  if (!event) {
    return NextResponse.json(
      { ok: false, error: "Invalid push event" },
      { status: 400 }
    );
  }

  const rateLimitKey = auth
    ? `send:${auth.installId}:${auth.deviceId}`
    : "send:admin";
  const rateLimit = await checkPushRateLimit(rateLimitKey, 30, 60);

  if (!rateLimit.ok) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) }
      }
    );
  }

  const store = getPushSubscriptionStore();
  const scope =
    body && typeof body === "object" && "scope" in body
      ? (body as { scope?: unknown }).scope
      : "own";
  const records = await resolveTargetSubscriptions({
    auth,
    body,
    isAdmin,
    scope,
    store
  });

  if (records.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "No active subscription",
        total: 0,
        successful: 0,
        failed: 0,
        removed: 0
      },
      { status: 404 }
    );
  }

  try {
    const summary = await sendPushRecordsWithStore(records, event.payload, store);
    return NextResponse.json({ ok: true, eventType: event.eventType, ...summary });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Push send failed" },
      { status: 500 }
    );
  }
}
