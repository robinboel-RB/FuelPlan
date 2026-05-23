"use client";

import {
  PUSH_AUTH_HEADERS,
  type PushClientIdentity
} from "@/lib/push/identity";

const INSTALL_ID_KEY = "fuelplan.push.installId";
const DEVICE_ID_KEY = "fuelplan.push.deviceId";
const INSTALL_SECRET_KEY = "fuelplan.push.installSecret";

export function getPushClientIdentity(): PushClientIdentity {
  const existingInstallId = window.localStorage.getItem(INSTALL_ID_KEY);
  const existingDeviceId = window.localStorage.getItem(DEVICE_ID_KEY);
  const existingSecret = window.localStorage.getItem(INSTALL_SECRET_KEY);

  const installId = existingInstallId || createId("install");
  const deviceId = existingDeviceId || createId("device");
  const installSecret = existingSecret || createSecret();

  window.localStorage.setItem(INSTALL_ID_KEY, installId);
  window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
  window.localStorage.setItem(INSTALL_SECRET_KEY, installSecret);

  return { installId, deviceId, installSecret };
}

export function getPushAuthHeaders(): Record<string, string> {
  const identity = getPushClientIdentity();

  return {
    [PUSH_AUTH_HEADERS.installId]: identity.installId,
    [PUSH_AUTH_HEADERS.deviceId]: identity.deviceId,
    [PUSH_AUTH_HEADERS.installSecret]: identity.installSecret
  };
}

function createId(prefix: string) {
  if (typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
  }

  return `${prefix}_${createSecret().slice(0, 32)}`;
}

function createSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
