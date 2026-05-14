export type Gender = "male" | "female";
export type SelectedEnergyEngine = "keytel" | "minetti" | "hybrid";
export type EnergyOutputMode = "keytel" | "minetti";
export type BodyFatSource = "manual" | "bmi-estimate";

const KJ_PER_KCAL = 4.184;
const MINUTES_PER_DAY = 1440;
const CM_PER_M = 100;

const MIN_BODY_FAT_PCT = 3;
const MAX_BODY_FAT_PCT = 60;
const MIN_RER = 0.7;
const MAX_RER = 1;
const RER_SPAN = MAX_RER - MIN_RER;

const BMR_CUNNINGHAM_BASE_KCAL_DAY = 500;
const BMR_CUNNINGHAM_LBM_FACTOR = 22;
const BMR_KATCH_BASE_KCAL_DAY = 370;
const BMR_KATCH_LBM_FACTOR = 21.6;
const BMR_MIFFLIN_WEIGHT_FACTOR = 10;
const BMR_MIFFLIN_HEIGHT_FACTOR = 6.25;
const BMR_MIFFLIN_AGE_FACTOR = 5;
const BMR_MIFFLIN_MALE_OFFSET = 5;
const BMR_MIFFLIN_FEMALE_OFFSET = -161;

const BMI_BODY_FAT_BMI_FACTOR = 1.39;
const BMI_BODY_FAT_AGE_FACTOR = 0.16;
const BMI_BODY_FAT_MALE_OFFSET = -10.34;
const BMI_BODY_FAT_BASE_OFFSET = -9;

const RESTING_RER_KCAL_PER_LITER_O2 = 4.82;
const WEIR_KCAL_BASE = 3.941;
const WEIR_KCAL_RER_FACTOR = 1.106;
const CARB_KCAL_PER_G = 4;
const FAT_KCAL_PER_G = 9;

const UTH_VO2_MALE_FACTOR = 15.3;
const UTH_VO2_FEMALE_FACTOR = 14.5;
const DEFAULT_VO2_MAX_ML_KG_MIN = 45;

const KEYTEL_MALE_BASE = -95.7735;
const KEYTEL_MALE_HR = 0.634;
const KEYTEL_MALE_VO2 = 0.404;
const KEYTEL_MALE_WEIGHT = 0.394;
const KEYTEL_MALE_AGE = 0.271;
const KEYTEL_FEMALE_BASE = -59.3954;
const KEYTEL_FEMALE_HR = 0.45;
const KEYTEL_FEMALE_VO2 = 0.38;
const KEYTEL_FEMALE_WEIGHT = 0.103;
const KEYTEL_FEMALE_AGE = 0.274;

const HR_TEMP_THRESHOLD_C = 24;
const HR_TEMP_CORRECTION_PER_C = 0.0015;
const RER_TIME_DECAY_PER_MIN = 0.0005;
const RER_EMPTY_GLYCOGEN_EXTRA_DROP = 0.03;
const RER_RECOVERY_PER_CARB_G = 0.0004;

const DEFAULT_GLYCOGEN_G_PER_KG = 6;
const TARGET_BUFFER_START_G = 0;
const DEFAULT_CARB_REMINDER_INTERVAL_MIN = 20;
const DEFAULT_FIRST_CARB_INTAKE_MIN = 25;
const LOW_DURATION_LIMIT_MIN = 60;
const MID_DURATION_LIMIT_MIN = 90;
const LOW_DURATION_CARB_G_H = 20;
const MID_DURATION_CARB_G_H = 40;
const LONG_DURATION_LOW_INTENSITY_CARB_G_H = 60;
const LONG_DURATION_HIGH_INTENSITY_CARB_G_H = 90;
const CARB_DOSE_ROUNDING_G = 5;
const MAX_RECOMMENDED_CARBS_NOW_G = 60;

const MINETTI_P5 = 155.4;
const MINETTI_P4 = -30.4;
const MINETTI_P3 = -43.3;
const MINETTI_P2 = 46.3;
const MINETTI_P1 = 19.5;
const ECONOMY_TIME_TAX_FIRST_12H = 0.005;
const ECONOMY_TIME_TAX_AFTER_12H = 0.0025;
const ECONOMY_TIME_TAX_CAP = 0.1;
const ECONOMY_VERTICAL_TAX_PER_300M = 0.01;
const ECONOMY_IMPACT_TAX_PER_300M = 0.02;
const ECONOMY_TAX_DISTANCE_M = 300;
const ECONOMY_TOTAL_TAX_CAP = 0.25;

const FLAT_SLOPE_ABS_LIMIT = 0.03;
const STEEP_SLOPE_ABS_LIMIT = 0.08;
const STEADY_TERRAIN_FACTOR_LIMIT = 1.08;
const TECHNICAL_TERRAIN_FACTOR_LIMIT = 1.12;
const LATE_RACE_MIN = 12 * 60;
const HIGH_HEAT_C = 28;
const ENGINE_GAP_WARNING_RATIO = 1.15;
const HYBRID_KEYTEL_WEIGHT = 0.5;

const HYDRATION_FIRST_REMINDER_MIN = 20;
const HYDRATION_INTERVAL_MIN = 25;
const HYDRATION_WEIGHT_FACTOR_ML_H = 5;
const HYDRATION_INTENSITY_FACTOR_ML_H = 320;
const HYDRATION_TEMP_FACTOR_ML_H_C = 18;
const HYDRATION_MIN_ML_H = 350;
const HYDRATION_MAX_ML_H = 1000;

export interface UserProfile {
  gender: Gender;
  ageYears: number;
  weightKg: number;
  heightM: number;
  restingHrBpm: number;
  maxHrBpm: number;
  bodyFatPct?: number | null;
  vo2MaxMlKgMin?: number | null;
  plannedCarbsPerHour?: number | null;
}

