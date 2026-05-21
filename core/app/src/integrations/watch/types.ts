export type WatchProviderId = "samsung" | "garmin" | "coros" | "mock";

export type WatchConnectionStatus =
  | "not_connected"
  | "demo_connected"
  | "real_integration_pending"
  | "error";

export interface WatchSensorSample {
  providerId: WatchProviderId;
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

export interface WatchExpectedDataField {
  key:
    | "heartRate"
    | "distance"
    | "pace/speed"
    | "elapsedTime"
    | "elevation/grade"
    | "temperature";
  availability: "required" | "optional" | "limited";
}

export interface WatchOutputField {
  key:
    | "nextFuelAction"
    | "carbsDoseGrams"
    | "drinkDoseMl"
    | "nextActionTimer"
    | "fuelBuffer"
    | "fuelDeficit";
}

export interface WatchIntegrationStep {
  title: string;
  detail: string;
}

export interface WatchProvider {
  id: WatchProviderId;
  label: string;
  status: WatchConnectionStatus;
  description: string;
  modeLabel: string;
  expectedData: WatchExpectedDataField[];
  outputFields: WatchOutputField[];
  integrationSteps: WatchIntegrationStep[];
  connect: () => WatchConnectionStatus;
  disconnect: () => WatchConnectionStatus;
}
