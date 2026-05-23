import type { FuelPlanPushPayload } from "@/lib/push/webpush";

export const PUSH_EVENT_PAYLOADS = {
  "fuelplan-test": {
    title: "FuelPlan test",
    body: "Als je dit op je horloge ziet, werkt de MVP-route.",
    url: "/live-session",
    tag: "fuelplan-test",
    requireInteraction: false
  },
  "drink-10": {
    title: "Drink now",
    body: "Drink 150-200ml water.",
    url: "/live-session",
    tag: "fuelplan-drink-10",
    requireInteraction: true
  },
  "fuel-30": {
    title: "Fuel now",
    body: "Neem 25g carbs.",
    url: "/live-session",
    tag: "fuelplan-fuel-30",
    requireInteraction: true
  },
  "drink-60": {
    title: "Drink now",
    body: "Drink opnieuw enkele slokken.",
    url: "/live-session",
    tag: "fuelplan-drink-60",
    requireInteraction: true
  },
  "energy-90": {
    title: "Energy check",
    body: "Voel je een dip? Neem extra carbs.",
    url: "/live-session",
    tag: "fuelplan-energy-90",
    requireInteraction: true
  },
  "fuel-120": {
    title: "Fuel now",
    body: "Neem 25g carbs indien intensiteit hoog blijft.",
    url: "/live-session",
    tag: "fuelplan-fuel-120",
    requireInteraction: true
  }
} satisfies Record<string, FuelPlanPushPayload>;

export type FuelPlanPushEventType = keyof typeof PUSH_EVENT_PAYLOADS;

export function resolvePushEventPayload(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  if (!Object.prototype.hasOwnProperty.call(PUSH_EVENT_PAYLOADS, value)) {
    return null;
  }

  return {
    eventType: value as FuelPlanPushEventType,
    payload: PUSH_EVENT_PAYLOADS[value as FuelPlanPushEventType]
  };
}
