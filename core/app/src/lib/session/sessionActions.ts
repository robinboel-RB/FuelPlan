import { assertOwnsSubscription, readPushRequestAuth } from "@/lib/push/auth";
import { sendPushRecordsWithStore } from "@/lib/push/delivery";
import {
  getPushSubscriptionStorageMode,
  getPushSubscriptionStore
} from "@/lib/push/subscriptions";
import type { FuelPlanPushPayload } from "@/lib/push/webpush";
import {
  assertPersistentSessionStorage,
  createServerSessionRecord,
  getServerSessionStorageMode,
  getServerSessionStore,
  isProductionRuntime,
  type ServerFuelingSession,
  type ServerSessionEvent,
  type SessionTimelineInputEvent,
  summarizeSession
} from "@/lib/session/sessionStore";
import {
  assertQStashReady,
  cancelQStashMessage,
  getQStashReadiness,
  getQStashTriggerUrl,
  scheduleSessionEvent
} from "@/lib/session/qstash";

export interface ActionResult<T> {
  status: number;
  body: T;
}

export interface SessionStartResponse {
  ok: boolean;
  error?: string;
  sessionId?: string;
  storageMode?: string;
  scheduledEventCount?: number;
  failedScheduleCount?: number;
  scheduleErrors?: string[];
  events?: ServerSessionEvent[];
}

export interface SessionStatusResponse {
  ok: boolean;
  error?: string;
  storageMode?: string;
  pushStorageMode?: string;
  readiness?: ReturnType<typeof getLevel2Readiness>;
  session?: ServerFuelingSession;
  scheduledCount?: number;
  sentCount?: number;
  failedCount?: number;
  nextEvent?: ServerSessionEvent | null;
}

export async function startServerSession(
  request: Request
): Promise<ActionResult<SessionStartResponse>> {
  const auth = readPushRequestAuth(request);

  if (!auth) {
    return jsonResult(401, { ok: false, error: "Unauthorized" });
  }

  const readiness = getLevel2Readiness();
  if (!readiness.ok) {
    return jsonResult(503, {
      ok: false,
      error: `Level 2 is not ready: ${readiness.missing.join(", ")}`,
      storageMode: getServerSessionStorageMode()
    });
  }

  try {
    assertPersistentSessionStorage();
    assertQStashReady();
  } catch (error) {
    return jsonResult(503, {
      ok: false,
      error: error instanceof Error ? error.message : "Level 2 is not ready",
      storageMode: getServerSessionStorageMode()
    });
  }

  const pushStore = getPushSubscriptionStore();
  const subscription = await pushStore.getByOwner(auth.installId, auth.deviceId);

  if (!subscription) {
    return jsonResult(404, {
      ok: false,
      error: "No active subscription for this device",
      storageMode: getServerSessionStorageMode()
    });
  }

  if (!assertOwnsSubscription(subscription.secretHash, auth.installSecretHash)) {
    return jsonResult(403, { ok: false, error: "Forbidden" });
  }

  if (subscription.status !== "active") {
    return jsonResult(409, {
      ok: false,
      error: `Push subscription is ${subscription.status}`,
      storageMode: getServerSessionStorageMode()
    });
  }

  const body = await request.json().catch(() => ({}));
  const timeline = parseTimeline(body);
  const session = createServerSessionRecord({
    installId: auth.installId,
    deviceId: auth.deviceId,
    timeline
  });
  const store = getServerSessionStore();
  await store.saveSession(session);

  const scheduledEvents: ServerSessionEvent[] = [];

  for (const event of session.events) {
    try {
      const qstashMessageId = await scheduleSessionEvent({
        sessionId: session.sessionId,
        event
      });
      scheduledEvents.push({
        ...event,
        qstashMessageId,
        status: "scheduled",
        updatedAt: Date.now()
      });
    } catch (error) {
      scheduledEvents.push({
        ...event,
        status: "failed",
        attempts: event.attempts + 1,
        lastError: error instanceof Error ? error.message : "QStash scheduling failed",
        updatedAt: Date.now()
      });
    }
  }

  const scheduledEventCount = scheduledEvents.filter(
    (event) => event.status === "scheduled"
  ).length;
  const failedScheduleCount = scheduledEvents.filter(
    (event) => event.status === "failed"
  ).length;
  const scheduleErrors = scheduledEvents
    .filter((event) => event.status === "failed" && event.lastError)
    .map((event) => `${event.eventId}: ${event.lastError}`);
  const allSchedulesFailed = session.events.length > 0 && scheduledEventCount === 0;
  const saved = await store.saveSession({
    ...session,
    status: allSchedulesFailed ? "stopped" : "active",
    events: scheduledEvents,
    updatedAt: Date.now()
  });

  if (allSchedulesFailed) {
    return jsonResult(502, {
      ok: false,
      error: "QStash scheduling failed for all session events",
      sessionId: saved.sessionId,
      storageMode: getServerSessionStorageMode(),
      scheduledEventCount,
      failedScheduleCount,
      scheduleErrors,
      events: saved.events
    });
  }

  return jsonResult(200, {
    ok: true,
    sessionId: saved.sessionId,
    storageMode: getServerSessionStorageMode(),
    scheduledEventCount,
    failedScheduleCount,
    scheduleErrors,
    events: saved.events
  });
}

