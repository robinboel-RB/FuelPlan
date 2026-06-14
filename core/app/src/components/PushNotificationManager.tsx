"use client";

import { useEffect, useMemo, useState } from "react";
import { getPushAuthHeaders } from "@/lib/push/clientIdentity";

type PushStatus =
  | "unsupported"
  | "install-required"
  | "permission-needed"
  | "permission-denied"
  | "subscribed"
  | "unsubscribed"
  | "error";

type PushPlatform = "android" | "ios" | "desktop" | "unknown";

interface PushApiSummary {
  ok: boolean;
  error?: string;
  storageMode?: "blob" | "upstash" | "memory";
  hasServerSubscription?: boolean;
  status?: string;
  total?: number;
  successful?: number;
  failed?: number;
  removed?: number;
  lastSuccessAt?: number;
  lastFailureAt?: number;
  failureCount?: number;
}

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export function PushNotificationManager() {
  const [status, setStatus] = useState<PushStatus>("permission-needed");
  const [message, setMessage] = useState("Push status wordt gecontroleerd.");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [serverStorageMode, setServerStorageMode] = useState<string>("unknown");
  const [hasServerSubscription, setHasServerSubscription] = useState(false);
  const [platform, setPlatform] = useState<PushPlatform>("unknown");

  const support = useMemo(() => getPushSupport(platform), [platform]);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  useEffect(() => {
    if (!support.isSupported) {
      setStatus(support.status);
      setMessage(support.reason);
      return;
    }

    if (!vapidPublicKey) {
      setStatus("error");
      setMessage("Geen VAPID public key gevonden.");
      return;
    }

    void syncExistingSubscription();
  }, [support.isSupported, support.reason, support.status]);

  const enablePush = async () => {
    setIsBusy(true);
    setMessage("Web Push toestemming aanvragen.");

    try {
      if (!support.isSupported) {
        setStatus(support.status);
        setMessage(support.reason);
        return;
      }

      if (!vapidPublicKey) {
        setStatus("error");
        setMessage("Geen VAPID public key gevonden.");
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission === "denied") {
        setStatus("permission-denied");
        setMessage("Notifications zijn geblokkeerd. Pas dit aan in je browserinstellingen.");
        recordClientPushTelemetry("permission_denied");
        return;
      }

      if (permission !== "granted") {
        setStatus("permission-needed");
        setMessage("Zet notificaties aan om live fueling alerts te testen.");
        return;
      }

      const registration = await registerServiceWorker();
      const existing = await registration.pushManager.getSubscription();
      const applicationServerKey = getVapidApplicationServerKey();
      const nextSubscription =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        }));

      const response = await ensureServerSubscription(nextSubscription);

      if (!response.ok) {
        throw new Error(response.error || "Subscribe failed");
      }

      setSubscription(nextSubscription);
      setStatus("subscribed");
      setMessage("Web Push actief en server-side geregistreerd.");
      recordClientPushTelemetry("subscribe_success");
    } catch (error) {
      setStatus("error");
      setMessage(`Push subscription failed: ${formatPushError(error)}`);
      recordClientPushTelemetry("subscribe_failure");
    } finally {
      setIsBusy(false);
    }
  };

  const disablePush = async () => {
    setIsBusy(true);
    setMessage("Web Push uitschakelen.");

    try {
      const registration = await navigator.serviceWorker.ready;
      const activeSubscription =
        subscription || (await registration.pushManager.getSubscription());

      await postJson<PushApiSummary>("/api/push/unsubscribe", {}, getPushAuthHeaders());

      if (activeSubscription) {
        await activeSubscription.unsubscribe();
      }

      setSubscription(null);
      setHasServerSubscription(false);
      setStatus("unsubscribed");
      setMessage("Web Push notifications uitgeschakeld.");
    } catch (error) {
      setStatus("error");
      setMessage(`Disable push failed: ${formatPushError(error)}`);
    } finally {
      setIsBusy(false);
    }
  };

  const sendTestPush = async () => {
    setIsBusy(true);
    setMessage("Test push versturen.");

    try {
      const registration = await navigator.serviceWorker.ready;
      const activeSubscription =
        subscription || (await registration.pushManager.getSubscription());

      if (!activeSubscription) {
        setStatus("unsubscribed");
        setMessage("Geen actieve subscription.");
        return;
      }

      const syncResult = await ensureServerSubscription(activeSubscription);

      if (!syncResult.ok) {
        throw new Error(syncResult.error || "Server subscription sync failed");
      }

      const result = await postJson<PushApiSummary>(
        "/api/push/test",
        { subscription: activeSubscription.toJSON() },
        getPushAuthHeaders()
      );

      if (!result.ok || (result.successful ?? 0) < 1) {
        throw new Error(result.error || "Test push failed");
      }

      setSubscription(activeSubscription);
      setStatus("subscribed");
      setMessage("Test push verzonden. Check telefoon en gekoppeld horloge.");
    } catch (error) {
      setStatus("error");
      setMessage(`Push send failed: ${formatPushError(error)}`);
    } finally {
      setIsBusy(false);
    }
  };

  async function syncExistingSubscription() {
    try {
      const registration = await registerServiceWorker();
      const existing = await registration.pushManager.getSubscription();

      setSubscription(existing);

      if (Notification.permission === "denied") {
        setStatus("permission-denied");
        setMessage("Notifications zijn geblokkeerd. Pas dit aan in je browserinstellingen.");
        return;
      }

      if (existing) {
        const response = await ensureServerSubscription(existing);

        if (!response.ok) {
          setStatus("error");
          setMessage(
            `Browser subscription bestaat, maar server sync failed: ${
              response.error || "unknown server error"
            }`
          );
          return;
        }

        setStatus("subscribed");
        setMessage("Web Push subscription actief en server-side gesynct.");
        return;
      }

      const response = await postJson<PushApiSummary>(
        "/api/push/status",
        {},
        getPushAuthHeaders()
      ).catch(() => null);

      if (response?.ok) {
        updateServerState(response);
      }

      setStatus(Notification.permission === "default" ? "permission-needed" : "unsubscribed");
      setMessage(
        Notification.permission === "default"
          ? "Zet Web Push aan om fueling alerts op je telefoon te ontvangen."
          : "Push is toegestaan, maar er is geen actieve subscription."
      );
    } catch (error) {
      setStatus("error");
      setMessage(`Service worker registratie mislukt: ${formatPushError(error)}`);
    }
  }

  const httpsHint = getHttpsHint();
  const statusClassName = resolveStatusClassName(status);

  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
            Web Push setup
          </div>
          <div className={`mt-2 w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${statusClassName}`}>
            {formatStatus(status)}
          </div>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
            {message}
          </p>
          <p className="mt-2 max-w-xl text-xs leading-5 text-slate-500">
            Platform: {platform}. Web Push werkt op Android Chrome via HTTPS.
            iOS vereist een geinstalleerde PWA.
          </p>
          <p className="mt-2 max-w-xl text-xs leading-5 text-slate-500">
            Server: {hasServerSubscription ? "registered" : "not registered"}.
            Storage: {serverStorageMode}.
          </p>
          {serverStorageMode === "blob" ? (
            <p className="mt-2 max-w-xl text-xs leading-5 text-emerald-200">
              Blob storage is actief. Alerts blijven persistent over Vercel cold
              starts heen.
            </p>
          ) : null}
          {serverStorageMode === "memory" ? (
            <p className="mt-2 max-w-xl text-xs leading-5 text-amber-200">
              Memory fallback is bruikbaar voor lokale tests. Voeg Vercel Blob toe
              voor persistente delivery.
            </p>
          ) : null}
          {httpsHint ? (
            <p className="mt-2 max-w-xl text-xs leading-5 text-amber-200">
              {httpsHint}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={enablePush}
            disabled={isBusy || status === "unsupported" || status === "permission-denied" || status === "install-required"}
            className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Enable Web Push notification
          </button>
          {status === "subscribed" ? (
            <>
              <button
                type="button"
                onClick={sendTestPush}
                disabled={isBusy}
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Send test push
              </button>
              <button
                type="button"
                onClick={disablePush}
                disabled={isBusy || !subscription}
                className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-300 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Disable Web Push
              </button>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );

  async function ensureServerSubscription(activeSubscription: PushSubscription) {
    const response = await postJson<PushApiSummary>(
      "/api/push/subscribe",
      { subscription: activeSubscription.toJSON() },
      getPushAuthHeaders()
    );

    updateServerState(response);
    return response;
  }

  function updateServerState(response: PushApiSummary) {
    if (response.storageMode) {
      setServerStorageMode(response.storageMode);
    }

    if (typeof response.hasServerSubscription === "boolean") {
      setHasServerSubscription(response.hasServerSubscription);
      return;
    }

    if (response.ok && response.status) {
      setHasServerSubscription(true);
    }
  }
}

function getPushSupport(platform: PushPlatform): {
  isSupported: boolean;
  reason: string;
  status: PushStatus;
} {
  if (typeof window === "undefined") {
    return {
      isSupported: false,
      reason: "Browseromgeving niet beschikbaar.",
      status: "unsupported"
    };
  }

  if (platform === "ios" && !isStandaloneDisplay()) {
    return {
      isSupported: false,
      reason: "Installeer FuelPlan eerst op iOS via Voeg toe aan beginscherm.",
      status: "install-required"
    };
  }

  if (!("serviceWorker" in navigator)) {
    return {
      isSupported: false,
      reason: "Service worker niet beschikbaar.",
      status: "unsupported"
    };
  }

  if (!("PushManager" in window)) {
    return {
      isSupported: false,
      reason: "Browser ondersteunt geen PushManager.",
      status: "unsupported"
    };
  }

  if (!("Notification" in window)) {
    return {
      isSupported: false,
      reason: "Browser ondersteunt geen notifications.",
      status: "unsupported"
    };
  }

  return { isSupported: true, reason: "", status: "permission-needed" };
}

function detectPlatform(): PushPlatform {
  if (typeof window === "undefined") {
    return "unknown";
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIos =
    /iphone|ipad|ipod/.test(userAgent) ||
    (userAgent.includes("mac") && "ontouchend" in document);

  if (isIos) {
    return "ios";
  }

  if (userAgent.includes("android")) {
    return "android";
  }

  return "desktop";
}

function isStandaloneDisplay() {
  if (typeof window === "undefined") {
    return false;
  }

  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean;
  };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

function getHttpsHint() {
  if (typeof window === "undefined") {
    return "";
  }

  const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  if (window.location.protocol !== "https:" && !isLocalhost) {
    return "Echte push op mobile vereist HTTPS. Test dit via de Vercel URL.";
  }

  return "";
}

async function registerServiceWorker() {
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

async function postJson<T>(
  url: string,
  body: unknown,
  extraHeaders: Record<string, string>
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body)
  });

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }

  if (!payload) {
    throw new Error("Invalid JSON response");
  }

  return payload;
}

