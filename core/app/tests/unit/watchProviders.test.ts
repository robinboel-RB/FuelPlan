import { describe, expect, it } from "vitest";
import { createFuelPlanWatchOutput } from "@/engine/fuelingEngine";
import { createMockWatchSensorSample } from "@/integrations/watch/mockWatchProvider";
import {
  resolveWatchProviderStatus,
  selectableWatchProviders,
  watchProviderRegistry
} from "@/integrations/watch/watchProviderRegistry";

describe("watch provider registry", () => {
  it("contains samsung, garmin, coros and mock", () => {
    expect(Object.keys(watchProviderRegistry).sort()).toEqual([
      "coros",
      "garmin",
      "mock",
      "samsung"
    ]);
  });

  it("returns the expected status when switching providers", () => {
    expect(resolveWatchProviderStatus("mock")).toBe("demo_connected");
    expect(resolveWatchProviderStatus("samsung")).toBe("real_integration_pending");
    expect(resolveWatchProviderStatus("garmin")).toBe("real_integration_pending");
    expect(resolveWatchProviderStatus("coros")).toBe("real_integration_pending");
  });

  it("keeps demo as a selectable provider and documents every connection path", () => {
    expect(selectableWatchProviders).toEqual([
      "mock",
      "samsung",
      "garmin",
      "coros"
    ]);

    Object.values(watchProviderRegistry).forEach((provider) => {
      expect(provider.integrationSteps.length).toBeGreaterThanOrEqual(3);
      expect(provider.integrationSteps.every((step) => step.title && step.detail)).toBe(
        true
      );
    });
  });

  it("mock provider delivers WatchSensorSample data", () => {
    const sample = createMockWatchSensorSample({
      elapsedMinute: 12,
      timestamp: 1000,
      input: {
        outputMode: "keytel",
        weightKg: 70,
        gender: "male",
        age: 26,
        heartRate: 125,
        bodyFatPct: 12,
        heightM: 1.8,
        restingHrBpm: 53,
        maxHrBpm: 193,
        vo2MaxMlKgMin: 60,
        plannedCarbsPerHour: 90,
        segmentDurationMin: 96.37,
        cumulativeTimeMin: 96.37,
        speedMPerMin: 166.2,
        slopeDecimal: 0.0177,
        cumulativeAscentM: 140,
        cumulativeDescentM: 143,
        ambientTempC: 20,
        terrainFactor: 1.05
      }
    });

    expect(sample.providerId).toBe("mock");
    expect(sample.elapsedSeconds).toBe(720);
    expect(sample.heartRateBpm).toBe(125);
    expect(sample.distanceMeters).toBeCloseTo(1994.4, 1);
    expect(sample.paceSecPerKm).toBeGreaterThan(0);
    expect(sample.temperatureC).toBe(20);
  });
});

describe("fueling engine watch output", () => {
  it("accepts a WatchSensorSample and returns FuelPlanWatchOutput", () => {
    const sample = {
      providerId: "mock" as const,
      timestamp: 1000,
      elapsedSeconds: 1500,
      heartRateBpm: 125,
      distanceMeters: 4155,
      speedMps: 2.77,
      paceSecPerKm: 361
    };

    const output = createFuelPlanWatchOutput(sample, {
      carbDoseG: 30,
      hydrationDoseMl: 210,
      fuelBufferG: -18,
      fuelDeficitG: 18,
      nextFuelActionInMin: 0,
      nextActionLabel: "Carbs now",
      fuelMessage: "Take 30g carbs now; deficit 18g.",
      dueCarbMinute: 25,
      dueHydrationMinute: null
    });

    expect(output).toEqual({
      nextFuelAction: "carbs",
      carbsDoseGrams: 30,
      drinkDoseMl: 0,
      nextActionTimerSeconds: 0,
      fuelBufferGrams: -18,
      fuelDeficitGrams: 18,
      message: "Take 30g carbs now; deficit 18g."
    });
  });
});
