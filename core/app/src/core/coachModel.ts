import {
  EnergyOutputMode,
  SelectedEnergyEngine,
  TrainingSegment,
  UserProfile,
  calculateCarbDoseForInterval,
  calculateDistanceKm,
  calculateHydrationPlan,
  calculateTrainingEnergy,
  generateFuelingRecommendation
} from "@/core/trainingEnergyModel";

export type Gender = UserProfile["gender"];
export type EquationOutputMode = EnergyOutputMode;
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
};

export const SIMULATION_STEP_MIN = 1;
export const SESSION_START_HOUR = 8;
export const SESSION_START_MINUTE = 0;
export const CARB_FIRST_REMINDER_MIN = 25;
export const CARB_INTERVAL_MIN = 20;
export const HYDRATION_FIRST_REMINDER_MIN = 20;
export const HYDRATION_INTERVAL_MIN = 25;

const PRE_ALERT_WINDOW_MIN = 3;

export function calculateCoachPlan(
  input: CoachInput,
  elapsedMinute: number,
  isRunning: boolean,
  intakeEvents: IntakeEvent[] = []
): CoachPlan {
  const sanitized = sanitizeCoachInput(input);
  const sessionDurationMin = sanitized.segmentDurationMin;
  const boundedElapsedMinute = clamp(
    Math.round(elapsedMinute),
    0,
    Math.ceil(sessionDurationMin)
  );
  const isCompleted = boundedElapsedMinute >= sessionDurationMin;
  const profile = toUserProfile(sanitized);
  const actualCarbs = sumIntakeByType(intakeEvents, "carbs");
  const actualHydration = sumIntakeByType(intakeEvents, "hydration");
  const energyDurationMin =
    boundedElapsedMinute > 0 || isRunning ? boundedElapsedMinute : sessionDurationMin;
  const energySegment = toTrainingSegment(
    sanitized,
    energyDurationMin === sessionDurationMin ? sanitized.segmentDurationMin : energyDurationMin,
    energyDurationMin === sessionDurationMin ? sanitized.cumulativeTimeMin : energyDurationMin,
    actualCarbs,
    actualHydration
  );
  const currentSegment = toTrainingSegment(
    sanitized,
    boundedElapsedMinute,
    boundedElapsedMinute,
    actualCarbs,
    actualHydration
  );
  const energyResult = calculateTrainingEnergy(profile, [energySegment], {
    outputMode: sanitized.outputMode
  });
  const currentEnergyResult = calculateTrainingEnergy(profile, [currentSegment], {
    outputMode: sanitized.outputMode
  });
  const energySegmentResult = energyResult.segmentResults[0];
  const currentSegmentResult =
    currentEnergyResult.segmentResults[0] ?? energySegmentResult;
  const fuelingRecommendation = generateFuelingRecommendation(
    profile,
    currentSegmentResult,
    {
      totalCarbsConsumedG: actualCarbs
    }
  );
  const hydrationPlan = calculateHydrationPlan(profile, currentSegment);
  const carbPerHour = fuelingRecommendation.targetCarbsPerHour;
  const normalCarbDoseG = calculateCarbDoseForInterval(carbPerHour);
  const carbDoseG =
    fuelingRecommendation.recommendedCarbsNowG > 0
      ? fuelingRecommendation.recommendedCarbsNowG
      : normalCarbDoseG;
  const hydrationDoseMl = hydrationPlan.hydrationDoseMl;
  const baseCarbSchedule = buildReminderSchedule(
    CARB_FIRST_REMINDER_MIN,
    CARB_INTERVAL_MIN,
    sessionDurationMin
  );
  const baseHydrationSchedule = buildReminderSchedule(
    HYDRATION_FIRST_REMINDER_MIN,
    HYDRATION_INTERVAL_MIN,
    sessionDurationMin
  );
  const carbAdaptiveSchedule = buildAdaptiveSchedule({
    type: "carbs",
    intakeEvents,
    firstMinute: CARB_FIRST_REMINDER_MIN,
    intervalMinute: CARB_INTERVAL_MIN,
    doseAmount: Math.max(1, normalCarbDoseG),
    elapsedMinute: boundedElapsedMinute,
    totalMinute: sessionDurationMin
  });
  const hydrationAdaptiveSchedule = buildAdaptiveSchedule({
    type: "hydration",
    intakeEvents,
    firstMinute: HYDRATION_FIRST_REMINDER_MIN,
    intervalMinute: HYDRATION_INTERVAL_MIN,
    doseAmount: Math.max(1, hydrationDoseMl),
    elapsedMinute: boundedElapsedMinute,
    totalMinute: sessionDurationMin
  });
  const nextCarbMinute = carbAdaptiveSchedule.nextReminderMinute;
  const nextHydrationMinute = hydrationAdaptiveSchedule.nextReminderMinute;
  const carbPhase = resolveReminderPhase(boundedElapsedMinute, nextCarbMinute);
  const hydrationPhase = resolveReminderPhase(
    boundedElapsedMinute,
    nextHydrationMinute
  );
  const carbDue = isRunning && carbPhase === "due";
  const hydrationDue = isRunning && hydrationPhase === "due";
  const progressPct = clamp(
    Math.round((boundedElapsedMinute / sessionDurationMin) * 100),
    0,
    100
  );
  const nextActionMinute = Math.min(nextCarbMinute, nextHydrationMinute);
  const nextActionLabel = resolveNextActionLabel({
    isCompleted,
    carbDue,
    hydrationDue,
    carbPhase,
    hydrationPhase,
    elapsedMinute: boundedElapsedMinute,
    nextCarbMinute,
    nextHydrationMinute
  });
  const { status, watchTitle, watchMessage, watchDetail } = resolveWatchOutput({
    isCompleted,
    isRunning,
    carbPhase,
    hydrationPhase,
    carbDue,
    hydrationDue,
    carbDoseG,
    hydrationDoseMl,
    elapsedMinute: boundedElapsedMinute,
    nextCarbMinute,
    nextHydrationMinute
  });
  const urgency = resolveWatchUrgency(
    isCompleted,
    isRunning,
    carbPhase,
    hydrationPhase,
    boundedElapsedMinute
  );

  return {
    isCompleted,
    sessionDurationMin,
    estimatedMaxHr: sanitized.maxHrBpm,
    effortPct: currentSegmentResult.effortPct,
    effortLabel: currentSegmentResult.effortLabel,
    zoneLabel: currentSegmentResult.zoneLabel,
    bodyFatPctUsed: energyResult.derived.bodyFatPctUsed,
    bodyFatSource: energyResult.derived.bodyFatSource,
    totalKcal: energyResult.totalKcal,
    selectedEngine: energySegmentResult.selectedEngine,
    selectedEngineReason: energySegmentResult.reason,
    averageRer: energyResult.averageRer,
    keytelTotalKcal: energyResult.keytelTotalKcal,
    minettiTotalKcal: energyResult.minettiTotalKcal,
    fuelBufferG: fuelingRecommendation.currentFuelBufferG,
    fuelDeficitG: fuelingRecommendation.fuelDeficitG,
    nextFuelActionInMin: fuelingRecommendation.nextActionInMin,
    fuelMessage: fuelingRecommendation.message,
    energyWarnings: energySegmentResult.warnings,
    carbPerHour,
    hydrationPerHour: hydrationPlan.hydrationPerHourMl,
    carbDoseG,
    hydrationDoseMl,
    carbSchedule: carbAdaptiveSchedule.markers.length
      ? carbAdaptiveSchedule.markers
      : baseCarbSchedule,
    hydrationSchedule: hydrationAdaptiveSchedule.markers.length
      ? hydrationAdaptiveSchedule.markers
      : baseHydrationSchedule,
    carbPhase,
    hydrationPhase,
    dueCarbMinute: carbPhase === "idle" ? null : nextCarbMinute,
    dueHydrationMinute: hydrationPhase === "idle" ? null : nextHydrationMinute,
    nextCarbMinute,
    nextHydrationMinute,
    nextActionMinute,
    nextActionLabel,
    progressPct,
    simulatedClockLabel: formatClockLabel(boundedElapsedMinute),
    simulatedDistanceKm: calculateDistanceKm(currentSegment),
    status,
    urgency,
    watchTitle,
    watchMessage,
    watchDetail
  };
}

