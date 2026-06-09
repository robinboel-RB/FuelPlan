import fs from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import type {
  FuelingCoreInput,
  FuelingCoreResult,
  FuelingCoreTimelinePoint,
  FuelingCoreTrigger
} from "@/types/fuelingCore";

const PYTHON_TIMEOUT_MS = 10_000;
const CARB_DOSE_G = 30;

export function parseFuelingCoreInput(
  value: unknown
): { ok: true; value: FuelingCoreInput } | { ok: false; error: string } {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "Request body must be an object" };
  }

  const candidate = value as Partial<FuelingCoreInput>;

  if (!candidate.user || typeof candidate.user !== "object") {
    return { ok: false, error: "user is required" };
  }

  if (!Array.isArray(candidate.sessionPoints) || candidate.sessionPoints.length === 0) {
    return { ok: false, error: "sessionPoints must be a non-empty array" };
  }

  const requiredUserFields: Array<keyof FuelingCoreInput["user"]> = [
    "gender",
    "age",
    "weightKg",
    "heightM",
    "restingHr",
    "maxHr",
    "bodyFatPct",
    "vo2max",
    "runningLevel"
  ];

  for (const field of requiredUserFields) {
    if (!isFiniteNumber(candidate.user[field])) {
      return { ok: false, error: `user.${field} must be a finite number` };
    }
  }

  if (candidate.user.gender !== 0 && candidate.user.gender !== 1) {
    return { ok: false, error: "user.gender must be 1 or 0" };
  }

  const requiredPointFields: Array<keyof FuelingCoreInput["sessionPoints"][number]> = [
    "minute",
    "temperatureC",
    "heartRate",
    "paceMinPerKm",
    "slope",
    "terrainIndex",
    "cumulativeAscentM",
    "cumulativeDescentM"
  ];

  for (const [index, point] of candidate.sessionPoints.entries()) {
    if (!point || typeof point !== "object") {
      return { ok: false, error: `sessionPoints[${index}] must be an object` };
    }

    for (const field of requiredPointFields) {
      if (!isFiniteNumber(point[field])) {
        return {
          ok: false,
          error: `sessionPoints[${index}].${field} must be a finite number`
        };
      }
    }

    if (
      point.carbsEatenG !== undefined &&
      !isFiniteNumber(point.carbsEatenG)
    ) {
      return {
        ok: false,
        error: `sessionPoints[${index}].carbsEatenG must be a finite number`
      };
    }
  }

  if (
    candidate.carbTriggerSizeG !== undefined &&
    (!isFiniteNumber(candidate.carbTriggerSizeG) || candidate.carbTriggerSizeG <= 0)
  ) {
    return { ok: false, error: "carbTriggerSizeG must be > 0" };
  }

  return { ok: true, value: candidate as FuelingCoreInput };
}

export function buildPythonPayload(input: FuelingCoreInput) {
  return {
    user: {
      gender: input.user.gender,
      age: input.user.age,
      weight_kg: input.user.weightKg,
      height_m: input.user.heightM,
      resting_hr: input.user.restingHr,
      max_hr: input.user.maxHr,
      body_fat_pct: input.user.bodyFatPct,
      vo2max: input.user.vo2max,
      running_level: input.user.runningLevel
    },
    session_points: input.sessionPoints.map((point) => ({
      minute: point.minute,
      temperature_c: point.temperatureC,
      heart_rate: point.heartRate,
      pace_min_per_km: point.paceMinPerKm,
      slope: point.slope,
      terrain_index: point.terrainIndex,
      cumulative_ascent_m: point.cumulativeAscentM,
      cumulative_descent_m: point.cumulativeDescentM,
      carbs_eaten_g: point.carbsEatenG ?? 0
    })),
    carb_trigger_size_g: input.carbTriggerSizeG ?? CARB_DOSE_G
  };
}