export async function triggerServerSessionEvent(input: {
  sessionId: string;
  eventId: string;
}): Promise<ActionResult<Record<string, unknown>>> {
  const store = getServerSessionStore();
  const session = await store.getSession(input.sessionId);

  if (!session) {
    return jsonResult(404, { ok: false, error: "Session not found" });
  }

  if (session.status !== "active") {
    return jsonResult(200, {
      ok: true,
      result: "skipped",
      reason: `Session is ${session.status}`
    });
  }

  const event = session.events.find((candidate) => candidate.eventId === input.eventId);

  if (!event) {
    return jsonResult(404, { ok: false, error: "Event not found" });
  }

  if (event.status === "sent" || event.status === "skipped" || event.status === "cancelled") {
    return jsonResult(200, {
      ok: true,
      result: "skipped",
      reason: `Event is already ${event.status}`,
      event
    });
  }

  const pushStore = getPushSubscriptionStore();
  const subscription = await pushStore.getByOwner(session.installId, session.deviceId);

  if (!subscription || subscription.status !== "active") {
    const updated = await markEventFailed(
      session.sessionId,
      event.eventId,
      "No active subscription"
    );
    return jsonResult(404, {
      ok: false,
      error: "No active subscription",
      event: updated
    });
  }

  const payload = createPushPayload(event);
  const summary = await sendPushRecordsWithStore([subscription], payload, pushStore);

  if (summary.successful > 0) {
    const sentEvent = await markEventSent(session.sessionId, event.eventId);
    await finishSessionIfComplete(session.sessionId);
    return jsonResult(200, {
      ok: true,
      result: "sent",
      event: sentEvent,
      summary
    });
  }

  const updated = await markEventFailed(
    session.sessionId,
    event.eventId,
    summary.errors[0]?.statusCode
      ? `Web Push failed with ${summary.errors[0].statusCode}`
      : "Web Push failed"
  );

  return jsonResult(500, {
    ok: false,
    error: "Web Push failed",
    event: updated,
    summary
  });
}

export async function stopServerSession(
  request: Request
): Promise<ActionResult<unknown>> {
  const auth = readPushRequestAuth(request);

  if (!auth) {
    return jsonResult(401, { ok: false, error: "Unauthorized" });
  }

  const body = (await request.json().catch(() => null)) as { sessionId?: unknown } | null;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  const owner = await loadOwnedSession(sessionId, auth);

  if (!owner.ok) {
    return owner.result;
  }

  const now = Date.now();
  const cancellableMessageIds = owner.session.events
    .filter((event) => event.qstashMessageId && event.status !== "sent")
    .map((event) => event.qstashMessageId as string);

  await Promise.allSettled(
    cancellableMessageIds.map((messageId) => cancelQStashMessage(messageId))
  );

  const updated = await getServerSessionStore().updateSession(sessionId, (session) => ({
    ...session,
    status: "stopped",
    updatedAt: now,
    events: session.events.map((event) =>
      event.status === "sent"
        ? event
        : {
            ...event,
            status: event.triggerAt > now ? "cancelled" : "skipped",
            updatedAt: now
          }
    )
  }));

  return jsonResult(200, {
    ok: true,
    session: updated,
    cancelledMessages: cancellableMessageIds.length
  });
}

