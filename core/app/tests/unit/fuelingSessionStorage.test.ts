import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_COACH_INPUT } from "@/engine/fuelingEngine";
import {
  ACTIVE_FUELING_PLAN_KEY,
  ACTIVE_SESSION_INPUT_KEY,
  persistActiveSession
} from "@/state/useFuelingSession";
import type { FuelingCoreResult } from "@/types/fuelingCore";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

describe("fueling session storage", () => {
  beforeEach(() => {
    const store = new Map<string, string>();

    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key)
      }
    });
  });

  it("stores active dashboard input and calculatedFuelingPlan", () => {
    const plan = createFuelingPlan();

    persistActiveSession(DEFAULT_COACH_INPUT, plan);

    expect(window.localStorage.getItem(ACTIVE_SESSION_INPUT_KEY)).toContain(
      "weightKg"
    );
    expect(window.localStorage.getItem(ACTIVE_FUELING_PLAN_KEY)).toContain(
      "timeForCarbs"
    );
  });
});

function createFuelingPlan(): FuelingCoreResult {
  return {
    derived: {
      leanBodyMassKg: 61.6,
      bmrActive: 1700,
      bmrBase: 1700,
      carbStorageG: 406,
      compositionGap: 8,
      personal1Met: 3.5
    },
    timeline: [],
    timeForCarbs: [16],
    triggers: [
      {
        minute: 16,
        title: "Fuel now",
        body: "Neem 30g carbs",
        tag: "fuelplan-carb-16",
        carbDoseG: 30,
        carbReservoirG: 376,
        cumulativeCarbsG: 30
      }
    ],
    totalCarbsBurnedG: 30,
    totalKcal: 200
  };
}