function getVapidApplicationServerKey() {
  const key = urlBase64ToUint8Array(vapidPublicKey);

  if (key.byteLength !== 65) {
    throw new Error(
      `Invalid VAPID public key (${key.byteLength} bytes). Expected 65 bytes.`
    );
  }

  return key;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

function formatPushError(error: unknown) {
  if (error instanceof DOMException) {
    return `${error.name}: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "unknown error";
}

function recordClientPushTelemetry(event: string) {
  if (process.env.NODE_ENV !== "production") {
    console.info("[fuelplan-push-client]", event);
  }
}

function formatStatus(status: PushStatus) {
  switch (status) {
    case "unsupported":
      return "unsupported";
    case "install-required":
      return "install required";
    case "permission-needed":
      return "permission needed";
    case "permission-denied":
      return "permission denied";
    case "subscribed":
      return "subscribed";
    case "unsubscribed":
      return "unsubscribed";
    case "error":
      return "error";
  }
}

function resolveStatusClassName(status: PushStatus) {
  if (status === "subscribed") {
    return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
  }

  if (status === "permission-needed" || status === "unsubscribed" || status === "install-required") {
    return "border-amber-400/40 bg-amber-400/10 text-amber-200";
  }

  if (status === "permission-denied" || status === "error") {
    return "border-rose-400/40 bg-rose-400/10 text-rose-200";
  }

  return "border-slate-600 bg-slate-900 text-slate-300";
}
