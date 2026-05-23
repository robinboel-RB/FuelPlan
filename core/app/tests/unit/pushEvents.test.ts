import { describe, expect, it } from "vitest";
import { resolvePushEventPayload } from "@/lib/push/events";
import { parsePushSubscription } from "@/lib/push/subscriptions";

describe("push event payloads", () => {
  it("accepts only server-defined FuelPlan push events", () => {
    expect(resolvePushEventPayload("drink-10")?.payload.title).toBe("Drink now");
    expect(resolvePushEventPayload("fuel-120")?.payload.body).toContain("25g carbs");
    expect(resolvePushEventPayload("custom-public-payload")).toBeNull();
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
});
