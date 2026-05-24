import { NextResponse } from "next/server";
import {
  getPushSubscriptionStorageMode,
  getPushSubscriptionStore
} from "@/lib/push/subscriptions";
import { assertOwnsSubscription, readPushRequestAuth } from "@/lib/push/auth";
import { checkPushRateLimit } from "@/lib/push/rateLimit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = readPushRequestAuth(request);

  if (!auth) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkPushRateLimit(
    `status:${auth.installId}:${auth.deviceId}`,
    30,
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
  const record = await store.getByOwner(auth.installId, auth.deviceId);

  if (!record) {
    return NextResponse.json({
      ok: true,
      storageMode: getPushSubscriptionStorageMode(),
      hasServerSubscription: false
    });
  }

  if (!assertOwnsSubscription(record.secretHash, auth.installSecretHash)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    storageMode: getPushSubscriptionStorageMode(),
    hasServerSubscription: true,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastSuccessAt: record.lastSuccessAt,
    lastFailureAt: record.lastFailureAt,
    failureCount: record.failureCount
  });
}
