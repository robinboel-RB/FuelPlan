import { NextResponse } from "next/server";
import { isAdminRequest, readPushRequestAuth } from "@/lib/push/auth";
import { sendPushRecordsWithStore } from "@/lib/push/delivery";
import { checkPushRateLimit } from "@/lib/push/rateLimit";
import { resolveTargetSubscriptions } from "@/lib/push/routeHelpers";
import { getPushSubscriptionStore } from "@/lib/push/subscriptions";
import { createTestPushPayload } from "@/lib/push/webpush";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = readPushRequestAuth(request);
  const isAdmin = isAdminRequest(request);

  if (!auth && !isAdmin) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const scope =
    body && typeof body === "object" && "scope" in body
      ? (body as { scope?: unknown }).scope
      : "own";
  const store = getPushSubscriptionStore();
  const rateLimitKey = auth
    ? `test:${auth.installId}:${auth.deviceId}`
    : "test:admin";
  const rateLimit = await checkPushRateLimit(rateLimitKey, 10, 60);

  if (!rateLimit.ok) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) }
      }
    );
  }

  const records = await resolveTargetSubscriptions({
    auth,
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
    const summary = await sendPushRecordsWithStore(
      records,
      createTestPushPayload(),
      store
    );

    return NextResponse.json({ ok: true, ...summary });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Push send failed" },
      { status: 500 }
    );
  }
}
