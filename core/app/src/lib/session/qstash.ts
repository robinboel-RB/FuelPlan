import { Client } from "@upstash/qstash";
import type { ServerSessionEvent } from "@/lib/session/sessionStore";

export interface QStashReadiness {
  ok: boolean;
  missing: string[];
  triggerUrl?: string;
  nextPublicAppUrl?: string;
  hasQStashUrl: boolean;
  hasQStashToken: boolean;
  hasCurrentSigningKey: boolean;
  hasNextSigningKey: boolean;
}

let client: Client | null = null;

export function getQStashClient() {
  if (!client) {
    const token = process.env.QSTASH_TOKEN;

    if (!token) {
      throw new Error("Missing QSTASH_TOKEN");
    }

    const baseUrl = process.env.QSTASH_URL;

    if (!baseUrl) {
      throw new Error("Missing QSTASH_URL");
    }

    client = new Client({ token, baseUrl });
  }

  return client;
}

export function getQStashReadiness(): QStashReadiness {
  const triggerUrl = getQStashTriggerUrlOrNull();
  const missing = [
    ["QSTASH_URL", process.env.QSTASH_URL],
    ["QSTASH_TOKEN", process.env.QSTASH_TOKEN],
    ["QSTASH_CURRENT_SIGNING_KEY", process.env.QSTASH_CURRENT_SIGNING_KEY],
    ["QSTASH_NEXT_SIGNING_KEY", process.env.QSTASH_NEXT_SIGNING_KEY],
    ["NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL]
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key)
    .filter((key): key is string => Boolean(key));

  return {
    ok: missing.length === 0,
    missing,
    triggerUrl: triggerUrl ?? undefined,
    nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
    hasQStashUrl: Boolean(process.env.QSTASH_URL),
    hasQStashToken: Boolean(process.env.QSTASH_TOKEN),
    hasCurrentSigningKey: Boolean(process.env.QSTASH_CURRENT_SIGNING_KEY),
    hasNextSigningKey: Boolean(process.env.QSTASH_NEXT_SIGNING_KEY)
  };
}

export function assertQStashReady() {
  const readiness = getQStashReadiness();

  if (!readiness.ok) {
    throw new Error(`Missing Level 2 scheduler configuration: ${readiness.missing.join(", ")}`);
  }
}

export function getQStashTriggerUrl() {
  const triggerUrl = getQStashTriggerUrlOrNull();

  if (!triggerUrl) {
    throw new Error("Missing NEXT_PUBLIC_APP_URL");
  }

  return triggerUrl;
}

function getQStashTriggerUrlOrNull() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");

  if (!appUrl) {
    return null;
  }

  return `${appUrl}/api/session/trigger`;
}

export async function scheduleSessionEvent({
  event,
  sessionId
}: {
  sessionId: string;
  event: ServerSessionEvent;
}) {
  const targetUrl = getQStashTriggerUrl();
  const delay = Math.max(0, event.delaySeconds);
  const diagnostics = {
    targetUrl,
    delay,
    eventId: event.eventId,
    sessionId,
    hasQStashUrl: Boolean(process.env.QSTASH_URL),
    hasQStashToken: Boolean(process.env.QSTASH_TOKEN)
  };

  console.info("FuelPlan QStash schedule request", diagnostics);

  try {
    const response = await getQStashClient().publishJSON({
      url: targetUrl,
      headers: getQStashDeliveryHeaders(),
      body: {
        sessionId,
        eventId: event.eventId
      },
      delay,
      retries: 3
    });
    const messageId = readQStashMessageId(response);

    if (!messageId) {
      throw new Error("QStash publishJSON returned no messageId");
    }

    console.info("FuelPlan QStash schedule success", {
      ...diagnostics,
      messageId
    });

    return messageId;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "QStash publishJSON failed";

    console.error("FuelPlan QStash schedule failed", {
      ...diagnostics,
      error: message
    });

    throw new Error(`QStash scheduling failed for ${event.eventId}: ${message}`);
  }
}

function readQStashMessageId(response: unknown) {
  if (!response || typeof response !== "object") {
    return "";
  }

  const candidate = response as { messageId?: unknown };
  return typeof candidate.messageId === "string" ? candidate.messageId.trim() : "";
}

export function getQStashDeliveryHeaders(): Record<string, string> | undefined {
  const protectionBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

  if (!protectionBypass) {
    return undefined;
  }

  return {
    "x-vercel-protection-bypass": protectionBypass
  };
}

export async function cancelQStashMessage(messageId: string) {
  await getQStashClient().messages.cancel(messageId);
}

export function setQStashClientForTesting(nextClient: Client | null) {
  client = nextClient;
}