export interface ResolvedUserProfile extends UserProfile {
  bodyFatPct: number;
  vo2MaxMlKgMin: number;
  plannedCarbsPerHour: number | null;
}

export interface DerivedUserMetrics {
  bodyFatPctUsed: number;
  bodyFatSource: BodyFatSource;
  leanBodyMassKg: number;
  fatMassKg: number;
  bmrCunninghamKcalDay: number;
  bmrKatchMcArdleKcalDay: number;
  bmrMifflinKcalDay: number;
  selectedBmrKcalDay: number;
  personalMetMlKgMin: number;
  compositionGapKjMin: number;
}

export interface TrainingSegment {
  durationMin: number;
  cumulativeTimeMin: number;
  avgHrBpm: number;
  speedMPerMin: number;
  slopeDecimal: number;
  cumulativeAscentM: number;
  cumulativeDescentM: number;
  ambientTempC: number;
  terrainFactor: number;
  carbsConsumedG?: number | null;
  fluidConsumedMl?: number | null;
}

export interface FuelState {
  startingGlycogenG: number;
  glycogenRemainingG: number;
  totalCarbsConsumedG: number;
  totalCarbsBurnedG: number;
  totalFluidConsumedMl: number;
  currentFuelBufferG: number;
}

export interface TrainingEnergyAnchor extends DerivedUserMetrics {
  profile: ResolvedUserProfile;
  startingGlycogenG: number;
  baselineKcalPerLiterO2: number;
  startSpeedHrRatio?: number;
  currentSpeedHrRatio?: number;
}

export interface RerResult {
  baselineRer: number;
  rer: number;
  carbShare: number;
  fatShare: number;
  kcalPerLiterO2: number;
  baselineKcalPerLiterO2: number;
  fuelFactor: number;
}

export interface KeytelEngineResult extends RerResult {
  keytelRawKjMin: number;
  keytelCorrectedKjMin: number;
  adjustedHrBpm: number;
  hrDriftFactor: number;
}

export interface MinettiEngineResult {
  minettiCostJkgm: number;
  minettiKjMin: number;
  economyDecay: number;
  terrainFactor: number;
  timeTax: number;
  verticalTax: number;
  impactTax: number;
}

export interface EngineSelectionResult {
  selectedEngine: SelectedEnergyEngine;
  selectedKjMin: number;
  confidence: number;
  reason: string;
  warnings: string[];
}

export interface SegmentEnergyResult extends EngineSelectionResult {
  timestamp: string;
  durationMin: number;
  cumulativeTimeMin: number;
  kcal: number;
  kj: number;
  rer: number;
  carbShare: number;
  fatShare: number;
  carbsBurnedG: number;
  fatBurnedG: number;
  adjustedHrBpm: number;
  keytelKjMin: number;
  minettiKjMin: number;
  fuelFactor: number;
  effortPct: number;
  effortLabel: "Recovery" | "Aerobic" | "Tempo" | "High";
  zoneLabel: "Z1" | "Z2" | "Z3" | "Z4";
}

export interface TrainingEnergyResult {
  profile: ResolvedUserProfile;
  derived: DerivedUserMetrics;
  totalKcal: number;
  totalKj: number;
  totalCarbsBurnedG: number;
  totalFatBurnedG: number;
  averageRer: number;
  averageFuelFactor: number;
  keytelTotalKcal: number;
  minettiTotalKcal: number;
  efficiencyRatio: number;
  segmentResults: SegmentEnergyResult[];
}

export interface TrainingEnergyOptions {
  outputMode?: EnergyOutputMode;
}

export interface FuelingRecommendation {
  currentFuelBufferG: number;
  fuelDeficitG: number;
  recommendedCarbsNowG: number;
  nextActionInMin: number;
  message: string;
  targetCarbsPerHour: number;
}

export interface HydrationPlan {
  hydrationPerHourMl: number;
  hydrationDoseMl: number;
  firstReminderMin: number;
  reminderIntervalMin: number;
}

export function sanitizeUserProfile(profile: UserProfile): ResolvedUserProfile {
  const heightM = clamp(profile.heightM, 1.2, 2.3);
  const weightKg = clamp(profile.weightKg, 35, 220);
  const ageYears = clamp(Math.round(profile.ageYears), 12, 95);
  const restingHrBpm = clamp(Math.round(profile.restingHrBpm), 30, 120);
  const maxHrBpm = Math.max(
    restingHrBpm + 1,
    clamp(Math.round(profile.maxHrBpm), 90, 240)
  );
  const bodyFatInput = normalizeBodyFatPctInput(profile.bodyFatPct);
  const bodyFatPct =
    bodyFatInput ?? estimateBodyFatPctFromBmi({ ...profile, heightM, weightKg, ageYears });
  const vo2MaxMlKgMin =
    finiteOrNull(profile.vo2MaxMlKgMin) ??
    estimateVo2MaxMlKgMin(profile.gender, restingHrBpm, maxHrBpm);
  const plannedCarbsPerHour = finiteOrNull(profile.plannedCarbsPerHour);

  return {
    gender: profile.gender,
    ageYears,
    weightKg: roundTo(weightKg, 1),
    heightM: roundTo(heightM, 2),
    restingHrBpm,
    maxHrBpm,
    bodyFatPct: roundTo(clamp(bodyFatPct, MIN_BODY_FAT_PCT, MAX_BODY_FAT_PCT), 1),
    vo2MaxMlKgMin: roundTo(clamp(vo2MaxMlKgMin, 20, 90), 1),
    plannedCarbsPerHour:
      plannedCarbsPerHour === null
        ? null
        : roundTo(clamp(plannedCarbsPerHour, 0, 160), 1)
  };
}

