import type { FuelPlanWatchOutput } from "@/integrations/watch/types";
import type {
  FuelingCoreInput,
  FuelingCoreResult,
  FuelingCoreTimelinePoint
} from "@/types/fuelingCore";

export type Gender = "male" | "female";
export type EquationOutputMode = "keytel" | "minetti";
export type SelectedEnergyEngine = "keytel" | "minetti" | "hybrid";
export type CoachStatus =
  | "ready"
  | "steady"
  | "carb"
  | "hydration"
  | "both"
  | "complete";
export type ReminderType = "carbs" | "hydration";
export type IntakeType = ReminderType | "skip";
export type ReminderPhase = "idle" | "warning" | "due";
export type WatchUrgency =
  | "ready"
  | "steady"
  | "warning"
  | "critical"
  | "complete";

export interface CoachInput {
  outputMode: EquationOutputMode;
  weightKg: number;
  gender: Gender;
  age: number;
  heartRate: number;
  bodyFatPct: number | null;
  heightM: number;
  restingHrBpm: number;
  maxHrBpm: number;
  vo2MaxMlKgMin: number | null;
  runningLevel: number;
  plannedCarbsPerHour: number | null;
  segmentDurationMin: number;
  cumulativeTimeMin: number;
  speedMPerMin: number;
  slopeDecimal: number;
  cumulativeAscentM: number;
  cumulativeDescentM: number;
  ambientTempC: number;
  terrainFactor: number;
}

export interface IntakeEvent {
  id: string;
  minute: number;
  clockLabel: string;
  type: IntakeType;
  amount: number;
  unit: "g" | "ml" | "";
  targets?: ReminderType[];
}

export interface CoachPlan {
  isCompleted: boolean;
  sessionDurationMin: number;
  estimatedMaxHr: number;
  effortPct: number;
  effortLabel: "Recovery" | "Aerobic" | "Tempo" | "High";
  zoneLabel: "Z1" | "Z2" | "Z3" | "Z4";
  bodyFatPctUsed: number;
  bodyFatSource: "manual" | "bmi-estimate";
  totalKcal: number;
  selectedEngine: SelectedEnergyEngine;
  selectedEngineReason: string;
  selectedKjMin: number;
  keytelKjMin: number;
  minettiKjMin: number;
  engineGapPct: number;
  averageRer: number;
  keytelTotalKcal: number;
  minettiTotalKcal: number;
  fuelBufferG: number;
  fuelDeficitG: number;
  nextFuelActionInMin: number;
  fuelMessage: string;
  energyWarnings: string[];
  carbPerHour: number;
  hydrationPerHour: number;
  carbDoseG: number;
  hydrationDoseMl: number;
  carbSchedule: number[];
  hydrationSchedule: number[];
  carbPhase: ReminderPhase;
  hydrationPhase: ReminderPhase;
  dueCarbMinute: number | null;
  dueHydrationMinute: number | null;
  nextCarbMinute: number;
  nextHydrationMinute: number;
  nextActionMinute: number;
  nextActionLabel: string;
  progressPct: number;
  simulatedClockLabel: string;
  simulatedDistanceKm: number;
  status: CoachStatus;
  urgency: WatchUrgency;
  watchTitle: string;
  watchMessage: string;
  watchDetail: string;
}

export interface SessionSummary {
  pendingCarbCount: number;
  pendingHydrationCount: number;
  carbTargetByNow: number;
  hydrationTargetByNow: number;
  actualCarbs: number;
  actualHydration: number;
  carbBalance: number;
  hydrationBalance: number;
}

export const DEFAULT_COACH_INPUT: CoachInput = {
  outputMode: "keytel",
  weightKg: 70,
  gender: "male",
  age: 26,
  heartRate: 140,
  bodyFatPct: 12,
  heightM: 1.8,
  restingHrBpm: 53,
  maxHrBpm: 193,
  vo2MaxMlKgMin: 60,
  runningLevel: 1,
  plannedCarbsPerHour: 90,
  segmentDurationMin: 120,
  cumulativeTimeMin: 120,
  speedMPerMin: 181.8,
  slopeDecimal: (140 + 143) / 16000,
  cumulativeAscentM: 0,
  cumulativeDescentM: 0,
  ambientTempC: 20,
  terrainFactor: 1.05
};

