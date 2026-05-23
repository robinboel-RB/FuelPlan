import { assertOwnsSubscription, type PushRequestAuth } from "@/lib/push/auth";
import type {
  PushSubscriptionStore,
  StoredPushSubscription
} from "@/lib/push/subscriptions";

export async function resolveTargetSubscriptions({
  auth,
  isAdmin,
  scope,
  store
}: {
  auth: PushRequestAuth | null;
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

  if (!record || !assertOwnsSubscription(record.secretHash, auth.installSecretHash)) {
    return [];
  }

  return [record];
}