export function sanitizeTrainingSegment(segment: TrainingSegment): TrainingSegment {
  const durationMin = clamp(segment.durationMin, 0, 72 * 60);

  return {
    durationMin,
    cumulativeTimeMin: Math.max(0, segment.cumulativeTimeMin),
    avgHrBpm: clamp(Math.round(segment.avgHrBpm), 40, 240),
    speedMPerMin: clamp(segment.speedMPerMin, 0, 700),
    slopeDecimal: clamp(segment.slopeDecimal, -0.45, 0.45),
    cumulativeAscentM: Math.max(0, segment.cumulativeAscentM),
    cumulativeDescentM: Math.max(0, segment.cumulativeDescentM),
    ambientTempC: clamp(segment.ambientTempC, -25, 55),
    terrainFactor: clamp(segment.terrainFactor, 1, 1.6),
    carbsConsumedG: Math.max(0, segment.carbsConsumedG ?? 0),
    fluidConsumedMl: Math.max(0, segment.fluidConsumedMl ?? 0)
  };
}

export function createTrainingEnergyAnchor(profile: UserProfile): TrainingEnergyAnchor {
  const resolvedProfile = sanitizeUserProfile(profile);
  const derived = calculateDerivedUserMetrics(profile);
  const baselineKcalPerLiterO2 = WEIR_KCAL_BASE + WEIR_KCAL_RER_FACTOR * MIN_RER;

  return {
    profile: resolvedProfile,
    ...derived,
    startingGlycogenG: resolvedProfile.weightKg * DEFAULT_GLYCOGEN_G_PER_KG,
    baselineKcalPerLiterO2
  };
}

export function calculateDerivedUserMetrics(profile: UserProfile): DerivedUserMetrics {
  const resolvedProfile = sanitizeUserProfile(profile);
  const bodyFatSource =
    normalizeBodyFatPctInput(profile.bodyFatPct) === null ? "bmi-estimate" : "manual";
  const bodyFatFraction = resolvedProfile.bodyFatPct / 100;

  // Body composition follows the Excel LBM block: mass minus fat mass.
  const fatMassKg = resolvedProfile.weightKg * bodyFatFraction;
  const leanBodyMassKg = resolvedProfile.weightKg - fatMassKg;

  // BMR block: Cunningham, Katch-McArdle, and Mifflin-St Jeor are all exposed.
  const bmrCunninghamKcalDay =
    BMR_CUNNINGHAM_BASE_KCAL_DAY + BMR_CUNNINGHAM_LBM_FACTOR * leanBodyMassKg;
  const bmrKatchMcArdleKcalDay =
    BMR_KATCH_BASE_KCAL_DAY + BMR_KATCH_LBM_FACTOR * leanBodyMassKg;
  const bmrMifflinKcalDay =
    BMR_MIFFLIN_WEIGHT_FACTOR * resolvedProfile.weightKg +
    BMR_MIFFLIN_HEIGHT_FACTOR * resolvedProfile.heightM * CM_PER_M -
    BMR_MIFFLIN_AGE_FACTOR * resolvedProfile.ageYears +
    (resolvedProfile.gender === "male"
      ? BMR_MIFFLIN_MALE_OFFSET
      : BMR_MIFFLIN_FEMALE_OFFSET);
  const selectedBmrKcalDay =
    bodyFatSource === "manual" ? bmrKatchMcArdleKcalDay : bmrMifflinKcalDay;

  // Personal MET replaces the generic 3.5-3.6 ml/kg/min with BMR-derived VO2.
  const personalMetMlKgMin =
    ((selectedBmrKcalDay / MINUTES_PER_DAY) / RESTING_RER_KCAL_PER_LITER_O2) *
    1000 /
    resolvedProfile.weightKg;

  // Composition gap calibrates Keytel against the athlete's selected BMR anchor.
  const personalBmrKjMin = (selectedBmrKcalDay / MINUTES_PER_DAY) * KJ_PER_KCAL;
  const keytelRestKjMin = calculateKeytelFormulaKjMin(
    resolvedProfile,
    resolvedProfile.restingHrBpm
  );
  const compositionGapKjMin = personalBmrKjMin - keytelRestKjMin;

  return {
    bodyFatPctUsed: roundTo(resolvedProfile.bodyFatPct, 1),
    bodyFatSource,
    leanBodyMassKg: roundTo(leanBodyMassKg, 1),
    fatMassKg: roundTo(fatMassKg, 1),
    bmrCunninghamKcalDay: roundTo(bmrCunninghamKcalDay, 1),
    bmrKatchMcArdleKcalDay: roundTo(bmrKatchMcArdleKcalDay, 1),
    bmrMifflinKcalDay: roundTo(bmrMifflinKcalDay, 1),
    selectedBmrKcalDay: roundTo(selectedBmrKcalDay, 1),
    personalMetMlKgMin: roundTo(personalMetMlKgMin, 3),
    compositionGapKjMin: roundTo(compositionGapKjMin, 3)
  };
}

export function createInitialFuelState(profile: UserProfile): FuelState {
  const resolvedProfile = sanitizeUserProfile(profile);
  const startingGlycogenG = resolvedProfile.weightKg * DEFAULT_GLYCOGEN_G_PER_KG;

  return {
    startingGlycogenG,
    glycogenRemainingG: startingGlycogenG,
    totalCarbsConsumedG: 0,
    totalCarbsBurnedG: 0,
    totalFluidConsumedMl: 0,
    currentFuelBufferG: TARGET_BUFFER_START_G
  };
}

