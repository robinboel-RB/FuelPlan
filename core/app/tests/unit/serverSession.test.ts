import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUSH_AUTH_HEADERS } from "@/lib/push/identity";
import { hashInstallSecret } from "@/lib/push/auth";
import { POST as startRoutePost } from "@/app/api/session/start/route";
import {
  createServerSessionRecord,
  createSessionEvents,
  assertPersistentSessionStorage,
  setServerSessionStoreForTesting,
  type ServerFuelingSession,
  type ServerSessionStore
} from "@/lib/session/sessionStore";
import { triggerServerSessionEvent } from "@/lib/session/sessionActions";
import { getQStashDeliveryHeaders } from "@/lib/session/qstash";
import { sendPushRecordsWithStore } from "@/lib/push/delivery";

const mocks = vi.hoisted(() => ({
  pushRecord: null as unknown,
  sendSummary: {
    total: 1,
    successful: 1,
    failed: 0,
    removed: 0,
    errors: []
  },
  pushStore: {
    getByOwner: vi.fn(),
    markSuccess: vi.fn(),
    markFailure: vi.fn(),
    removeByEndpoint: vi.fn()
  }
}));

vi.mock("@/lib/push/subscriptions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/push/subscriptions")>();

  return {
    ...actual,
    getPushSubscriptionStorageMode: () => "memory",
    getPushSubscriptionStore: () => mocks.pushStore
  };
});

vi.mock("@/lib/push/delivery", () => ({
  sendPushRecordsWithStore: vi.fn(() => Promise.resolve(mocks.sendSummary))
}));

describe("server-driven Level 2 sessions", () => {
  let sessions: Map<string, ServerFuelingSession>;

  beforeEach(() => {
    sessions = new Map();
    mocks.pushStore.getByOwner.mockReset();
    mocks.pushStore.markSuccess.mockReset();
    mocks.pushStore.markFailure.mockReset();
    mocks.pushStore.removeByEndpoint.mockReset();
    vi.mocked(sendPushRecordsWithStore).mockClear();
    vi.mocked(sendPushRecordsWithStore).mockImplementation(() =>
      Promise.resolve(mocks.sendSummary)
    );
    setServerSessionStoreForTesting(createTestSessionStore(sessions));
    process.env.QSTASH_TOKEN = "qstash-token";
    process.env.QSTASH_CURRENT_SIGNING_KEY = "current-signing-key";
    process.env.QSTASH_NEXT_SIGNING_KEY = "next-signing-key";
    process.env.NEXT_PUBLIC_APP_URL = "https://fuelplan.example";
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "public-key";
    process.env.VAPID_PRIVATE_KEY = "private-key";
    process.env.VAPID_SUBJECT = "mailto:test@example.com";
    delete process.env.VERCEL;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  });

  it("creates session timeline events from fueling triggers", () => {
    const events = createSessionEvents(
      [
        {
          minute: 16,
          eventType: "carb",
          title: "Fuel now",
          body: "Neem 30g carbs",
          tag: "fuelplan-carb-16"
        }
      ],
      1_000
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: "carb",
      delaySeconds: 960,
      status: "scheduled",
      attempts: 0
    });
    expect(events[0].triggerAt).toBe(961_000);
  });

  it("rejects memory session storage in production", () => {
    process.env.VERCEL = "1";
    setServerSessionStoreForTesting(null);

    expect(() => assertPersistentSessionStorage()).toThrow(
      "Level 2 requires persistent storage"
    );
  });

  it("/api/session/start returns a clear error without an active subscription", async () => {
    mocks.pushStore.getByOwner.mockResolvedValue(null);

    const response = await startRoutePost(
      new Request("https://fuelplan.example/api/session/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...createAuthHeaders()
        },
        body: JSON.stringify({
          timeline: [{ minute: 16, tag: "fuelplan-carb-16" }]
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("No active subscription for this device");
  });

  it("ignores stopped sessions in the trigger path", async () => {
    const session = createStoredSession("stopped");
    sessions.set(session.sessionId, session);

    const result = await triggerServerSessionEvent({
      sessionId: session.sessionId,
      eventId: session.events[0].eventId
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      ok: true,
      result: "skipped",
      reason: "Session is stopped"
    });
    expect(sendPushRecordsWithStore).not.toHaveBeenCalled();
  });

  it("does not send duplicate push for duplicate trigger delivery", async () => {
    const session = createStoredSession("active");
    sessions.set(session.sessionId, session);
    mocks.pushStore.getByOwner.mockResolvedValue(createStoredPushSubscription());

    const first = await triggerServerSessionEvent({
      sessionId: session.sessionId,
      eventId: session.events[0].eventId
    });
    const second = await triggerServerSessionEvent({
      sessionId: session.sessionId,
      eventId: session.events[0].eventId
    });

    expect(first.body).toMatchObject({ ok: true, result: "sent" });
    expect(second.body).toMatchObject({ ok: true, result: "skipped" });
    expect(sendPushRecordsWithStore).toHaveBeenCalledTimes(1);
  });

  it("adds Vercel protection bypass headers for QStash deliveries", () => {
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = "vercel-bypass-secret";

    expect(getQStashDeliveryHeaders()).toEqual({
      "x-vercel-protection-bypass": "vercel-bypass-secret"
    });
  });
});

function createTestSessionStore(
  sessions: Map<string, ServerFuelingSession>
): ServerSessionStore {
  return {
    mode: "memory",
    async saveSession(session) {
      sessions.set(session.sessionId, session);
      return session;
    },
    async getSession(sessionId) {
      return sessions.get(sessionId) ?? null;
    },
    async updateSession(sessionId, update) {
      const session = sessions.get(sessionId);

      if (!session) {
        return null;
      }

      const nextSession = update(session);
      sessions.set(sessionId, nextSession);
      return nextSession;
    },
    async listActiveSessions() {
      return [...sessions.values()].filter((session) => session.status === "active");
    }
  };
}

function createStoredSession(status: ServerFuelingSession["status"]) {
  return {
    ...createServerSessionRecord({
      installId: "install_test123",
      deviceId: "device_test123",
      now: 1_000,
      timeline: [{ delaySeconds: 1, tag: "fuelplan-carb-1" }]
    }),
    status
  };
}

function createStoredPushSubscription() {
  return {
    key: "install_test123:device_test123",
    installId: "install_test123",
    deviceId: "device_test123",
    userId: "anonymous",
    secretHash: hashInstallSecret("abcdefghijklmnopqrstuvwxyz123456"),
    endpoint: "https://push.example.test/subscription",
    endpointHash: "endpoint-hash",
    subscription: {
      endpoint: "https://push.example.test/subscription",
      expirationTime: null,
      keys: {
        p256dh: "public-key",
        auth: "auth-secret"
      }
    },
    status: "active",
    createdAt: 1_000,
    updatedAt: 1_000,
    failureCount: 0
  };
}

function createAuthHeaders() {
  return {
    [PUSH_AUTH_HEADERS.installId]: "install_test123",
    [PUSH_AUTH_HEADERS.deviceId]: "device_test123",
    [PUSH_AUTH_HEADERS.installSecret]: "abcdefghijklmnopqrstuvwxyz123456"
  };
}
