import { createHash, timingSafeEqual } from "crypto";
import {
  PUSH_AUTH_HEADERS,
  isValidInstallSecret,
  isValidPushIdentifier
} from "@/lib/push/identity";

export interface PushRequestAuth {
  installId: string;
  deviceId: string;
  installSecretHash: string;
}

export function readPushRequestAuth(request: Request): PushRequestAuth | null {
  const installId = request.headers.get(PUSH_AUTH_HEADERS.installId) || "";
  const deviceId = request.headers.get(PUSH_AUTH_HEADERS.deviceId) || "";
  const installSecret = request.headers.get(PUSH_AUTH_HEADERS.installSecret) || "";

  if (
    !isValidPushIdentifier(installId) ||
    !isValidPushIdentifier(deviceId) ||
    !isValidInstallSecret(installSecret)
  ) {
    return null;
  }

  return {
    installId,
    deviceId,
    installSecretHash: hashInstallSecret(installSecret)
  };
}

export function isAdminRequest(request: Request) {
  const expectedToken = process.env.PUSH_ADMIN_TOKEN;

  if (!expectedToken) {
    return false;
  }

  const bearerToken = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  const headerToken = request.headers.get(PUSH_AUTH_HEADERS.adminToken);
  const providedToken = bearerToken || headerToken || "";

  if (!providedToken) {
    return false;
  }

  return constantTimeEquals(providedToken, expectedToken);
}

export function assertOwnsSubscription(
  storedSecretHash: string,
  requestSecretHash: string
) {
  return constantTimeEquals(storedSecretHash, requestSecretHash);
}

export function hashInstallSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

function constantTimeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
