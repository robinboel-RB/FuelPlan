import { assertOwnsSubscription, type PushRequestAuth } from "@/lib/push/auth";
import type {
  PushSubscriptionStore,
  StoredPushSubscription
} from "@/lib/push/subscriptions";
import { parsePushSubscription } from "@/lib/push/subscriptions";

export async function resolveTargetSubscriptions({
  auth,
  body,
  isAdmin,
  scope,
  store
}: {
  auth: PushRequestAuth | null;
  body?: unknown;
  isAdmin: boolean;
  scope: unknown;
  store: PushSubscriptionStore;
}): Promise<StoredPushSubscription[]> {
  if (scope === "all" && isAdmin) {
    return store.listActive(100);
  }

  if (!auth) {
    return [];
  }

  const record = await store.getByOwner(auth.installId, auth.deviceId);

  if (record && assertOwnsSubscription(record.secretHash, auth.installSecretHash)) {
    return [record];
  }

  if (record) {
    return [];
  }

  const subscription = parsePushSubscription(
    body && typeof body === "object" && "subscription" in body
      ? (body as { subscription?: unknown }).subscription
      : null
  );

  if (!subscription) {
    return [];
  }

  const stored = await store.upsert({
    installId: auth.installId,
    deviceId: auth.deviceId,
    secretHash: auth.installSecretHash,
    subscription
  });

  return [stored];
}
