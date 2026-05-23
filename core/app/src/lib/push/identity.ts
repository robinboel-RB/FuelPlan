export const PUSH_AUTH_HEADERS = {
  installId: "x-fuelplan-install-id",
  deviceId: "x-fuelplan-device-id",
  installSecret: "x-fuelplan-install-secret",
  adminToken: "x-fuelplan-admin-token"
} as const;

export interface PushClientIdentity {
  installId: string;
  deviceId: string;
  installSecret: string;
}

export function isValidPushIdentifier(value: string) {
  return /^[a-zA-Z0-9_-]{8,96}$/.test(value);
}

export function isValidInstallSecret(value: string) {
  return /^[a-zA-Z0-9_-]{24,192}$/.test(value);
}
