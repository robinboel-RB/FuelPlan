import type { PushSubscription } from "web-push";

export interface StoredPushSubscription {
  endpoint: string;
  subscription: PushSubscription;
  createdAt: number;
  updatedAt: number;
}

declare global {
  // MVP-only store. On Vercel serverless this is not persistent or guaranteed
  // across cold starts/instances. Replace with Redis, Vercel KV, Supabase, or DB.
  // eslint-disable-next-line no-var
  var __fuelPlanPushSubscriptions:
    | Map<string, StoredPushSubscription>
    | undefined;
}

function getStore() {
  if (!globalThis.__fuelPlanPushSubscriptions) {
    globalThis.__fuelPlanPushSubscriptions = new Map();
  }

  return globalThis.__fuelPlanPushSubscriptions;
}

export function parsePushSubscription(value: unknown): PushSubscription | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<PushSubscription>;

  if (
    typeof candidate.endpoint !== "string" ||
    !candidate.endpoint ||
    !candidate.keys ||
    typeof candidate.keys.p256dh !== "string" ||
    typeof candidate.keys.auth !== "string"
  ) {
    return null;
  }

  return {
    endpoint: candidate.endpoint,
    expirationTime:
      typeof candidate.expirationTime === "number" ? candidate.expirationTime : null,
    keys: {
      p256dh: candidate.keys.p256dh,
      auth: candidate.keys.auth
    }
  };
}

export function saveSubscription(subscription: PushSubscription) {
  const now = Date.now();
  const store = getStore();
  const existing = store.get(subscription.endpoint);

  store.set(subscription.endpoint, {
    endpoint: subscription.endpoint,
    subscription,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  });
}

export function removeSubscription(endpoint: string) {
  return getStore().delete(endpoint);
}

export function getSubscriptions() {
  return [...getStore().values()];
}

export function getSubscriptionCount() {
  return getStore().size;
}
