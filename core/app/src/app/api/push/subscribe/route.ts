import { NextResponse } from "next/server";
import {
  getPushSubscriptionStore,
  parsePushSubscription,
} from "@/lib/push/subscriptions";
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
    `subscribe:${auth.installId}:${auth.deviceId}`,
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

  const body = await request.json().catch(() => null);
  const subscription = parsePushSubscription(
    body && typeof body === "object" && "subscription" in body
      ? (body as { subscription?: unknown }).subscription
      : body
  );

  if (!subscription) {
    recordPushTelemetry("subscribe_failure", {
      installId: auth.installId,
      deviceId: auth.deviceId
    });

    return NextResponse.json(
      { ok: false, error: "Invalid push subscription" },
      { status: 400 }
    );
  }

  const store = getPushSubscriptionStore();
  const record = await store.upsert({
    installId: auth.installId,
    deviceId: auth.deviceId,
    secretHash: auth.installSecretHash,
    subscription
  });

  recordPushTelemetry("subscribe_success", {
    installId: auth.installId,
    deviceId: auth.deviceId
  });

  return NextResponse.json({
    ok: true,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  });
}