export function calculateSessionSummary(
  plan: CoachPlan,
  intakeEvents: IntakeEvent[],
  elapsedMinute: number
): SessionSummary {
  const carbTargetByNow = Math.round((plan.carbPerHour * elapsedMinute) / 60);
  const hydrationTargetByNow = Math.round(
    (plan.hydrationPerHour * elapsedMinute) / 60
  );
  const actualCarbs = sumIntakeByType(intakeEvents, "carbs");
  const actualHydration = sumIntakeByType(intakeEvents, "hydration");

  return {
    pendingCarbCount: plan.carbPhase === "idle" ? 0 : 1,
    pendingHydrationCount: plan.hydrationPhase === "idle" ? 0 : 1,
    carbTargetByNow,
    hydrationTargetByNow,
    actualCarbs,
    actualHydration,
    carbBalance: actualCarbs - carbTargetByNow,
    hydrationBalance: actualHydration - hydrationTargetByNow
  };
}

export function sanitizeCoachInput(input: CoachInput): CoachInput {
  return {
    outputMode: input.outputMode,
    weightKg: clamp(roundToOne(input.weightKg), 35, 220),
    gender: input.gender,
    age: clamp(Math.round(input.age), 16, 90),
    heartRate: clamp(Math.round(input.heartRate), 40, 220),
    bodyFatPct:
      input.bodyFatPct === null
        ? null
        : clamp(roundToOne(input.bodyFatPct), 3, 60),
    heightM: clamp(roundToOne(input.heightM), 1.2, 2.3),
    restingHrBpm: clamp(Math.round(input.restingHrBpm), 30, 120),
    maxHrBpm: clamp(Math.round(input.maxHrBpm), 90, 240),
    vo2MaxMlKgMin:
      input.vo2MaxMlKgMin === null
        ? null
        : clamp(roundToOne(input.vo2MaxMlKgMin), 20, 90),
    plannedCarbsPerHour:
      input.plannedCarbsPerHour === null
        ? null
        : clamp(roundToOne(input.plannedCarbsPerHour), 0, 160),
    segmentDurationMin: clamp(roundTo(input.segmentDurationMin, 2), 1, 72 * 60),
    cumulativeTimeMin: clamp(roundTo(input.cumulativeTimeMin, 2), 0, 72 * 60),
    speedMPerMin: clamp(roundToOne(input.speedMPerMin), 0, 700),
    slopeDecimal: clamp(roundTo(input.slopeDecimal, 4), -0.45, 0.45),
    cumulativeAscentM: Math.max(0, Math.round(input.cumulativeAscentM)),
    cumulativeDescentM: Math.max(0, Math.round(input.cumulativeDescentM)),
    ambientTempC: clamp(roundToOne(input.ambientTempC), -25, 55),
    terrainFactor: clamp(roundTo(input.terrainFactor, 2), 1, 1.6)
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

function toUserProfile(input: CoachInput): UserProfile {
  return {
    gender: input.gender,
    ageYears: input.age,
    weightKg: input.weightKg,
    heightM: input.heightM,
    restingHrBpm: input.restingHrBpm,
    maxHrBpm: input.maxHrBpm,
    bodyFatPct: input.bodyFatPct,
    vo2MaxMlKgMin: input.vo2MaxMlKgMin,
    plannedCarbsPerHour: input.plannedCarbsPerHour
  };
}

function toTrainingSegment(
  input: CoachInput,
  durationMin: number,
  cumulativeTimeMin: number,
  carbsConsumedG: number,
  fluidConsumedMl: number
): TrainingSegment {
  return {
    durationMin,
    cumulativeTimeMin,
    avgHrBpm: input.heartRate,
    speedMPerMin: input.speedMPerMin,
    slopeDecimal: input.slopeDecimal,
    cumulativeAscentM: input.cumulativeAscentM,
    cumulativeDescentM: input.cumulativeDescentM,
    ambientTempC: input.ambientTempC,
    terrainFactor: input.terrainFactor,
    carbsConsumedG,
    fluidConsumedMl
  };
}

function resolveWatchOutput({
  isCompleted,
  isRunning,
  carbPhase,
  hydrationPhase,
  carbDue,
  hydrationDue,
  carbDoseG,
  hydrationDoseMl,
  elapsedMinute,
  nextCarbMinute,
  nextHydrationMinute
}: {
  isCompleted: boolean;
  isRunning: boolean;
  carbPhase: ReminderPhase;
  hydrationPhase: ReminderPhase;
  carbDue: boolean;
  hydrationDue: boolean;
  carbDoseG: number;
  hydrationDoseMl: number;
  elapsedMinute: number;
  nextCarbMinute: number;
  nextHydrationMinute: number;
}): Pick<CoachPlan, "status" | "watchTitle" | "watchMessage" | "watchDetail"> {
  if (isCompleted) {
    return {
      status: "complete",
      watchTitle: "Session complete",
      watchMessage: "SESSION\nCOMPLETE",
      watchDetail: "Effort done. Recover and rehydrate."
    };
  }

  if (!isRunning && elapsedMinute === 0) {
    return {
      status: "ready",
      watchTitle: "Ready",
      watchMessage: "Press Run\nsimulation",
      watchDetail: "Reminders verschijnen zodra de sessie start."
    };
  }

  if (!isRunning) {
    return {
      status: "ready",
      watchTitle: "Paused",
      watchMessage: "Simulation\npaused",
      watchDetail: "Hervat om reminders verder te laten lopen."
    };
  }

  if (carbDue && hydrationDue) {
    return {
      status: "both",
      watchTitle: "Critical",
      watchMessage: "EAT +\nDRINK",
      watchDetail: `${carbDoseG}g carbs + ${hydrationDoseMl}ml nu`
    };
  }

  if (carbDue) {
    return {
      status: "carb",
      watchTitle: "Critical",
      watchMessage: "TAKE\nCARBS",
      watchDetail: `${carbDoseG}g nu`
    };
  }

  if (hydrationDue) {
    return {
      status: "hydration",
      watchTitle: "Critical",
      watchMessage: "DRINK\nNOW",
      watchDetail: `${hydrationDoseMl}ml nu`
    };
  }

  const carbWarning = carbPhase === "warning";
  const hydrationWarning = hydrationPhase === "warning";

  if (carbWarning && hydrationWarning) {
    return {
      status: "both",
      watchTitle: "Warning",
      watchMessage: "FUEL\nSOON",
      watchDetail: `${Math.max(0, nextActionMinute(nextCarbMinute, nextHydrationMinute) - elapsedMinute)} min`
    };
  }

  if (carbWarning) {
    return {
      status: "carb",
      watchTitle: "Warning",
      watchMessage: "CARBS\nSOON",
      watchDetail: `${Math.max(0, nextCarbMinute - elapsedMinute)} min`
    };
  }

  if (hydrationWarning) {
    return {
      status: "hydration",
      watchTitle: "Warning",
      watchMessage: "DRINK\nSOON",
      watchDetail: `${Math.max(0, nextHydrationMinute - elapsedMinute)} min`
    };
  }

  return {
    status: "steady",
    watchTitle: "On track",
    watchMessage: elapsedMinute === 0 ? "Session\nstarted" : "Stay\nsteady",
    watchDetail: resolveNextActionLabel({
      isCompleted,
      carbDue,
      hydrationDue,
      carbPhase,
      hydrationPhase,
      elapsedMinute,
      nextCarbMinute,
      nextHydrationMinute
    })
  };
}

function buildReminderSchedule(
  firstMinute: number,
  intervalMinute: number,
  totalMinute: number
): number[] {
  const schedule: number[] = [];

  for (let minute = firstMinute; minute <= totalMinute; minute += intervalMinute) {
    schedule.push(minute);
  }

  return schedule;
}

function buildAdaptiveSchedule({
  type,
  intakeEvents,
  firstMinute,
  intervalMinute,
  doseAmount,
  elapsedMinute,
  totalMinute
}: {
  type: ReminderType;
  intakeEvents: IntakeEvent[];
  firstMinute: number;
  intervalMinute: number;
  doseAmount: number;
  elapsedMinute: number;
  totalMinute: number;
}) {
  const groupedEvents = collapseAdaptiveEvents(
    intakeEvents,
    type,
    Math.max(1, doseAmount)
  );

  let nextReminderMinute = firstMinute;

  groupedEvents.forEach((event) => {
    const anchorMinute = Math.max(nextReminderMinute, event.minute);
    nextReminderMinute = anchorMinute + event.coveredIntervals * intervalMinute;
  });

  const markerStart = nextReminderMinute < elapsedMinute ? elapsedMinute : nextReminderMinute;
  const markers = buildFutureMarkers(markerStart, intervalMinute, totalMinute);

  return {
    nextReminderMinute,
    markers
  };
}

function collapseAdaptiveEvents(
  intakeEvents: IntakeEvent[],
  type: ReminderType,
  doseAmount: number
) {
  const grouped = new Map<number, number>();

  intakeEvents.forEach((event) => {
    if (event.type === type) {
      const coveredIntervals = Math.max(1, Math.round(event.amount / doseAmount));
      grouped.set(event.minute, (grouped.get(event.minute) ?? 0) + coveredIntervals);
      return;
    }

    if (event.type === "skip" && event.targets?.includes(type)) {
      grouped.set(event.minute, (grouped.get(event.minute) ?? 0) + 1);
    }
  });

  return [...grouped.entries()]
    .map(([minute, coveredIntervals]) => ({
      minute,
      coveredIntervals
    }))
    .sort((left, right) => left.minute - right.minute);
}

function buildFutureMarkers(
  startMinute: number,
  intervalMinute: number,
  totalMinute: number
): number[] {
  const markers: number[] = [];
  let minute = Math.max(0, startMinute);

  while (markers.length < 6 && minute <= totalMinute + intervalMinute * 4) {
    markers.push(minute);
    minute += intervalMinute;
  }

  return markers;
}

function resolveReminderPhase(
  elapsedMinute: number,
  reminderMinute: number
): ReminderPhase {
  if (elapsedMinute >= reminderMinute) {
    return "due";
  }

  if (reminderMinute - elapsedMinute <= PRE_ALERT_WINDOW_MIN) {
    return "warning";
  }

  return "idle";
}

function resolveWatchUrgency(
  isCompleted: boolean,
  isRunning: boolean,
  carbPhase: ReminderPhase,
  hydrationPhase: ReminderPhase,
  elapsedMinute: number
): WatchUrgency {
  if (isCompleted) {
    return "complete";
  }
  if (!isRunning && elapsedMinute === 0) {
    return "ready";
  }
  if (!isRunning) {
    return "steady";
  }
  if (carbPhase === "due" || hydrationPhase === "due") {
    return "critical";
  }
  if (carbPhase === "warning" || hydrationPhase === "warning") {
    return "warning";
  }
  return "steady";
}

function resolveNextActionLabel({
  isCompleted,
  carbDue,
  hydrationDue,
  carbPhase,
  hydrationPhase,
  elapsedMinute,
  nextCarbMinute,
  nextHydrationMinute
}: {
  isCompleted: boolean;
  carbDue: boolean;
  hydrationDue: boolean;
  carbPhase: ReminderPhase;
  hydrationPhase: ReminderPhase;
  elapsedMinute: number;
  nextCarbMinute: number;
  nextHydrationMinute: number;
}): string {
  if (isCompleted) {
    return "Session complete";
  }
  if (carbDue && hydrationDue) {
    return "Eat + drink now";
  }
  if (carbDue) {
    return "Carbs now";
  }
  if (hydrationDue) {
    return "Drink now";
  }
  if (carbPhase === "warning" && hydrationPhase === "warning") {
    return `Fuel in ${Math.max(0, nextActionMinute(nextCarbMinute, nextHydrationMinute) - elapsedMinute)} min`;
  }
  if (carbPhase === "warning") {
    return `Carbs in ${Math.max(0, nextCarbMinute - elapsedMinute)} min`;
  }
  if (hydrationPhase === "warning") {
    return `Drink in ${Math.max(0, nextHydrationMinute - elapsedMinute)} min`;
  }

  return nextCarbMinute <= nextHydrationMinute
    ? `Carbs in ${Math.max(0, nextCarbMinute - elapsedMinute)} min`
    : `Drink in ${Math.max(0, nextHydrationMinute - elapsedMinute)} min`;
}

function sumIntakeByType(intakeEvents: IntakeEvent[], type: ReminderType): number {
  return intakeEvents
    .filter((event) => event.type === type)
    .reduce((total, event) => total + event.amount, 0);
}

function nextActionMinute(carbMinute: number, hydrationMinute: number): number {
  return Math.min(carbMinute, hydrationMinute);
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
