"use client";

import { useEffect, useMemo, useState } from "react";

type PushStatus =
  | "unsupported"
  | "permission-needed"
  | "permission-denied"
  | "subscribed"
  | "unsubscribed"
  | "error";

interface PushApiSummary {
  ok: boolean;
  error?: string;
  total?: number;
  successful?: number;
  failed?: number;
  removed?: number;
}

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export function PushNotificationManager() {
  const [status, setStatus] = useState<PushStatus>("permission-needed");
  const [message, setMessage] = useState("Push status wordt gecontroleerd.");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const support = useMemo(() => getPushSupport(), []);

  useEffect(() => {
    if (!support.isSupported) {
      setStatus("unsupported");
      setMessage(support.reason);
      return;
    }

    if (!vapidPublicKey) {
      setStatus("error");
      setMessage("Geen VAPID public key gevonden.");
      return;
    }

    void syncExistingSubscription();
  }, [support.isSupported, support.reason]);

  const enablePush = async () => {
    setIsBusy(true);
    setMessage("Push permission aanvragen.");

    try {
      if (!support.isSupported) {
        setStatus("unsupported");
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
        setMessage("Push permission geweigerd in de browser.");
        return;
      }

      if (permission !== "granted") {
        setStatus("permission-needed");
        setMessage("Klik Enable om push permission toe te staan.");
        return;
      }

      const registration = await registerServiceWorker();
      const existing = await registration.pushManager.getSubscription();
      const nextSubscription =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        }));

      const response = await postJson<PushApiSummary>(
        "/api/push/subscribe",
        nextSubscription.toJSON()
      );

      if (!response.ok) {
        throw new Error(response.error || "Subscribe failed");
      }

      setSubscription(nextSubscription);
      setStatus("subscribed");
      setMessage("Push actief. Telefoon kan meldingen naar horloge spiegelen.");
    } catch {
      setStatus("error");
      setMessage("Push subscription failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const disablePush = async () => {
    setIsBusy(true);
    setMessage("Push uitschakelen.");

    try {
      const registration = await navigator.serviceWorker.ready;
      const activeSubscription =
        subscription || (await registration.pushManager.getSubscription());

      if (!activeSubscription) {
        setStatus("unsubscribed");
        setMessage("Geen actieve subscription.");
        return;
      }

      await postJson<PushApiSummary>("/api/push/unsubscribe", {
        endpoint: activeSubscription.endpoint
      });
      await activeSubscription.unsubscribe();

      setSubscription(null);
      setStatus("unsubscribed");
      setMessage("Push notifications uitgeschakeld.");
    } catch {
      setStatus("error");
      setMessage("Disable push failed.");
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

      const result = await postJson<PushApiSummary>("/api/push/test", {
        subscription: activeSubscription.toJSON()
      });

      if (!result.ok || (result.successful ?? 0) < 1) {
        throw new Error(result.error || "Test push failed");
      }

      setStatus("subscribed");
      setMessage("Test push verzonden. Check telefoon en gekoppeld horloge.");
    } catch {
      setStatus("error");
      setMessage("Push send failed.");
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
        setMessage("Push permission geweigerd in de browser.");
        return;
      }

      if (existing) {
        setStatus("subscribed");
        setMessage("Push subscription actief.");
        return;
      }

      setStatus(Notification.permission === "default" ? "permission-needed" : "unsubscribed");
      setMessage(
        Notification.permission === "default"
          ? "Klik Enable om push permission toe te staan."
          : "Push is toegestaan, maar er is geen actieve subscription."
      );
    } catch {
      setStatus("error");
      setMessage("Service worker registratie mislukt.");
    }
  }

  const httpsHint = getHttpsHint();
  const statusClassName = resolveStatusClassName(status);

  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
            Push status
          </div>
          <div className={`mt-2 w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${statusClassName}`}>
            {formatStatus(status)}
          </div>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
            {message}
          </p>
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
            disabled={isBusy || status === "unsupported" || status === "permission-denied"}
            className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Enable push notifications
          </button>
          <button
            type="button"
            onClick={sendTestPush}
            disabled={isBusy || status !== "subscribed"}
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
            Disable push notifications
          </button>
        </div>
      </div>
    </section>
  );
}

function getPushSupport() {
  if (typeof window === "undefined") {
    return { isSupported: false, reason: "Browseromgeving niet beschikbaar." };
  }

  if (!("serviceWorker" in navigator)) {
    return { isSupported: false, reason: "Service worker niet beschikbaar." };
  }

  if (!("PushManager" in window)) {
    return { isSupported: false, reason: "Browser ondersteunt geen PushManager." };
  }

  if (!("Notification" in window)) {
    return { isSupported: false, reason: "Browser ondersteunt geen notifications." };
  }

  return { isSupported: true, reason: "" };
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
  const registration = await navigator.serviceWorker.register("/sw.js");
  return registration;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  return response.json() as Promise<T>;
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

function formatStatus(status: PushStatus) {
  switch (status) {
    case "unsupported":
      return "unsupported";
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

  if (status === "permission-needed" || status === "unsubscribed") {
    return "border-amber-400/40 bg-amber-400/10 text-amber-200";
  }

  if (status === "permission-denied" || status === "error") {
    return "border-rose-400/40 bg-rose-400/10 text-rose-200";
  }

  return "border-slate-600 bg-slate-900 text-slate-300";
}
