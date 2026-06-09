export interface WatchSensorSample {
  providerId: "phone";
  timestamp: number;
  elapsedSeconds: number;
  heartRateBpm?: number;
  distanceMeters?: number;
  speedMps?: number;
  paceSecPerKm?: number;
  elevationMeters?: number;
  gradePercent?: number;
  temperatureC?: number;
}

export interface FuelPlanWatchOutput {
  nextFuelAction: "carbs" | "drink" | "carbs_and_drink" | "none";
  carbsDoseGrams: number;
  drinkDoseMl: number;
  nextActionTimerSeconds: number;
  fuelBufferGrams: number;
  fuelDeficitGrams: number;
  message: string;
}