export function calculateRer(
  profile: UserProfile,
  segment: TrainingSegment,
  fuelState: Partial<FuelState> = {}
): RerResult {
  const resolvedProfile = sanitizeUserProfile(profile);
  const resolvedSegment = sanitizeTrainingSegment(segment);
  const resolvedFuelState = resolveFuelState(resolvedProfile, fuelState);
  const baselineRer = calculateBaselineRer(resolvedProfile, resolvedSegment.avgHrBpm);

  // RER starts from HR reserve, then drops with time and lower glycogen availability.
  const timeDecay = RER_TIME_DECAY_PER_MIN * resolvedSegment.cumulativeTimeMin;
  const glycogenPressure =
    1 -
    clamp(
      resolvedFuelState.glycogenRemainingG / resolvedFuelState.startingGlycogenG,
      0,
      1
    );
  const glycogenDecay = glycogenPressure * RER_EMPTY_GLYCOGEN_EXTRA_DROP;

  // Carbs consumed during and before the segment partially restore carbohydrate use.
  const totalCarbsAvailableForRecovery =
    resolvedFuelState.totalCarbsConsumedG + (resolvedSegment.carbsConsumedG ?? 0);
  const carbRecovery = clamp(
    totalCarbsAvailableForRecovery * RER_RECOVERY_PER_CARB_G,
    0,
    timeDecay + glycogenDecay
  );
  const rer = clamp(
    baselineRer - timeDecay - glycogenDecay + carbRecovery,
    MIN_RER,
    Math.min(MAX_RER, baselineRer)
  );
  const carbShare = clamp((rer - MIN_RER) / RER_SPAN, 0, 1);
  const fatShare = 1 - carbShare;

  // Weir equation maps RER to the energy value of each liter O2.
  const kcalPerLiterO2 = WEIR_KCAL_BASE + WEIR_KCAL_RER_FACTOR * rer;
  const baselineKcalPerLiterO2 = WEIR_KCAL_BASE + WEIR_KCAL_RER_FACTOR * baselineRer;
  const fuelFactor = kcalPerLiterO2 / baselineKcalPerLiterO2;

  return {
    baselineRer: roundTo(baselineRer, 4),
    rer: roundTo(rer, 4),
    carbShare: roundTo(carbShare, 4),
    fatShare: roundTo(fatShare, 4),
    kcalPerLiterO2: roundTo(kcalPerLiterO2, 4),
    baselineKcalPerLiterO2: roundTo(baselineKcalPerLiterO2, 4),
    fuelFactor: roundTo(fuelFactor, 4)
  };
}

export function calculateKeytelEngine(
  profile: UserProfile,
  anchor: TrainingEnergyAnchor,
  segment: TrainingSegment,
  fuelState: Partial<FuelState> = {}
): KeytelEngineResult {
  const resolvedSegment = sanitizeTrainingSegment(segment);
  const resolvedProfile = anchor.profile;
  const hrDriftFactor = calculateHrDriftFactor(anchor, resolvedSegment);
  const adjustedHrBpm =
    calculateTemperatureAdjustedHr(resolvedSegment.avgHrBpm, resolvedSegment.ambientTempC) *
    hrDriftFactor;

  // Keytel maps corrected HR plus athlete biometrics directly to kJ/min.
  const keytelBaseKjMin = calculateKeytelFormulaKjMin(resolvedProfile, adjustedHrBpm);
  const keytelRawKjMin = Math.max(0, keytelBaseKjMin + anchor.compositionGapKjMin);
  const rer = calculateRer(resolvedProfile, resolvedSegment, fuelState);
  const keytelCorrectedKjMin = keytelRawKjMin * rer.fuelFactor;

  return {
    ...rer,
    keytelRawKjMin: roundTo(keytelRawKjMin, 3),
    keytelCorrectedKjMin: roundTo(keytelCorrectedKjMin, 3),
    adjustedHrBpm: roundTo(adjustedHrBpm, 1),
    hrDriftFactor: roundTo(hrDriftFactor, 4)
  };
}

export function calculateHrDriftFactor(
  anchor: Pick<TrainingEnergyAnchor, "startSpeedHrRatio" | "currentSpeedHrRatio">,
  segment: TrainingSegment
): number {
  const resolvedSegment = sanitizeTrainingSegment(segment);

  if (!anchor.startSpeedHrRatio || !anchor.currentSpeedHrRatio) {
    return 1;
  }

  // Drift correction compares meters per beat now vs the early steady anchor.
  const rawRatio = clamp(anchor.currentSpeedHrRatio / anchor.startSpeedHrRatio, 0.75, 1.1);
  const drift = Math.max(0, 1 - rawRatio);
  const hours = resolvedSegment.cumulativeTimeMin / 60;
  const driftCorrectionShare =
    hours <= 4 ? 1 : hours >= 8 ? 0.5 : 1 - ((hours - 4) / 4) * 0.5;

  return clamp(1 - drift * driftCorrectionShare, 0.85, 1.05);
}

export function calculateTemperatureAdjustedHr(avgHrBpm: number, ambientTempC: number): number {
  // Heat above the threshold inflates HR, so reduce the HR used by Keytel.
  const heatDelta = Math.max(0, ambientTempC - HR_TEMP_THRESHOLD_C);
  return avgHrBpm * (1 - HR_TEMP_CORRECTION_PER_C * heatDelta);
}

export function calculateMinettiEngine(
  profile: UserProfile,
  anchor: TrainingEnergyAnchor,
  segment: TrainingSegment
): MinettiEngineResult {
  const resolvedProfile = sanitizeUserProfile(profile);
  const resolvedSegment = sanitizeTrainingSegment(segment);
  const { economyDecay, timeTax, verticalTax, impactTax } =
    calculateEconomyDecay(resolvedSegment);
  const slope = resolvedSegment.slopeDecimal;

  // Minetti polynomial gives cost of transport in J/kg/m; personal MET replaces 3.6.
  const baseCostJkgm =
    MINETTI_P5 * slope ** 5 +
    MINETTI_P4 * slope ** 4 +
    MINETTI_P3 * slope ** 3 +
    MINETTI_P2 * slope ** 2 +
    MINETTI_P1 * slope +
    anchor.personalMetMlKgMin;
  const minettiCostJkgm =
    baseCostJkgm * resolvedSegment.terrainFactor * economyDecay;

  // Convert transport cost to kJ/min with body mass and segment speed.
  const minettiKjMin =
    (minettiCostJkgm * resolvedSegment.speedMPerMin * resolvedProfile.weightKg) / 1000;

  return {
    minettiCostJkgm: roundTo(Math.max(0, minettiCostJkgm), 4),
    minettiKjMin: roundTo(Math.max(0, minettiKjMin), 3),
    economyDecay: roundTo(economyDecay, 4),
    terrainFactor: roundTo(resolvedSegment.terrainFactor, 3),
    timeTax: roundTo(timeTax, 4),
    verticalTax: roundTo(verticalTax, 4),
    impactTax: roundTo(impactTax, 4)
  };
}

