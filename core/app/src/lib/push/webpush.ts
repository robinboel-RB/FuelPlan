import webpush from "web-push";
import type { PushSubscription } from "web-push";
import {
  getSubscriptions,
  removeSubscription,
  type StoredPushSubscription
} from "@/lib/push/subscriptions";

export interface FuelPlanPushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  requireInteraction?: boolean;
}

export interface PushSendSummary {
  total: number;
  successful: number;
  failed: number;
  removed: number;
  errors: Array<{ endpoint: string; statusCode?: number }>;
}

const DEFAULT_PUSH_URL = "/live-session";
const DEFAULT_PUSH_ICON = "/icons/fuelplan-icon.svg";
const DEFAULT_PUSH_BADGE = "/icons/fuelplan-badge.svg";

let isConfigured = false;

export function validatePushPayload(value: unknown): FuelPlanPushPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<FuelPlanPushPayload>;
  const title = sanitizeText(candidate.title, 80);
  const body = sanitizeText(candidate.body, 160);

  if (!title || !body) {
    return null;
  }

  return {
    title,
    body,
    url: sanitizeUrl(candidate.url),
    tag: sanitizeText(candidate.tag, 64) || "fuelplan-live",
    icon: sanitizeUrl(candidate.icon) || DEFAULT_PUSH_ICON,
    badge: sanitizeUrl(candidate.badge) || DEFAULT_PUSH_BADGE,
    requireInteraction: Boolean(candidate.requireInteraction)
  };
}

export function createTestPushPayload(): FuelPlanPushPayload {
  return {
    title: "FuelPlan test",
    body: "Als je dit op je horloge ziet, werkt de MVP-route.",
    url: DEFAULT_PUSH_URL,
    tag: "fuelplan-test",
    icon: DEFAULT_PUSH_ICON,
    badge: DEFAULT_PUSH_BADGE,
    requireInteraction: false
  };
}

export async function sendPushToAll(payload: FuelPlanPushPayload) {
  return sendPushToStoredSubscriptions(getSubscriptions(), payload);
}

export async function sendPushToSubscription(
  subscription: PushSubscription,
  payload: FuelPlanPushPayload
) {
  return sendPushToStoredSubscriptions(
    [
      {
        endpoint: subscription.endpoint,
        subscription,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ],
    payload
  );
}

async function sendPushToStoredSubscriptions(
  subscriptions: StoredPushSubscription[],
  payload: FuelPlanPushPayload
): Promise<PushSendSummary> {
  configureWebPush();

  const summary: PushSendSummary = {
    total: subscriptions.length,
    successful: 0,
    failed: 0,
    removed: 0,
    errors: []
  };

  await Promise.all(
    subscriptions.map(async (stored) => {
      try {
        await webpush.sendNotification(
          stored.subscription,
          JSON.stringify(normalizePayload(payload)),
          { TTL: 60 * 30, urgency: "high" }
        );
        summary.successful += 1;
      } catch (error) {
        const statusCode = readStatusCode(error);

        summary.failed += 1;
        summary.errors.push({ endpoint: stored.endpoint, statusCode });

        if (statusCode === 404 || statusCode === 410) {
          removeSubscription(stored.endpoint);
          summary.removed += 1;
        }
      }
    })
  );

  return summary;
}

function configureWebPush() {
  if (isConfigured) {
    return;
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:hello@example.com";

  if (!publicKey || !privateKey) {
    throw new Error("Missing VAPID keys");
  }

  // Configure only on the server. Never expose VAPID_PRIVATE_KEY to the client.
  webpush.setVapidDetails(subject, publicKey, privateKey);
  isConfigured = true;
}

function normalizePayload(payload: FuelPlanPushPayload): Required<FuelPlanPushPayload> {
  return {
    title: payload.title,
    body: payload.body,
    url: payload.url || DEFAULT_PUSH_URL,
    tag: payload.tag || "fuelplan-live",
    icon: payload.icon || DEFAULT_PUSH_ICON,
    badge: payload.badge || DEFAULT_PUSH_BADGE,
    requireInteraction: Boolean(payload.requireInteraction)
  };
}

function sanitizeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function sanitizeUrl(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const url = value.trim();

  if (!url || (!url.startsWith("/") && !url.startsWith("https://"))) {
    return undefined;
  }

  return url.slice(0, 240);
}

function readStatusCode(error: unknown) {
  if (error && typeof error === "object" && "statusCode" in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    return typeof statusCode === "number" ? statusCode : undefined;
  }

  return undefined;
}