export const SIMULATION_STEP_MIN = 1;

const KJ_PER_KCAL = 4.184;
const MIN_RER = 0.7;
const CARB_DOSE_G = 30;
const PRE_ALERT_WINDOW_MIN = 3;
const SESSION_START_HOUR = 8;
const SESSION_START_MINUTE = 0;

export function sanitizeCoachInput(input: CoachInput): CoachInput {
  return {
    outputMode: input.outputMode,
    weightKg: clamp(roundToOne(input.weightKg), 35, 220),
    gender: input.gender,
    age: clamp(Math.round(input.age), 16, 90),
    heartRate: clamp(Math.round(input.heartRate), 40, 240),
    bodyFatPct:
      input.bodyFatPct === null
        ? null
        : clamp(roundToOne(input.bodyFatPct), 0, 60),
    heightM: clamp(roundTo(input.heightM, 2), 1.2, 2.3),
    restingHrBpm: clamp(Math.round(input.restingHrBpm), 30, 120),
    maxHrBpm: Math.max(
      input.restingHrBpm + 1,
      clamp(Math.round(input.maxHrBpm), 90, 240)
    ),
    vo2MaxMlKgMin:
      input.vo2MaxMlKgMin === null
        ? null
        : clamp(roundToOne(input.vo2MaxMlKgMin), 20, 90),
    runningLevel: [1, 2, 3, 4].includes(Math.round(input.runningLevel))
      ? Math.round(input.runningLevel)
      : 1,
    plannedCarbsPerHour:
      input.plannedCarbsPerHour === null
        ? null
        : clamp(roundToOne(input.plannedCarbsPerHour), 0, 160),
    segmentDurationMin: clamp(roundTo(input.segmentDurationMin, 2), 1, 72 * 60),
    cumulativeTimeMin: clamp(roundTo(input.cumulativeTimeMin, 2), 0, 72 * 60),
    speedMPerMin: clamp(roundToOne(input.speedMPerMin), 1, 700),
    slopeDecimal: clamp(roundTo(input.slopeDecimal, 4), -0.45, 0.45),
    cumulativeAscentM: Math.max(0, Math.round(input.cumulativeAscentM)),
    cumulativeDescentM: Math.max(0, Math.round(input.cumulativeDescentM)),
    ambientTempC: clamp(roundToOne(input.ambientTempC), -25, 55),
    terrainFactor: clamp(roundTo(input.terrainFactor, 2), 1, 1.6)
  };
}

export function buildFuelingCoreInput(
  input: CoachInput,
  intakeEvents: IntakeEvent[] = []
): FuelingCoreInput {
  const sanitized = sanitizeCoachInput(input);
  const sessionDurationMin = Math.max(1, Math.ceil(sanitized.segmentDurationMin));
  const paceMinPerKm = 1000 / sanitized.speedMPerMin;
  const carbsByMinute = intakeEvents.reduce<Record<number, number>>((result, event) => {
    if (event.type === "carbs") {
      result[event.minute] = (result[event.minute] ?? 0) + event.amount;
    }

    return result;
  }, {});

  return {
    user: {
      gender: sanitized.gender === "male" ? 1 : 0,
      age: sanitized.age,
      weightKg: sanitized.weightKg,
      heightM: sanitized.heightM,
      restingHr: sanitized.restingHrBpm,
      maxHr: sanitized.maxHrBpm,
      bodyFatPct: normalizeBodyFatFraction(sanitized.bodyFatPct ?? 12),
      vo2max: sanitized.vo2MaxMlKgMin ?? 60,
      runningLevel: sanitized.runningLevel
    },
    sessionPoints: Array.from({ length: sessionDurationMin }, (_, index) => {
      const minute = index + 1;
      const progress = minute / sessionDurationMin;

      return {
        minute,
        temperatureC: sanitized.ambientTempC,
        heartRate: sanitized.heartRate,
        paceMinPerKm,
        slope: sanitized.slopeDecimal,
        terrainIndex: sanitized.terrainFactor,
        cumulativeAscentM: sanitized.cumulativeAscentM * progress,
        cumulativeDescentM: sanitized.cumulativeDescentM * progress,
        carbsEatenG: carbsByMinute[minute] ?? 0
      };
    }),
    carbTriggerSizeG: CARB_DOSE_G
  };
}

