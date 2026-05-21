import type { CoachInput } from "@/engine/fuelingEngine";
import type {
  WatchProvider,
  WatchSensorSample
} from "@/integrations/watch/types";

export const commonWatchOutputFields = [
  { key: "nextFuelAction" },
  { key: "carbsDoseGrams" },
  { key: "drinkDoseMl" },
  { key: "nextActionTimer" },
  { key: "fuelBuffer" },
  { key: "fuelDeficit" }
] satisfies WatchProvider["outputFields"];

export const mockWatchProvider: WatchProvider = {
  id: "mock",
  label: "Demo",
  status: "demo_connected",
  description:
    "Demo view without an external watch. The MVP uses local sensor samples with the same contracts as a real integration.",
  modeLabel: "Demo view",
  expectedData: [
    { key: "heartRate", availability: "required" },
    { key: "distance", availability: "required" },
    { key: "pace/speed", availability: "required" },
    { key: "elapsedTime", availability: "required" },
    { key: "elevation/grade", availability: "optional" },
    { key: "temperature", availability: "optional" }
  ],
  outputFields: commonWatchOutputFields,
  integrationSteps: [
    {
      title: "Select Demo",
      detail: "No external account, SDK, phone bridge, or watch install is needed."
    },
    {
      title: "Run local simulation",
      detail:
        "FuelPlan converts the current session input into WatchSensorSample values."
    },
    {
      title: "Render watch output",
      detail:
        "The fueling engine returns FuelPlanWatchOutput for reminders, buffer, deficit, carbs, and drink."
    }
  ],
  connect: () => "demo_connected",
  disconnect: () => "not_connected"
};

export function createMockWatchSensorSample({
  input,
  elapsedMinute,
  timestamp = Date.now()
}: {
  input: CoachInput;
  elapsedMinute: number;
  timestamp?: number;
}): WatchSensorSample {
  const elapsedSeconds = Math.max(0, Math.round(elapsedMinute * 60));
  const distanceMeters = Math.max(0, input.speedMPerMin * elapsedMinute);
  const speedMps = input.speedMPerMin / 60;

  return {
    providerId: "mock",
    timestamp,
    elapsedSeconds,
    heartRateBpm: input.heartRate,
    distanceMeters,
    speedMps,
    paceSecPerKm: speedMps > 0 ? 1000 / speedMps : undefined,
    elevationMeters: input.cumulativeAscentM,
    gradePercent: input.slopeDecimal * 100,
    temperatureC: input.ambientTempC
  };
}