export function selectEnergyEngine(
  keytel: KeytelEngineResult,
  minetti: MinettiEngineResult,
  segment: TrainingSegment
): EngineSelectionResult {
  const resolvedSegment = sanitizeTrainingSegment(segment);
  const warnings: string[] = [];
  const absoluteSlope = Math.abs(resolvedSegment.slopeDecimal);
  const isSteepOrTechnical =
    absoluteSlope >= STEEP_SLOPE_ABS_LIMIT ||
    resolvedSegment.terrainFactor >= TECHNICAL_TERRAIN_FACTOR_LIMIT;
  const isLateRace = resolvedSegment.cumulativeTimeMin >= LATE_RACE_MIN;
  const isHighHeat = resolvedSegment.ambientTempC >= HIGH_HEAT_C;
  const isFlatAndSteady =
    absoluteSlope <= FLAT_SLOPE_ABS_LIMIT &&
    resolvedSegment.terrainFactor <= STEADY_TERRAIN_FACTOR_LIMIT &&
    !isHighHeat;
  const gapRatio =
    minetti.minettiKjMin > 0
      ? keytel.keytelCorrectedKjMin / minetti.minettiKjMin
      : 1;

  if (gapRatio > ENGINE_GAP_WARNING_RATIO) {
    warnings.push("Keytel ligt duidelijk hoger dan Minetti: check heat, drift of stress.");
  }

  if (isLateRace) {
    return {
      selectedEngine: "minetti",
      selectedKjMin: minetti.minettiKjMin,
      confidence: 0.72,
      reason: "Late race: HR drift maakt de interne motor minder betrouwbaar.",
      warnings
    };
  }

  if (isSteepOrTechnical) {
    return {
      selectedEngine: "minetti",
      selectedKjMin: minetti.minettiKjMin,
      confidence: 0.78,
      reason: "Steep or technical segment: mechanische kost domineert.",
      warnings
    };
  }

  if (isHighHeat) {
    return {
      selectedEngine: "hybrid",
      selectedKjMin:
        keytel.keytelCorrectedKjMin * HYBRID_KEYTEL_WEIGHT +
        minetti.minettiKjMin * (1 - HYBRID_KEYTEL_WEIGHT),
      confidence: 0.62,
      reason: "High heat: Keytel en Minetti worden vergeleken door HR heat strain.",
      warnings
    };
  }

  if (isFlatAndSteady) {
    return {
      selectedEngine: "keytel",
      selectedKjMin: keytel.keytelCorrectedKjMin,
      confidence: 0.84,
      reason: "Flat and steady: HR-gebaseerde Keytel is de primaire engine.",
      warnings
    };
  }

  return {
    selectedEngine: "hybrid",
    selectedKjMin:
      keytel.keytelCorrectedKjMin * HYBRID_KEYTEL_WEIGHT +
      minetti.minettiKjMin * (1 - HYBRID_KEYTEL_WEIGHT),
    confidence: 0.68,
    reason: "Mixed segment: combineer interne load en externe mechanische kost.",
    warnings
  };
}