export function createCoachPlanFromFuelingCore(
  input: CoachInput,
  corePlan: FuelingCoreResult | null,
  elapsedMinute: number,
  isRunning: boolean,
  firedTriggerMinutes: number[] = []
): CoachPlan {
  const sanitized = sanitizeCoachInput(input);

  if (!corePlan || corePlan.timeline.length === 0) {
    return createPendingCoachPlan(sanitized, elapsedMinute, isRunning);
  }

  const sessionDurationMin = Math.max(
    1,
    Math.ceil(corePlan.timeline[corePlan.timeline.length - 1].minute)
  );
  const boundedElapsedMinute = clamp(
    Math.round(elapsedMinute),
    0,
    sessionDurationMin
  );
  const isCompleted = boundedElapsedMinute >= sessionDurationMin;
  const currentPoint = findCurrentTimelinePoint(
    corePlan.timeline,
    boundedElapsedMinute
  );
  const firedSet = new Set(firedTriggerMinutes.map(Math.round));
  const dueCarbMinute =
    corePlan.timeForCarbs.find(
      (minute) => minute <= boundedElapsedMinute && !firedSet.has(Math.round(minute))
    ) ?? null;
  const futureCarbMinute =
    corePlan.timeForCarbs.find(
      (minute) => minute > boundedElapsedMinute && !firedSet.has(Math.round(minute))
    ) ?? null;
  const nextCarbMinute =
    dueCarbMinute ?? futureCarbMinute ?? sessionDurationMin;
  const nextFuelActionInMin =
    dueCarbMinute !== null ? 0 : Math.max(0, Math.ceil(nextCarbMinute - boundedElapsedMinute));
  const carbPhase: ReminderPhase =
    dueCarbMinute !== null
      ? "due"
      : futureCarbMinute !== null && nextCarbMinute - boundedElapsedMinute <= PRE_ALERT_WINDOW_MIN
        ? "warning"
        : "idle";
  const selectedEngine: SelectedEnergyEngine =
    currentPoint.minettiKjMin >= currentPoint.keytelCorrectedKjMin
      ? "minetti"
      : "keytel";
  const keytelTotalKcal = sumTimelineEnergy(
    corePlan.timeline,
    (point) => point.keytelCorrectedKjMin
  );
  const minettiTotalKcal = sumTimelineEnergy(
    corePlan.timeline,
    (point) => point.minettiKjMin
  );
  const intensity = calculateHrIntensityFraction(sanitized, sanitized.heartRate);
  const fuelBufferG =
    currentPoint.carbReservoirWithEatingG - corePlan.derived.carbStorageG;
  const urgency = resolveFuelingUrgency(isCompleted, isRunning, carbPhase);
  const watchCopy = resolveFuelingWatchCopy({
    isCompleted,
    isRunning,
    carbPhase,
    nextFuelActionInMin,
    reservoirG: currentPoint.carbReservoirWithEatingG
  });

  return {
    isCompleted,
    sessionDurationMin,
    estimatedMaxHr: sanitized.maxHrBpm,
    effortPct: roundTo(intensity * 100, 1),
    effortLabel: resolveEffortLabel(intensity),
    zoneLabel: resolveZoneLabel(intensity),
    bodyFatPctUsed: roundTo(normalizeBodyFatFraction(sanitized.bodyFatPct ?? 12) * 100, 1),
    bodyFatSource: sanitized.bodyFatPct === null ? "bmi-estimate" : "manual",
    totalKcal: roundTo(corePlan.totalKcal, 1),
    selectedEngine,
    selectedEngineReason:
      "Python core: dominant energy is max(Minetti, Keytel corrected).",
    selectedKjMin: roundTo(currentPoint.dominantEnergyKjMin, 3),
    keytelKjMin: roundTo(currentPoint.keytelCorrectedKjMin, 3),
    minettiKjMin: roundTo(currentPoint.minettiKjMin, 3),
    engineGapPct: calculateEngineGapPct(
      currentPoint.keytelCorrectedKjMin,
      currentPoint.minettiKjMin
    ),
    averageRer: roundTo(averageTimelineValue(corePlan.timeline, (point) => point.rer), 4),
    keytelTotalKcal: roundTo(keytelTotalKcal, 1),
    minettiTotalKcal: roundTo(minettiTotalKcal, 1),
    fuelBufferG: roundTo(fuelBufferG, 1),
    fuelDeficitG: roundTo(Math.max(0, -fuelBufferG), 1),
    nextFuelActionInMin,
    fuelMessage:
      dueCarbMinute !== null
        ? "Neem 30g carbs nu."
        : futureCarbMinute !== null
          ? `Neem 30g carbs over ${nextFuelActionInMin} min.`
          : "Geen resterende carb-trigger in deze sessie.",
    energyWarnings: [],
    carbPerHour: roundTo((corePlan.totalCarbsBurnedG / sessionDurationMin) * 60, 1),
    hydrationPerHour: 0,
    carbDoseG: CARB_DOSE_G,
    hydrationDoseMl: 0,
    carbSchedule: corePlan.timeForCarbs,
    hydrationSchedule: [],
    carbPhase,
    hydrationPhase: "idle",
    dueCarbMinute,
    dueHydrationMinute: null,
    nextCarbMinute,
    nextHydrationMinute: sessionDurationMin,
    nextActionMinute: nextCarbMinute,
    nextActionLabel: isCompleted
      ? "Session complete"
      : dueCarbMinute !== null
        ? "Carbs now"
        : futureCarbMinute !== null
          ? `Carbs in ${nextFuelActionInMin} min`
          : "No carb action planned",
    progressPct: clamp(
      Math.round((boundedElapsedMinute / sessionDurationMin) * 100),
      0,
      100
    ),
    simulatedClockLabel: formatClockLabel(boundedElapsedMinute),
    simulatedDistanceKm: calculateDistanceKm(sanitized, boundedElapsedMinute),
    status: urgency === "critical" || urgency === "warning" ? "carb" : watchCopy.status,
    urgency,
    watchTitle: watchCopy.watchTitle,
    watchMessage: watchCopy.watchMessage,
    watchDetail: watchCopy.watchDetail
  };
}

