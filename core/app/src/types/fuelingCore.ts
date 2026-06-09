export interface FuelingCoreUserInputs {
  gender: 1 | 0;
  age: number;
  weightKg: number;
  heightM: number;
  restingHr: number;
  maxHr: number;
  bodyFatPct: number;
  vo2max: number;
  runningLevel: number;
}

export interface FuelingCoreSessionPoint {
  minute: number;
  temperatureC: number;
  heartRate: number;
  paceMinPerKm: number;
  slope: number;
  terrainIndex: number;
  cumulativeAscentM: number;
  cumulativeDescentM: number;
  carbsEatenG?: number;
}

export interface FuelingCoreInput {
  user: FuelingCoreUserInputs;
  sessionPoints: FuelingCoreSessionPoint[];
  carbTriggerSizeG?: number;
}

export interface FuelingCoreDerived {
  leanBodyMassKg: number;
  bmrActive: number;
  bmrBase: number;
  carbStorageG: number;
  compositionGap: number;
  personal1Met: number;
}

export interface FuelingCoreTimelinePoint {
  minute: number;
  hrAdjusted: number;
  speedMPerMin: number;
  economyDecay: number;
  minettiBase: number;
  fuelFactor: number;
  keytelKjMin: number;
  minettiKjMin: number;
  keytelCorrectedKjMin: number;
  dominantEnergyKjMin: number;
  rer: number;
  carbsGPerMin: number;
  cumulativeCarbsG: number;
  carbReservoirG: number;
  carbReservoirWithEatingG: number;
  cumulativeKcal: number;
}

export interface FuelingCoreTrigger {
  minute: number;
  title: string;
  body: string;
  tag: string;
  carbDoseG: number;
  carbReservoirG: number;
  cumulativeCarbsG: number;
}

export interface FuelingCoreResult {
  derived: FuelingCoreDerived;
  timeline: FuelingCoreTimelinePoint[];
  timeForCarbs: number[];
  triggers: FuelingCoreTrigger[];
  totalCarbsBurnedG: number;
  totalKcal: number;
}