export function calculateTrainingEnergy(
  profile: UserProfile,
  segments: ReadonlyArray<TrainingSegment>,
  options: TrainingEnergyOptions = {}
): TrainingEnergyResult {
  const anchor = createTrainingEnergyAnchor(profile);
  const resolvedProfile = anchor.profile;
  let fuelState = createInitialFuelState(resolvedProfile);
  const segmentResults: SegmentEnergyResult[] = [];

  let totalKj = 0;
  let totalCarbsBurnedG = 0;
  let totalFatBurnedG = 0;
  let keytelTotalKcal = 0;
  let minettiTotalKcal = 0;
  let weightedRer = 0;
  let weightedFuelFactor = 0;
  let weightedDuration = 0;

  segments.forEach((segment) => {
    const resolvedSegment = sanitizeTrainingSegment(segment);
    const keytel = calculateKeytelEngine(
      resolvedProfile,
      anchor,
      resolvedSegment,
      fuelState
    );
    const minetti = calculateMinettiEngine(resolvedProfile, anchor, resolvedSegment);
    const selection = resolveEnergyOutputSelection(
      keytel,
      minetti,
      resolvedSegment,
      options.outputMode ?? "keytel"
    );
    const segmentKj = selection.selectedKjMin * resolvedSegment.durationMin;
    const segmentKcal = segmentKj / KJ_PER_KCAL;
    const keytelKcal =
      (keytel.keytelCorrectedKjMin * resolvedSegment.durationMin) / KJ_PER_KCAL;
    const minettiKcal =
      (minetti.minettiKjMin * resolvedSegment.durationMin) / KJ_PER_KCAL;
    const substrate = calculateSubstrateBurn(segmentKcal, keytel.carbShare, keytel.fatShare);
    const intensity = calculateHrIntensityFraction(resolvedProfile, resolvedSegment.avgHrBpm);

    // Segment totals use selected engine energy and the RER-derived fuel split.
    totalKj += segmentKj;
    totalCarbsBurnedG += substrate.carbsBurnedG;
    totalFatBurnedG += substrate.fatBurnedG;
    keytelTotalKcal += keytelKcal;
    minettiTotalKcal += minettiKcal;
    weightedRer += keytel.rer * resolvedSegment.durationMin;
    weightedFuelFactor += keytel.fuelFactor * resolvedSegment.durationMin;
    weightedDuration += resolvedSegment.durationMin;

    fuelState = updateFuelStateAfterSegment(fuelState, resolvedSegment, substrate.carbsBurnedG);

    segmentResults.push({
      ...selection,
      selectedKjMin: roundTo(selection.selectedKjMin, 3),
      timestamp: formatMinuteTimestamp(resolvedSegment.cumulativeTimeMin),
      durationMin: roundTo(resolvedSegment.durationMin, 1),
      cumulativeTimeMin: roundTo(resolvedSegment.cumulativeTimeMin, 1),
      kcal: roundTo(segmentKcal, 1),
      kj: roundTo(segmentKj, 1),
      rer: keytel.rer,
      carbShare: keytel.carbShare,
      fatShare: keytel.fatShare,
      carbsBurnedG: roundTo(substrate.carbsBurnedG, 1),
      fatBurnedG: roundTo(substrate.fatBurnedG, 1),
      adjustedHrBpm: keytel.adjustedHrBpm,
      keytelKjMin: keytel.keytelCorrectedKjMin,
      minettiKjMin: minetti.minettiKjMin,
      fuelFactor: keytel.fuelFactor,
      effortPct: roundTo(intensity * 100, 1),
      effortLabel: resolveEffortLabel(intensity),
      zoneLabel: resolveZoneLabel(intensity)
    });
  });

  const totalKcal = totalKj / KJ_PER_KCAL;
  const efficiencyRatio =
    keytelTotalKcal > 0 ? minettiTotalKcal / keytelTotalKcal : 0;

  return {
    profile: resolvedProfile,
    derived: {
      bodyFatPctUsed: anchor.bodyFatPctUsed,
      bodyFatSource: anchor.bodyFatSource,
      leanBodyMassKg: anchor.leanBodyMassKg,
      fatMassKg: anchor.fatMassKg,
      bmrCunninghamKcalDay: anchor.bmrCunninghamKcalDay,
      bmrKatchMcArdleKcalDay: anchor.bmrKatchMcArdleKcalDay,
      bmrMifflinKcalDay: anchor.bmrMifflinKcalDay,
      selectedBmrKcalDay: anchor.selectedBmrKcalDay,
      personalMetMlKgMin: anchor.personalMetMlKgMin,
      compositionGapKjMin: anchor.compositionGapKjMin
    },
    totalKcal: roundTo(totalKcal, 1),
    totalKj: roundTo(totalKj, 1),
    totalCarbsBurnedG: roundTo(totalCarbsBurnedG, 1),
    totalFatBurnedG: roundTo(totalFatBurnedG, 1),
    averageRer: roundTo(weightedDuration > 0 ? weightedRer / weightedDuration : 0, 4),
    averageFuelFactor: roundTo(
      weightedDuration > 0 ? weightedFuelFactor / weightedDuration : 0,
      4
    ),
    keytelTotalKcal: roundTo(keytelTotalKcal, 1),
    minettiTotalKcal: roundTo(minettiTotalKcal, 1),
    efficiencyRatio: roundTo(efficiencyRatio, 4),
    segmentResults
  };
}

export function generateFuelingRecommendation(
  profile: UserProfile,
  segmentResult: SegmentEnergyResult,
  fuelState: Partial<FuelState> = {}
): FuelingRecommendation {
  const resolvedProfile = sanitizeUserProfile(profile);
  const targetCarbsPerHour =
    resolvedProfile.plannedCarbsPerHour ??
    calculateDefaultTargetCarbsPerHour(segmentResult);
  const consumedG = Math.max(0, fuelState.totalCarbsConsumedG ?? 0);
  const targetByNowG = (targetCarbsPerHour * segmentResult.cumulativeTimeMin) / 60;
  const currentFuelBufferG = consumedG - targetByNowG;
  const fuelDeficitG = Math.max(0, -currentFuelBufferG);
  const normalDoseG = calculateCarbDoseForInterval(targetCarbsPerHour);
  const isFirstIntakePending = segmentResult.cumulativeTimeMin < DEFAULT_FIRST_CARB_INTAKE_MIN;
  const recommendedCarbsNowG = isFirstIntakePending
    ? 0
    : roundToNearest(
        clamp(Math.max(normalDoseG, fuelDeficitG), 0, MAX_RECOMMENDED_CARBS_NOW_G),
        CARB_DOSE_ROUNDING_G
      );
  const nextActionInMin = resolveNextFuelActionInMin(
    segmentResult.cumulativeTimeMin,
    fuelDeficitG
  );

  return {
    currentFuelBufferG: roundTo(currentFuelBufferG, 1),
    fuelDeficitG: roundTo(fuelDeficitG, 1),
    recommendedCarbsNowG,
    nextActionInMin,
    message: resolveFuelingMessage(recommendedCarbsNowG, nextActionInMin, fuelDeficitG),
    targetCarbsPerHour: roundTo(targetCarbsPerHour, 1)
  };
}

export function calculateHydrationPlan(
  profile: UserProfile,
  segment: TrainingSegment
): HydrationPlan {
  const resolvedProfile = sanitizeUserProfile(profile);
  const resolvedSegment = sanitizeTrainingSegment(segment);
  const intensity = calculateHrIntensityFraction(resolvedProfile, resolvedSegment.avgHrBpm);
  const heatLoad = Math.max(0, resolvedSegment.ambientTempC - 20);

  // Hydration is an app helper, based on mass, intensity, and heat load.
  const hydrationPerHourMl = clamp(
    resolvedProfile.weightKg * HYDRATION_WEIGHT_FACTOR_ML_H +
      intensity * HYDRATION_INTENSITY_FACTOR_ML_H +
      heatLoad * HYDRATION_TEMP_FACTOR_ML_H_C,
    HYDRATION_MIN_ML_H,
    HYDRATION_MAX_ML_H
  );

  return {
    hydrationPerHourMl: roundTo(hydrationPerHourMl, 0),
    hydrationDoseMl: roundToNearest(
      (hydrationPerHourMl * HYDRATION_INTERVAL_MIN) / 60,
      10
    ),
    firstReminderMin: HYDRATION_FIRST_REMINDER_MIN,
    reminderIntervalMin: HYDRATION_INTERVAL_MIN
  };
}

