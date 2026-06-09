import { Client } from "@upstash/qstash";
import type { ServerSessionEvent } from "@/lib/session/sessionStore";

export interface QStashReadiness {
  ok: boolean;
  missing: string[];
}

let client: Client | null = null;

export function getQStashClient() {
  if (!client) {
    const token = process.env.QSTASH_TOKEN;

    if (!token) {
      throw new Error("Missing QSTASH_TOKEN");
    }

    client = new Client({ token });
  }

  return client;
}

export function getQStashReadiness(): QStashReadiness {
  const missing = [
    ["QSTASH_TOKEN", process.env.QSTASH_TOKEN],
    ["QSTASH_CURRENT_SIGNING_KEY", process.env.QSTASH_CURRENT_SIGNING_KEY],
    ["QSTASH_NEXT_SIGNING_KEY", process.env.QSTASH_NEXT_SIGNING_KEY],
    ["NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL]
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key)
    .filter((key): key is string => Boolean(key));

  return { ok: missing.length === 0, missing };
}

export function assertQStashReady() {
  const readiness = getQStashReadiness();

  if (!readiness.ok) {
    throw new Error(`Missing Level 2 scheduler configuration: ${readiness.missing.join(", ")}`);
  }
}

export function getQStashTriggerUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");

  if (!appUrl) {
    throw new Error("Missing NEXT_PUBLIC_APP_URL");
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
  const response = await getQStashClient().publishJSON({
    url: getQStashTriggerUrl(),
    body: {
      sessionId,
      eventId: event.eventId
    },
    delay: Math.max(0, event.delaySeconds),
    retries: 3
  });

  return "messageId" in response ? response.messageId : "";
}

export async function cancelQStashMessage(messageId: string) {
  await getQStashClient().messages.cancel(messageId);
}

export function setQStashClientForTesting(nextClient: Client | null) {
  client = nextClient;
}