export function normalizeFuelingCoreResult(raw: unknown): FuelingCoreResult {
  const result = raw as {
    derived: Record<string, number>;
    timeline: Array<Record<string, number>>;
    time_for_carbs: number[];
    total_carbs_burned_g: number;
    total_kcal: number;
  };

  const timeline = result.timeline.map((point) => ({
    minute: point.minute,
    hrAdjusted: point.hr_adjusted,
    speedMPerMin: point.speed_m_per_min,
    economyDecay: point.economy_decay,
    minettiBase: point.minetti_base,
    fuelFactor: point.fuel_factor,
    keytelKjMin: point.keytel_kj_min,
    minettiKjMin: point.minetti_kj_min,
    keytelCorrectedKjMin: point.keytel_corrected_kj_min,
    dominantEnergyKjMin: point.dominant_energy_kj_min,
    rer: point.rer,
    carbsGPerMin: point.carbs_g_per_min,
    cumulativeCarbsG: point.cumulative_carbs_g,
    carbReservoirG: point.carb_reservoir_g,
    carbReservoirWithEatingG: point.carb_reservoir_with_eating_g,
    cumulativeKcal: point.cumulative_kcal
  })) satisfies FuelingCoreTimelinePoint[];

  const timeForCarbs = result.time_for_carbs;

  return {
    derived: {
      leanBodyMassKg: result.derived.lean_body_mass_kg,
      bmrActive: result.derived.bmr_active,
      bmrBase: result.derived.bmr_base,
      carbStorageG: result.derived.carb_storage_g,
      compositionGap: result.derived.composition_gap,
      personal1Met: result.derived.personal_1_met
    },
    timeline,
    timeForCarbs,
    triggers: buildTriggers(timeForCarbs, timeline),
    totalCarbsBurnedG: result.total_carbs_burned_g,
    totalKcal: result.total_kcal
  };
}

export async function runFuelingCore(input: FuelingCoreInput): Promise<FuelingCoreResult> {
  const pythonBinary = resolvePythonBinary();
  const engineDir = resolveEngineDir();
  const cliPath = path.join(engineDir, "fueling_core_cli.py");
  const payload = JSON.stringify(buildPythonPayload(input));

  const rawResult = await new Promise<string>((resolve, reject) => {
    const child = spawn(pythonBinary, [cliPath], {
      cwd: engineDir,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    const timeoutId = setTimeout(() => {
      child.kill();
      reject(new Error("Python fueling engine timed out"));
    }, PYTHON_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeoutId);

      if (code !== 0) {
        const detail = stderr.trim() || `Python exited with code ${code}`;
        reject(new Error(detail));
        return;
      }

      resolve(stdout.trim());
    });

    child.stdin.end(payload);
  });

  return normalizeFuelingCoreResult(JSON.parse(rawResult));
}

function resolvePythonBinary() {
  if (process.env.FUELPLAN_PYTHON_BIN) {
    return process.env.FUELPLAN_PYTHON_BIN;
  }

  return process.platform === "win32" ? "python" : "python3";
}

function resolveEngineDir() {
  const candidates = [
    path.resolve(process.cwd(), "..", "engine"),
    path.resolve(process.cwd(), "core", "engine"),
    path.resolve(process.cwd(), "engine")
  ];

  const engineDir = candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, "fueling_core_cli.py"))
  );

  if (!engineDir) {
    throw new Error("Python fueling engine files were not found in the deployment bundle");
  }

  return engineDir;
}

function buildTriggers(
  timeForCarbs: number[],
  timeline: FuelingCoreTimelinePoint[]
): FuelingCoreTrigger[] {
  return timeForCarbs.map((minute) => {
    const point = findTimelinePoint(minute, timeline);

    return {
      minute,
      title: "Fuel now",
      body: "Neem 30g carbs",
      tag: `fuelplan-carb-${minute}`,
      carbDoseG: CARB_DOSE_G,
      carbReservoirG: point?.carbReservoirWithEatingG ?? 0,
      cumulativeCarbsG: point?.cumulativeCarbsG ?? 0
    };
  });
}

function findTimelinePoint(
  minute: number,
  timeline: FuelingCoreTimelinePoint[]
) {
  return timeline.find((point) => Math.round(point.minute) === Math.round(minute));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
