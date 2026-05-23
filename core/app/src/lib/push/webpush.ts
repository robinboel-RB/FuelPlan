import webpush from "web-push";
import type { PushSubscription } from "web-push";
import type { StoredPushSubscription } from "@/lib/push/subscriptions";

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
const DEFAULT_PUSH_ICON = "/icons/fuelplan-icon-192.png";
const DEFAULT_PUSH_BADGE = "/icons/fuelplan-badge.svg";
const PUSH_TTL_SECONDS = 60 * 30;

let isConfigured = false;

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

export async function sendPushToStoredSubscription(
  stored: StoredPushSubscription,
  payload: FuelPlanPushPayload
) {
  return sendPushToStoredSubscriptions([stored], payload);
}

export async function sendPushToSubscription(
  subscription: PushSubscription,
  payload: FuelPlanPushPayload
) {
  const now = Date.now();

  return sendPushToStoredSubscriptions(
    [
      {
        key: "direct",
        installId: "direct",
        deviceId: "direct",
        userId: "anonymous",
        secretHash: "",
        endpoint: subscription.endpoint,
        endpointHash: "",
        subscription,
        status: "active",
        createdAt: now,
        updatedAt: now,
        failureCount: 0
      }
    ],
    payload
  );
}

export async function sendPushToStoredSubscriptions(
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
          { TTL: PUSH_TTL_SECONDS, urgency: "high" }
        );
        summary.successful += 1;
      } catch (error) {
        const statusCode = readStatusCode(error);

        summary.failed += 1;
        summary.errors.push({ endpoint: stored.endpoint, statusCode });

        if (statusCode === 404 || statusCode === 410) {
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
    title: sanitizeText(payload.title, 80) || "Fuel now",
    body: sanitizeText(payload.body, 160) || "Volgende actie volgt straks",
    url: sanitizeUrl(payload.url) || DEFAULT_PUSH_URL,
    tag: sanitizeText(payload.tag, 64) || "fuelplan-live",
    icon: sanitizeUrl(payload.icon) || DEFAULT_PUSH_ICON,
    badge: sanitizeUrl(payload.badge) || DEFAULT_PUSH_BADGE,
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

export function isExpiredPushStatus(statusCode: number | undefined) {
  return statusCode === 404 || statusCode === 410;
}

function readStatusCode(error: unknown) {
  if (error && typeof error === "object" && "statusCode" in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    return typeof statusCode === "number" ? statusCode : undefined;
  }

  return undefined;
}