export async function getServerSessionStatus(
  request: Request
): Promise<ActionResult<SessionStatusResponse>> {
  const auth = readPushRequestAuth(request);

  if (!auth) {
    return jsonResult(401, { ok: false, error: "Unauthorized" });
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId") ?? "";

  if (!sessionId) {
    return jsonResult(200, {
      ok: true,
      storageMode: getServerSessionStorageMode(),
      pushStorageMode: getPushSubscriptionStorageMode(),
      readiness: await getLevel2ReadinessWithSubscription(auth)
    });
  }

  const owner = await loadOwnedSession(sessionId, auth);

  if (!owner.ok) {
    return owner.result;
  }

  const summary = summarizeSession(owner.session);
  return jsonResult(200, {
    ok: true,
    storageMode: getServerSessionStorageMode(),
    pushStorageMode: getPushSubscriptionStorageMode(),
    session: summary.session,
    scheduledCount: summary.scheduledCount,
    sentCount: summary.sentCount,
    failedCount: summary.failedCount,
    nextEvent: summary.nextEvent
  });
}

export function getQStashReadinessDebug() {
  const qstash = getQStashReadiness();

  return {
    ok: qstash.ok,
    missing: qstash.missing,
    qstashUrlPresent: qstash.hasQStashUrl,
    qstashTokenPresent: qstash.hasQStashToken,
    currentSigningKeyPresent: qstash.hasCurrentSigningKey,
    nextSigningKeyPresent: qstash.hasNextSigningKey,
    nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
    triggerUrl: qstash.triggerUrl ?? safeTriggerUrl(),
    storageMode: getServerSessionStorageMode()
  };
}

export async function runSessionWatchdog() {
  const store = getServerSessionStore();
  const sessions = await store.listActiveSessions(100);
  const now = Date.now();
  let retried = 0;
  let finished = 0;

  for (const session of sessions) {
    if (session.expiresAt <= now) {
      await store.updateSession(session.sessionId, (current) => ({
        ...current,
        status: "expired",
        updatedAt: now
      }));
      finished += 1;
      continue;
    }

    const dueEvents = session.events.filter(
      (event) =>
        event.triggerAt <= now &&
        (event.status === "scheduled" || event.status === "failed") &&
        event.attempts < 3
    );

    for (const event of dueEvents) {
      const result = await triggerServerSessionEvent({
        sessionId: session.sessionId,
        eventId: event.eventId
      });

      if (result.status < 500) {
        retried += 1;
      }
    }

    const refreshed = await store.getSession(session.sessionId);
    if (
      refreshed &&
      refreshed.status === "active" &&
      refreshed.events.every((event) =>
        ["sent", "skipped", "cancelled"].includes(event.status)
      )
    ) {
      await store.updateSession(refreshed.sessionId, (current) => ({
        ...current,
        status: "finished",
        updatedAt: now
      }));
      finished += 1;
    }
  }

  return { scanned: sessions.length, retried, finished };
}

export function getLevel2Readiness() {
  const qstash = getQStashReadiness();
  const missing = [...qstash.missing];

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    missing.push("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  }
  if (!process.env.VAPID_PRIVATE_KEY) {
    missing.push("VAPID_PRIVATE_KEY");
  }
  if (!process.env.VAPID_SUBJECT) {
    missing.push("VAPID_SUBJECT");
  }
  if (getServerSessionStorageMode() === "memory" && isProductionRuntime()) {
    missing.push("BLOB_READ_WRITE_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN");
  }

  return {
    ok: missing.length === 0,
    missing,
    qstash,
    storageMode: getServerSessionStorageMode(),
    pushStorageMode: getPushSubscriptionStorageMode()
  };
}

async function getLevel2ReadinessWithSubscription(auth: {
  installId: string;
  deviceId: string;
  installSecretHash: string;
}) {
  const readiness = getLevel2Readiness();
  const pushStore = getPushSubscriptionStore();
  const subscription = await pushStore.getByOwner(auth.installId, auth.deviceId);
  const hasActiveSubscription = Boolean(
    subscription &&
      subscription.status === "active" &&
      assertOwnsSubscription(subscription.secretHash, auth.installSecretHash)
  );

  return {
    ...readiness,
    hasActiveSubscription,
    ok: readiness.ok && hasActiveSubscription,
    missing: hasActiveSubscription
      ? readiness.missing
      : [...readiness.missing, "active PushSubscription"]
  };
}

async function loadOwnedSession(
  sessionId: string,
  auth: { installId: string; deviceId: string }
): Promise<
  | { ok: true; session: ServerFuelingSession }
  | { ok: false; result: ActionResult<SessionStatusResponse> }
> {
  if (!sessionId) {
    return {
      ok: false,
      result: jsonResult(400, { ok: false, error: "sessionId is required" })
    };
  }

  const session = await getServerSessionStore().getSession(sessionId);

  if (!session) {
    return {
      ok: false,
      result: jsonResult(404, { ok: false, error: "Session not found" })
    };
  }

  if (session.installId !== auth.installId || session.deviceId !== auth.deviceId) {
    return {
      ok: false,
      result: jsonResult(403, { ok: false, error: "Forbidden" })
    };
  }

  return { ok: true, session };
}

async function markEventSent(sessionId: string, eventId: string) {
  const now = Date.now();
  let updatedEvent: ServerSessionEvent | null = null;

  await getServerSessionStore().updateSession(sessionId, (session) => ({
    ...session,
    updatedAt: now,
    events: session.events.map((event) => {
      if (event.eventId !== eventId) {
        return event;
      }

      updatedEvent = {
        ...event,
        status: "sent",
        attempts: event.attempts + 1,
        lastError: undefined,
        sentAt: now,
        updatedAt: now
      };
      return updatedEvent;
    })
  }));

  return updatedEvent;
}

async function markEventFailed(sessionId: string, eventId: string, lastError: string) {
  const now = Date.now();
  let updatedEvent: ServerSessionEvent | null = null;

  await getServerSessionStore().updateSession(sessionId, (session) => ({
    ...session,
    updatedAt: now,
    events: session.events.map((event) => {
      if (event.eventId !== eventId) {
        return event;
      }

      updatedEvent = {
        ...event,
        status: "failed",
        attempts: event.attempts + 1,
        lastError,
        updatedAt: now
      };
      return updatedEvent;
    })
  }));

  return updatedEvent;
}

async function finishSessionIfComplete(sessionId: string) {
  const now = Date.now();
  await getServerSessionStore().updateSession(sessionId, (session) => {
    const isComplete = session.events.every((event) =>
      ["sent", "skipped", "cancelled"].includes(event.status)
    );

    return isComplete
      ? {
          ...session,
          status: "finished",
          updatedAt: now
        }
      : session;
  });
}

function createPushPayload(event: ServerSessionEvent): FuelPlanPushPayload {
  return {
    title: event.title,
    body: event.body,
    tag: event.tag,
    url: event.url,
    requireInteraction: true
  };
}

function parseTimeline(body: unknown): SessionTimelineInputEvent[] {
  if (!body || typeof body !== "object") {
    return [];
  }

  const candidate = body as {
    timeline?: unknown;
    triggers?: unknown;
  };
  const source = Array.isArray(candidate.timeline)
    ? candidate.timeline
    : Array.isArray(candidate.triggers)
      ? candidate.triggers
      : [];

  return source
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => ({
      minute: typeof item.minute === "number" ? item.minute : undefined,
      delaySeconds: typeof item.delaySeconds === "number" ? item.delaySeconds : undefined,
      eventType: typeof item.eventType === "string" ? item.eventType : "carb",
      title: typeof item.title === "string" ? item.title : "Fuel now",
      body: typeof item.body === "string" ? item.body : "Neem 30g carbs",
      tag: typeof item.tag === "string" ? item.tag : undefined,
      url: typeof item.url === "string" ? item.url : "/live-session"
    }));
}

function jsonResult<T>(status: number, body: T): ActionResult<T> {
  return { status, body };
}

function safeTriggerUrl() {
  try {
    return getQStashTriggerUrl();
  } catch {
    return "";
  }
}