export function calculateDistanceKm(segment: TrainingSegment): number {
  const resolvedSegment = sanitizeTrainingSegment(segment);
  return roundTo((resolvedSegment.speedMPerMin * resolvedSegment.durationMin) / 1000, 1);
}

export function calculateHrIntensityFraction(profile: UserProfile, hrBpm: number): number {
  const resolvedProfile = sanitizeUserProfile(profile);
  return clamp(
    (hrBpm - resolvedProfile.restingHrBpm) /
      Math.max(1, resolvedProfile.maxHrBpm - resolvedProfile.restingHrBpm),
    0,
    1
  );
}

export function calculateCarbDoseForInterval(targetCarbsPerHour: number): number {
  return roundToNearest(
    (targetCarbsPerHour * DEFAULT_CARB_REMINDER_INTERVAL_MIN) / 60,
    CARB_DOSE_ROUNDING_G
  );
}

export function createSampleTrainingEnergyResult(): TrainingEnergyResult {
  const profile: UserProfile = {
    gender: "male",
    ageYears: 26,
    weightKg: 70,
    heightM: 1.8,
    restingHrBpm: 53,
    maxHrBpm: 193,
    bodyFatPct: 12,
    vo2MaxMlKgMin: 60,
    plannedCarbsPerHour: 90
  };
  const segment: TrainingSegment = {
    durationMin: 96,
    cumulativeTimeMin: 96,
    avgHrBpm: 125,
    speedMPerMin: 166.2,
    slopeDecimal: 0.0176875,
    cumulativeAscentM: 140,
    cumulativeDescentM: 143,
    ambientTempC: 20,
    terrainFactor: 1.05
  };

  return calculateTrainingEnergy(profile, [segment]);
}

function resolveEnergyOutputSelection(
  keytel: KeytelEngineResult,
  minetti: MinettiEngineResult,
  segment: TrainingSegment,
  outputMode: EnergyOutputMode
): EngineSelectionResult {
  const automaticSelection = selectEnergyEngine(keytel, minetti, segment);
  const warnings = [...automaticSelection.warnings];

  if (outputMode === "keytel") {
    return {
      selectedEngine: "keytel",
      selectedKjMin: keytel.keytelCorrectedKjMin,
      confidence: automaticSelection.selectedEngine === "keytel" ? 0.86 : 0.7,
      reason: "Keytel Equation output: HR-gebaseerde interne energie die je gebruikt.",
      warnings
    };
  }

  return {
    selectedEngine: "minetti",
    selectedKjMin: minetti.minettiKjMin,
    confidence: automaticSelection.selectedEngine === "minetti" ? 0.86 : 0.7,
    reason: "Minetti Equation output: mechanische trailkost voor een perfecte loper.",
    warnings
  };
}

function estimateBodyFatPctFromBmi({
  gender,
  ageYears,
  weightKg,
  heightM
}: Pick<UserProfile, "gender" | "ageYears" | "weightKg" | "heightM">): number {
  const bmi = weightKg / (heightM * heightM);
  const maleOffset = gender === "male" ? BMI_BODY_FAT_MALE_OFFSET : 0;

  // Excel fallback: body fat estimate from BMI, age, and gender.
  return (
    BMI_BODY_FAT_BMI_FACTOR * bmi +
    BMI_BODY_FAT_AGE_FACTOR * ageYears +
    maleOffset +
    BMI_BODY_FAT_BASE_OFFSET
  );
}

function estimateVo2MaxMlKgMin(
  gender: Gender,
  restingHrBpm: number,
  maxHrBpm: number
): number {
  const factor = gender === "male" ? UTH_VO2_MALE_FACTOR : UTH_VO2_FEMALE_FACTOR;

  // Uth-Sorensen-Overgaard-Pedersen estimate from max/resting HR ratio.
  return factor * (maxHrBpm / Math.max(1, restingHrBpm)) || DEFAULT_VO2_MAX_ML_KG_MIN;
}

function calculateBaselineRer(profile: ResolvedUserProfile, avgHrBpm: number): number {
  // Baseline RER rises linearly with HR reserve before glycogen adjustment.
  const intensity = calculateHrIntensityFraction(profile, avgHrBpm);
  return clamp(MIN_RER + RER_SPAN * intensity, MIN_RER, MAX_RER);
}

function calculateKeytelFormulaKjMin(profile: ResolvedUserProfile, hrBpm: number): number {
  if (profile.gender === "male") {
    return (
      KEYTEL_MALE_BASE +
      KEYTEL_MALE_HR * hrBpm +
      KEYTEL_MALE_VO2 * profile.vo2MaxMlKgMin +
      KEYTEL_MALE_WEIGHT * profile.weightKg +
      KEYTEL_MALE_AGE * profile.ageYears
    );
  }

  return (
    KEYTEL_FEMALE_BASE +
    KEYTEL_FEMALE_HR * hrBpm +
    KEYTEL_FEMALE_VO2 * profile.vo2MaxMlKgMin +
    KEYTEL_FEMALE_WEIGHT * profile.weightKg +
    KEYTEL_FEMALE_AGE * profile.ageYears
  );
}

