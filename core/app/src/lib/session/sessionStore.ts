import { del, get, list, put } from "@vercel/blob";
import { hasUpstashConfig, upstashCommand } from "@/lib/push/upstash";

export type ServerSessionStatus = "active" | "stopped" | "finished" | "expired";
export type ServerSessionEventStatus =
  | "scheduled"
  | "sent"
  | "failed"
  | "skipped"
  | "cancelled";
export type ServerSessionStorageMode = "blob" | "upstash" | "memory";

export interface ServerSessionEvent {
  eventId: string;
  eventType: string;
  title: string;
  body: string;
  tag: string;
  url: string;
  triggerAt: number;
  delaySeconds: number;
  status: ServerSessionEventStatus;
  qstashMessageId?: string;
  attempts: number;
  lastError?: string;
  sentAt?: number;
  updatedAt: number;
}

export interface ServerFuelingSession {
  sessionId: string;
  installId: string;
  deviceId: string;
  status: ServerSessionStatus;
  startedAt: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  events: ServerSessionEvent[];
}

export interface SessionTimelineInputEvent {
  minute?: number;
  delaySeconds?: number;
  eventType?: string;
  title?: string;
  body?: string;
  tag?: string;
  url?: string;
}

export interface CreateServerSessionInput {
  installId: string;
  deviceId: string;
  timeline: SessionTimelineInputEvent[];
  now?: number;
}

export interface ServerSessionStore {
  mode: ServerSessionStorageMode;
  saveSession(session: ServerFuelingSession): Promise<ServerFuelingSession>;
  getSession(sessionId: string): Promise<ServerFuelingSession | null>;
  updateSession(
    sessionId: string,
    update: (session: ServerFuelingSession) => ServerFuelingSession
  ): Promise<ServerFuelingSession | null>;
  listActiveSessions(limit?: number): Promise<ServerFuelingSession[]>;
}

const BLOB_SESSION_PREFIX = "fuelplan/sessions/";
const UPSTASH_ACTIVE_SESSIONS_KEY = "fuelplan:sessions:active";
const DEFAULT_SESSION_EXPIRY_MS = 6 * 60 * 60 * 1000;
const MAX_TIMELINE_EVENTS = 200;

let store: ServerSessionStore | null = null;

export function getServerSessionStore() {
  if (!store) {
    store = hasBlobConfig()
      ? new BlobServerSessionStore()
      : hasUpstashConfig()
        ? new UpstashServerSessionStore()
        : new MemoryServerSessionStore();
  }

  return store;
}

export function getServerSessionStorageMode(): ServerSessionStorageMode {
  if (hasBlobConfig()) {
    return "blob";
  }

  return hasUpstashConfig() ? "upstash" : "memory";
}

export function assertPersistentSessionStorage() {
  const mode = getServerSessionStorageMode();

  if (mode === "memory" && isProductionRuntime()) {
    throw new Error(
      "Level 2 requires persistent storage. Configure BLOB_READ_WRITE_TOKEN or Upstash Redis REST credentials."
    );
  }
}

export function createServerSessionRecord({
  deviceId,
  installId,
  now = Date.now(),
  timeline
}: CreateServerSessionInput): ServerFuelingSession {
  const events = createSessionEvents(timeline, now);
  const latestTriggerAt = Math.max(now, ...events.map((event) => event.triggerAt));

  return {
    sessionId: createId("session"),
    installId,
    deviceId,
    status: "active",
    startedAt: now,
    createdAt: now,
    updatedAt: now,
    expiresAt: latestTriggerAt + DEFAULT_SESSION_EXPIRY_MS,
    events
  };
}

export function createSessionEvents(
  timeline: SessionTimelineInputEvent[],
  now = Date.now()
): ServerSessionEvent[] {
  const source = timeline.length > 0 ? timeline : createFallbackTimeline();

  return source
    .slice(0, MAX_TIMELINE_EVENTS)
    .map((item, index) => normalizeTimelineEvent(item, index, now))
    .sort((left, right) => left.triggerAt - right.triggerAt);
}

export function summarizeSession(session: ServerFuelingSession) {
  const scheduledCount = session.events.filter(
    (event) => event.status === "scheduled"
  ).length;
  const sentCount = session.events.filter((event) => event.status === "sent").length;
  const failedCount = session.events.filter((event) => event.status === "failed").length;
  const nextEvent =
    session.events.find((event) => event.status === "scheduled") ?? null;

  return {
    session,
    scheduledCount,
    sentCount,
    failedCount,
    nextEvent
  };
}

export function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

export function setServerSessionStoreForTesting(nextStore: ServerSessionStore | null) {
  store = nextStore;
}

class MemoryServerSessionStore implements ServerSessionStore {
  mode: ServerSessionStorageMode = "memory";
  private sessions = new Map<string, ServerFuelingSession>();

  async saveSession(session: ServerFuelingSession) {
    this.sessions.set(session.sessionId, session);
    return session;
  }

  async getSession(sessionId: string) {
    return this.sessions.get(sessionId) ?? null;
  }

  async updateSession(
    sessionId: string,
    update: (session: ServerFuelingSession) => ServerFuelingSession
  ) {
    const session = await this.getSession(sessionId);

    if (!session) {
      return null;
    }

    const nextSession = update(session);
    this.sessions.set(sessionId, nextSession);
    return nextSession;
  }

