import { describe, expect, it } from "vitest";
import {
  resolvePushEventPayload,
  resolvePushEventPayloadFromBody
} from "@/lib/push/events";
import { resolveTargetSubscriptions } from "@/lib/push/routeHelpers";
import {
  parsePushSubscription,
  type PushSubscriptionStore,
  type SavePushSubscriptionInput,
  type StoredPushSubscription
} from "@/lib/push/subscriptions";

describe("push event payloads", () => {
  it("accepts server-defined test events and dynamic carb events", () => {
    expect(resolvePushEventPayload("fuelplan-test")?.payload.title).toBe("FuelPlan test");
    expect(
      resolvePushEventPayloadFromBody({
        eventType: "carb",
        title: "Fuel now",
        body: "Neem 30g carbs",
        tag: "fuelplan-carb-45",
        url: "/live-session"
      })?.payload.body
    ).toBe("Neem 30g carbs");
    expect(resolvePushEventPayload("custom-public-payload")).toBeNull();
    expect(
      resolvePushEventPayloadFromBody({
        eventType: "carb",
        title: "Fuel now",
        body: "Neem 30g carbs",
        tag: "unsafe-tag",
        url: "/live-session"
      })
    ).toBeNull();
  });

  it("validates Web Push subscription shape", () => {
    expect(
      parsePushSubscription({
        endpoint: "https://push.example.test/subscription",
        expirationTime: null,
        keys: {
          p256dh: "public-key",
          auth: "auth-secret"
        }
      })
    ).not.toBeNull();

    expect(parsePushSubscription({ endpoint: "" })).toBeNull();
  });

  it("can self-heal a missing server record from an owned request subscription", async () => {
    const store = createMemoryStore();
    const records = await resolveTargetSubscriptions({
      auth: {
        installId: "install_test123",
        deviceId: "device_test123",
        installSecretHash: "secret-hash"
      },
      body: {
        subscription: {
          endpoint: "https://push.example.test/subscription",
          expirationTime: null,
          keys: {
            p256dh: "public-key",
            auth: "auth-secret"
          }
        }
      },
      isAdmin: false,
      scope: "own",
      store
    });

    expect(records).toHaveLength(1);
    expect(records[0].status).toBe("active");
    expect(await store.countActive()).toBe(1);
  });
});

function createMemoryStore(): PushSubscriptionStore {
  const records = new Map<string, StoredPushSubscription>();

  return {
    async upsert(input: SavePushSubscriptionInput) {
      const record: StoredPushSubscription = {
        key: `${input.installId}:${input.deviceId}`,
        installId: input.installId,
        deviceId: input.deviceId,
        userId: input.userId || "anonymous",
        secretHash: input.secretHash,
        endpoint: input.subscription.endpoint,
        endpointHash: "endpoint-hash",
        subscription: input.subscription,
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        failureCount: 0
      };

      records.set(record.key, record);
      return record;
    },
    async getByOwner(installId: string, deviceId: string) {
      return records.get(`${installId}:${deviceId}`) || null;
    },
    async removeByOwner() {
      return false;
    },
    async removeByEndpoint() {
      return false;
    },
    async markSuccess() {},
    async markFailure() {},
    async listActive() {
      return [...records.values()].filter((record) => record.status === "active");
    },
    async countActive() {
      return records.size;
    }
  };
}