function calculateEconomyDecay(segment: TrainingSegment) {
  const hours = segment.cumulativeTimeMin / 60;
  const timeTax =
    hours <= 12
      ? hours * ECONOMY_TIME_TAX_FIRST_12H
      : Math.min(
          ECONOMY_TIME_TAX_CAP,
          12 * ECONOMY_TIME_TAX_FIRST_12H +
            (hours - 12) * ECONOMY_TIME_TAX_AFTER_12H
        );
  const verticalTax =
    (segment.cumulativeAscentM / ECONOMY_TAX_DISTANCE_M) *
    ECONOMY_VERTICAL_TAX_PER_300M;
  const impactTax =
    (segment.cumulativeDescentM / ECONOMY_TAX_DISTANCE_M) *
    ECONOMY_IMPACT_TAX_PER_300M;
  const cappedTax = Math.min(
    ECONOMY_TOTAL_TAX_CAP,
    timeTax + verticalTax + impactTax
  );

  // Economy decay increases Minetti cost but is capped for long events.
  return {
    economyDecay: 1 + cappedTax,
    timeTax,
    verticalTax,
    impactTax
  };
}

function calculateSubstrateBurn(kcal: number, carbShare: number, fatShare: number) {
  return {
    carbsBurnedG: (kcal * carbShare) / CARB_KCAL_PER_G,
    fatBurnedG: (kcal * fatShare) / FAT_KCAL_PER_G
  };
}

function updateFuelStateAfterSegment(
  fuelState: FuelState,
  segment: TrainingSegment,
  carbsBurnedG: number
): FuelState {
  const carbsConsumedG = segment.carbsConsumedG ?? 0;
  const fluidConsumedMl = segment.fluidConsumedMl ?? 0;
  const glycogenRemainingG = clamp(
    fuelState.glycogenRemainingG + carbsConsumedG - carbsBurnedG,
    0,
    fuelState.startingGlycogenG
  );

  return {
    ...fuelState,
    glycogenRemainingG,
    totalCarbsConsumedG: fuelState.totalCarbsConsumedG + carbsConsumedG,
    totalCarbsBurnedG: fuelState.totalCarbsBurnedG + carbsBurnedG,
    totalFluidConsumedMl: fuelState.totalFluidConsumedMl + fluidConsumedMl,
    currentFuelBufferG: fuelState.currentFuelBufferG + carbsConsumedG - carbsBurnedG
  };
}

function calculateDefaultTargetCarbsPerHour(
  segmentResult: Pick<SegmentEnergyResult, "cumulativeTimeMin" | "effortPct">
): number {
  const durationMin = segmentResult.cumulativeTimeMin;
  const intensity = clamp(segmentResult.effortPct / 100, 0, 1);

  // App target bands follow the requested <60, 60-90, and >90 minute ranges.
  if (durationMin < LOW_DURATION_LIMIT_MIN) {
    return LOW_DURATION_CARB_G_H * intensity;
  }

  if (durationMin <= MID_DURATION_LIMIT_MIN) {
    return MID_DURATION_CARB_G_H;
  }

  return interpolate(
    LONG_DURATION_LOW_INTENSITY_CARB_G_H,
    LONG_DURATION_HIGH_INTENSITY_CARB_G_H,
    intensity
  );
}

function resolveNextFuelActionInMin(cumulativeTimeMin: number, fuelDeficitG: number): number {
  if (fuelDeficitG >= CARB_DOSE_ROUNDING_G * 2) {
    return 0;
  }

  if (cumulativeTimeMin < DEFAULT_FIRST_CARB_INTAKE_MIN) {
    return Math.ceil(DEFAULT_FIRST_CARB_INTAKE_MIN - cumulativeTimeMin);
  }

  const minutesSinceFirst = cumulativeTimeMin - DEFAULT_FIRST_CARB_INTAKE_MIN;
  const minutesIntoInterval = minutesSinceFirst % DEFAULT_CARB_REMINDER_INTERVAL_MIN;
  return Math.ceil(DEFAULT_CARB_REMINDER_INTERVAL_MIN - minutesIntoInterval);
}

function resolveFuelingMessage(
  recommendedCarbsNowG: number,
  nextActionInMin: number,
  fuelDeficitG: number
): string {
  if (recommendedCarbsNowG > 0 && nextActionInMin === 0) {
    return `Take ${recommendedCarbsNowG}g carbs now; deficit ${roundTo(fuelDeficitG, 0)}g.`;
  }

  if (recommendedCarbsNowG > 0) {
    return `Plan ${recommendedCarbsNowG}g carbs in ${nextActionInMin} min.`;
  }

  return `First carbs around ${DEFAULT_FIRST_CARB_INTAKE_MIN} min.`;
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

function resolveFuelState(
  profile: UserProfile,
  fuelState: Partial<FuelState>
): FuelState {
  const initial = createInitialFuelState(profile);
  const startingGlycogenG = Math.max(1, fuelState.startingGlycogenG ?? initial.startingGlycogenG);

  return {
    startingGlycogenG,
    glycogenRemainingG: clamp(
      fuelState.glycogenRemainingG ?? startingGlycogenG,
      0,
      startingGlycogenG
    ),
    totalCarbsConsumedG: Math.max(0, fuelState.totalCarbsConsumedG ?? 0),
    totalCarbsBurnedG: Math.max(0, fuelState.totalCarbsBurnedG ?? 0),
    totalFluidConsumedMl: Math.max(0, fuelState.totalFluidConsumedMl ?? 0),
    currentFuelBufferG: fuelState.currentFuelBufferG ?? TARGET_BUFFER_START_G
  };
}

function normalizeBodyFatPctInput(value: number | null | undefined): number | null {
  const finite = finiteOrNull(value);

  if (finite === null) {
    return null;
  }

  return finite <= 1 ? finite * 100 : finite;
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function interpolate(min: number, max: number, ratio: number): number {
  return min + (max - min) * clamp(ratio, 0, 1);
}

function formatMinuteTimestamp(minute: number): string {
  const roundedMinute = Math.max(0, Math.round(minute));
  const hours = Math.floor(roundedMinute / 60);
  const minutes = roundedMinute % 60;
  return `${hours}:${minutes.toString().padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function roundToNearest(value: number, nearest: number): number {
  return Math.max(0, Math.round(value / nearest) * nearest);
}