  async listActiveSessions(limit = 100) {
    return [...this.sessions.values()]
      .filter((session) => session.status === "active")
      .slice(0, limit);
  }
}

class BlobServerSessionStore implements ServerSessionStore {
  mode: ServerSessionStorageMode = "blob";

  async saveSession(session: ServerFuelingSession) {
    await putJson(createBlobPath(session.sessionId), session);
    return session;
  }

  async getSession(sessionId: string) {
    return getJson<ServerFuelingSession>(createBlobPath(sessionId));
  }

  async updateSession(
    sessionId: string,
    update: (session: ServerFuelingSession) => ServerFuelingSession
  ) {
    const session = await this.getSession(sessionId);

    if (!session) {
      return null;
    }

    const nextSession = update(session);
    await this.saveSession(nextSession);
    return nextSession;
  }

  async listActiveSessions(limit = 100) {
    const result = await list({ prefix: BLOB_SESSION_PREFIX, limit });
    const sessions = await Promise.all(
      result.blobs.map((blob) => getJson<ServerFuelingSession>(blob.pathname))
    );

    return sessions.filter(
      (session): session is ServerFuelingSession => session?.status === "active"
    );
  }
}

class UpstashServerSessionStore implements ServerSessionStore {
  mode: ServerSessionStorageMode = "upstash";

  async saveSession(session: ServerFuelingSession) {
    const key = createUpstashSessionKey(session.sessionId);
    await upstashCommand<string>(["SET", key, JSON.stringify(session)]);

    if (session.status === "active") {
      await upstashCommand<number>(["SADD", UPSTASH_ACTIVE_SESSIONS_KEY, key]);
    } else {
      await upstashCommand<number>(["SREM", UPSTASH_ACTIVE_SESSIONS_KEY, key]);
    }

    return session;
  }

  async getSession(sessionId: string) {
    const value = await upstashCommand<string | null>([
      "GET",
      createUpstashSessionKey(sessionId)
    ]);

    return parseSession(value);
  }

  async updateSession(
    sessionId: string,
    update: (session: ServerFuelingSession) => ServerFuelingSession
  ) {
    const session = await this.getSession(sessionId);

    if (!session) {
      return null;
    }

    const nextSession = update(session);
    await this.saveSession(nextSession);
    return nextSession;
  }

  async listActiveSessions(limit = 100) {
    const keys = await upstashCommand<string[]>(["SMEMBERS", UPSTASH_ACTIVE_SESSIONS_KEY]);

    if (!keys?.length) {
      return [];
    }

    const selectedKeys = keys.slice(0, limit);
    const values = await upstashCommand<Array<string | null>>(["MGET", ...selectedKeys]);

    return values
      .map((value) => parseSession(value))
      .filter((session): session is ServerFuelingSession => session?.status === "active");
  }
}

function normalizeTimelineEvent(
  item: SessionTimelineInputEvent,
  index: number,
  now: number
): ServerSessionEvent {
  const minute = readNumber(item.minute, 0);
  const explicitDelaySeconds = readNumber(item.delaySeconds, Number.NaN);
  const delaySeconds = Number.isFinite(explicitDelaySeconds)
    ? Math.max(0, Math.round(explicitDelaySeconds))
    : Math.max(0, Math.round(minute * 60));
  const eventType = sanitizeText(item.eventType, 40) || "carb";
  const tag = sanitizeText(item.tag, 80) || `fuelplan-carb-${minute || index + 1}`;
  const updatedAt = now;

  return {
    eventId: createId(`event_${index + 1}`),
    eventType,
    title: sanitizeText(item.title, 80) || "Fuel now",
    body: sanitizeText(item.body, 160) || "Neem 30g carbs",
    tag,
    url: sanitizeUrl(item.url) || "/live-session",
    triggerAt: now + delaySeconds * 1000,
    delaySeconds,
    status: "scheduled",
    attempts: 0,
    updatedAt
  };
}

function createFallbackTimeline(): SessionTimelineInputEvent[] {
  return [10, 30, 60, 90, 120].map((seconds) => ({
    delaySeconds: seconds,
    eventType: "carb",
    title: "Fuel now",
    body: "Neem 30g carbs",
    tag: `fuelplan-carb-${seconds}s`,
    url: "/live-session"
  }));
}

function parseSession(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as ServerFuelingSession;
  } catch {
    return null;
  }
}

function createId(prefix: string) {
  if (typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sanitizeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function sanitizeUrl(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const url = value.trim();
  return url.startsWith("/") || url.startsWith("https://") ? url.slice(0, 240) : "";
}

function createBlobPath(sessionId: string) {
  return `${BLOB_SESSION_PREFIX}${sanitizePathSegment(sessionId)}.json`;
}

function createUpstashSessionKey(sessionId: string) {
  return `fuelplan:session:${sessionId}`;
}

function hasBlobConfig() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function putJson(pathname: string, value: unknown) {
  await put(pathname, JSON.stringify(value), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json"
  });
}

async function getJson<T>(pathname: string) {
  const result = await get(pathname, { access: "private", useCache: false }).catch(
    () => null
  );

  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }

  const text = await readStreamAsText(result.stream);

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function readStreamAsText(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return text;
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
}
