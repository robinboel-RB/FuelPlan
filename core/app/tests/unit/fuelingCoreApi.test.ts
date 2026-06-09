import { describe, expect, it } from "vitest";
import {
  buildPythonPayload,
  normalizeFuelingCoreResult,
  parseFuelingCoreInput
} from "@/app/api/fueling/calculate/route";
import type { FuelingCoreInput } from "@/types/fuelingCore";

describe("fueling core API helpers", () => {
  it("validates input and maps camelCase fields to Python payload shape", () => {
    const input = createInput();
    const parsed = parseFuelingCoreInput(input);

    expect(parsed.ok).toBe(true);
    expect(buildPythonPayload(input)).toMatchObject({
      user: {
        weight_kg: 70,
        body_fat_pct: 0.12,
        running_level: 1
      },
      session_points: [
        {
          pace_min_per_km: 5.5,
          terrain_index: 1.05
        }
      ],
      carb_trigger_size_g: 30
    });
  });

  it("returns normalized result shape with carb triggers", () => {
    const result = normalizeFuelingCoreResult({
      derived: {
        lean_body_mass_kg: 61.6,
        bmr_active: 1700.56,
        bmr_base: 1700,
        carb_storage_g: 406.56,
        composition_gap: 8.24,
        personal_1_met: 3.5
      },
      timeline: [
        {
          minute: 16,
          hr_adjusted: 140,
          speed_m_per_min: 181.8,
          economy_decay: 1,
          minetti_base: 4,
          fuel_factor: 1,
          keytel_kj_min: 60,
          minetti_kj_min: 51,
          keytel_corrected_kj_min: 60,
          dominant_energy_kj_min: 60,
          rer: 0.88,
          carbs_g_per_min: 2,
          cumulative_carbs_g: 30.2,
          carb_reservoir_g: 376,
          carb_reservoir_with_eating_g: 376,
          cumulative_kcal: 200
        }
      ],
      time_for_carbs: [16],
      total_carbs_burned_g: 30.2,
      total_kcal: 200
    });

    expect(result.timeForCarbs).toEqual([16]);
    expect(result.triggers[0]).toMatchObject({
      minute: 16,
      body: "Neem 30g carbs",
      tag: "fuelplan-carb-16"
    });
  });
});

function createInput(): FuelingCoreInput {
  return {
    user: {
      gender: 1,
      age: 26,
      weightKg: 70,
      heightM: 1.8,
      restingHr: 53,
      maxHr: 193,
      bodyFatPct: 0.12,
      vo2max: 60,
      runningLevel: 1
    },
    sessionPoints: [
      {
        minute: 1,
        temperatureC: 20,
        heartRate: 140,
        paceMinPerKm: 5.5,
        slope: 0.0177,
        terrainIndex: 1.05,
        cumulativeAscentM: 0,
        cumulativeDescentM: 0
      }
    ]
  };
}
