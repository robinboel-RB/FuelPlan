import { NextResponse } from "next/server";
import { getPushSubscriptionStore } from "@/lib/push/subscriptions";
import { readPushRequestAuth } from "@/lib/push/auth";
import { checkPushRateLimit } from "@/lib/push/rateLimit";
import { recordPushTelemetry } from "@/lib/push/telemetry";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = readPushRequestAuth(request);

  if (!auth) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkPushRateLimit(
    `unsubscribe:${auth.installId}:${auth.deviceId}`,
    12,
    60
  );

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
  await store.removeByOwner(auth.installId, auth.deviceId);

  recordPushTelemetry("unsubscribe_success", {
    installId: auth.installId,
    deviceId: auth.deviceId
  });

  return NextResponse.json({ ok: true });
}