export function calculateSessionSummary(
  plan: CoachPlan,
  intakeEvents: IntakeEvent[],
  elapsedMinute: number
): SessionSummary {
  const carbTargetByNow = Math.round((plan.carbPerHour * elapsedMinute) / 60);
  const actualCarbs = sumIntakeByType(intakeEvents, "carbs");

  return {
    pendingCarbCount: plan.carbPhase === "idle" ? 0 : 1,
    pendingHydrationCount: 0,
    carbTargetByNow,
    hydrationTargetByNow: 0,
    actualCarbs,
    actualHydration: 0,
    carbBalance: actualCarbs - carbTargetByNow,
    hydrationBalance: 0
  };
}

export function formatClockLabel(elapsedMinute: number): string {
  const totalMinutes =
    SESSION_START_HOUR * 60 + SESSION_START_MINUTE + Math.round(elapsedMinute);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

export function createFuelPlanWatchOutput(
  _sample: unknown,
  plan?: Pick<
    CoachPlan,
    | "carbDoseG"
    | "fuelBufferG"
    | "fuelDeficitG"
    | "nextFuelActionInMin"
    | "fuelMessage"
    | "dueCarbMinute"
    | "nextCarbMinute"
    | "sessionDurationMin"
  >
): FuelPlanWatchOutput {
  if (!plan) {
    return {
      nextFuelAction: "none",
      carbsDoseGrams: 0,
      drinkDoseMl: 0,
      nextActionTimerSeconds: 0,
      fuelBufferGrams: 0,
      fuelDeficitGrams: 0,
      message: "Fueling plan wordt berekend."
    };
  }

  const hasCarbAction =
    plan.dueCarbMinute !== null || plan.nextCarbMinute < plan.sessionDurationMin;

  return {
    nextFuelAction: hasCarbAction ? "carbs" : "none",
    carbsDoseGrams: hasCarbAction ? plan.carbDoseG : 0,
    drinkDoseMl: 0,
    nextActionTimerSeconds: Math.max(0, plan.nextFuelActionInMin * 60),
    fuelBufferGrams: plan.fuelBufferG,
    fuelDeficitGrams: plan.fuelDeficitG,
    message: plan.fuelMessage
  };
}

function createPendingCoachPlan(
  input: CoachInput,
  elapsedMinute: number,
  isRunning: boolean
): CoachPlan {
  const sessionDurationMin = Math.max(1, Math.ceil(input.segmentDurationMin));
  const boundedElapsedMinute = clamp(Math.round(elapsedMinute), 0, sessionDurationMin);
  const intensity = calculateHrIntensityFraction(input, input.heartRate);
  const isCompleted = boundedElapsedMinute >= sessionDurationMin;

  return {
    isCompleted,
    sessionDurationMin,
    estimatedMaxHr: input.maxHrBpm,
    effortPct: roundTo(intensity * 100, 1),
    effortLabel: resolveEffortLabel(intensity),
    zoneLabel: resolveZoneLabel(intensity),
    bodyFatPctUsed: roundTo(normalizeBodyFatFraction(input.bodyFatPct ?? 12) * 100, 1),
    bodyFatSource: input.bodyFatPct === null ? "bmi-estimate" : "manual",
    totalKcal: 0,
    selectedEngine: "keytel",
    selectedEngineReason: "Waiting for Python fueling core calculation.",
    selectedKjMin: 0,
    keytelKjMin: 0,
    minettiKjMin: 0,
    engineGapPct: 0,
    averageRer: MIN_RER,
    keytelTotalKcal: 0,
    minettiTotalKcal: 0,
    fuelBufferG: 0,
    fuelDeficitG: 0,
    nextFuelActionInMin: 0,
    fuelMessage: "Fueling plan wordt berekend.",
    energyWarnings: [],
    carbPerHour: 0,
    hydrationPerHour: 0,
    carbDoseG: CARB_DOSE_G,
    hydrationDoseMl: 0,
    carbSchedule: [],
    hydrationSchedule: [],
    carbPhase: "idle",
    hydrationPhase: "idle",
    dueCarbMinute: null,
    dueHydrationMinute: null,
    nextCarbMinute: sessionDurationMin,
    nextHydrationMinute: sessionDurationMin,
    nextActionMinute: sessionDurationMin,
    nextActionLabel: "Calculating fueling plan",
    progressPct: clamp(
      Math.round((boundedElapsedMinute / sessionDurationMin) * 100),
      0,
      100
    ),
    simulatedClockLabel: formatClockLabel(boundedElapsedMinute),
    simulatedDistanceKm: calculateDistanceKm(input, boundedElapsedMinute),
    status: isCompleted ? "complete" : isRunning ? "steady" : "ready",
    urgency: isCompleted ? "complete" : isRunning ? "steady" : "ready",
    watchTitle: isRunning ? "Calculating" : "Ready",
    watchMessage: isRunning ? "PLAN\nLOAD" : "READY",
    watchDetail: "Python fueling core wordt geladen."
  };
}

function normalizeBodyFatFraction(value: number): number {
  return value <= 1 ? value : value / 100;
}

function findCurrentTimelinePoint(
  timeline: FuelingCoreTimelinePoint[],
  elapsedMinute: number
) {
  const targetMinute = Math.max(1, elapsedMinute);
  return (
    [...timeline].reverse().find((point) => point.minute <= targetMinute) ??
    timeline[0]
  );
}

function sumTimelineEnergy(
  timeline: FuelingCoreTimelinePoint[],
  selector: (point: FuelingCoreTimelinePoint) => number
): number {
  return timeline.reduce((total, point) => total + selector(point) / KJ_PER_KCAL, 0);
}

function averageTimelineValue(
  timeline: FuelingCoreTimelinePoint[],
  selector: (point: FuelingCoreTimelinePoint) => number
): number {
  if (timeline.length === 0) {
    return 0;
  }

  return timeline.reduce((total, point) => total + selector(point), 0) / timeline.length;
}

function resolveFuelingUrgency(
  isCompleted: boolean,
  isRunning: boolean,
  carbPhase: ReminderPhase
): WatchUrgency {
  if (isCompleted) {
    return "complete";
  }

  if (!isRunning) {
    return "ready";
  }

  if (carbPhase === "due") {
    return "critical";
  }

  if (carbPhase === "warning") {
    return "warning";
  }

  return "steady";
}

function resolveFuelingWatchCopy({
  isCompleted,
  isRunning,
  carbPhase,
  nextFuelActionInMin,
  reservoirG
}: {
  isCompleted: boolean;
  isRunning: boolean;
  carbPhase: ReminderPhase;
  nextFuelActionInMin: number;
  reservoirG: number;
}): Pick<CoachPlan, "status" | "watchTitle" | "watchMessage" | "watchDetail"> {
  if (isCompleted) {
    return {
      status: "complete",
      watchTitle: "Session complete",
      watchMessage: "SESSION\nCOMPLETE",
      watchDetail: "Fueling timeline afgerond."
    };
  }

  if (!isRunning) {
    return {
      status: "ready",
      watchTitle: "Ready",
      watchMessage: "READY",
      watchDetail: "Start de sessie vanaf dashboard of live coach."
    };
  }

  if (carbPhase === "due") {
    return {
      status: "carb",
      watchTitle: "Fuel now",
      watchMessage: "TAKE\nCARBS",
      watchDetail: `Neem 30g nu · reservoir ${Math.round(reservoirG)}g`
    };
  }

  if (carbPhase === "warning") {
    return {
      status: "carb",
      watchTitle: "Carbs soon",
      watchMessage: "CARBS\nSOON",
      watchDetail: `Over ${nextFuelActionInMin} min · neem 30g`
    };
  }

  return {
    status: "steady",
    watchTitle: "On track",
    watchMessage: "STAY\nSTEADY",
    watchDetail: `Volgende carbs over ${nextFuelActionInMin} min`
  };
}

function calculateHrIntensityFraction(input: CoachInput, hrBpm: number): number {
  return clamp(
    (hrBpm - input.restingHrBpm) / Math.max(1, input.maxHrBpm - input.restingHrBpm),
    0,
    1
  );
}

function calculateDistanceKm(input: CoachInput, durationMin: number): number {
  return roundTo((input.speedMPerMin * durationMin) / 1000, 1);
}

function calculateEngineGapPct(keytelKjMin: number, minettiKjMin: number): number {
  if (keytelKjMin <= 0) {
    return 0;
  }

  return roundTo(((minettiKjMin - keytelKjMin) / keytelKjMin) * 100, 1);
}

function resolveEffortLabel(
  intensity: number
): "Recovery" | "Aerobic" | "Tempo" | "High" {
  if (intensity < 0.45) {
    return "Recovery";
  }
  if (intensity < 0.65) {
    return "Aerobic";
  }
  if (intensity < 0.8) {
    return "Tempo";
  }
  return "High";
}

function resolveZoneLabel(intensity: number): "Z1" | "Z2" | "Z3" | "Z4" {
  if (intensity < 0.45) {
    return "Z1";
  }
  if (intensity < 0.65) {
    return "Z2";
  }
  if (intensity < 0.8) {
    return "Z3";
  }
  return "Z4";
}

function sumIntakeByType(intakeEvents: IntakeEvent[], type: ReminderType): number {
  return intakeEvents
    .filter((event) => event.type === type)
    .reduce((total, event) => total + event.amount, 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function roundToOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
