"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { PushNotificationManager } from "@/components/PushNotificationManager";
import { getPushAuthHeaders } from "@/lib/push/clientIdentity";

type BrowserNotificationStatus =
  | "unsupported"
  | "permission-needed"
  | "permission-granted"
  | "permission-denied";

type SessionStatus = "idle" | "session-running" | "session-finished";
type DeliveryStatus = "pending" | "sent" | "failed";

interface DemoTimelineEvent {
  id: string;
  triggerAtSec: number;
  type: string;
  title: string;
  body: string;
  tag: string;
}

interface EventDeliveryState {
  browser: DeliveryStatus;
  webPush: DeliveryStatus;
}

interface PushSendResponse {
  ok: boolean;
  error?: string;
  successful?: number;
}

const demoTimeline: DemoTimelineEvent[] = [
  {
    id: "drink-10",
    triggerAtSec: 10,
    type: "Drink",
    title: "Drink now",
    body: "Drink 150-200ml water.",
    tag: "fuelplan-drink-10"
  },
  {
    id: "fuel-30",
    triggerAtSec: 30,
    type: "Fuel",
    title: "Fuel now",
    body: "Neem 25g carbs.",
    tag: "fuelplan-fuel-30"
  },
  {
    id: "drink-60",
    triggerAtSec: 60,
    type: "Drink",
    title: "Drink now",
    body: "Drink opnieuw enkele slokken.",
    tag: "fuelplan-drink-60"
  },
  {
    id: "energy-90",
    triggerAtSec: 90,
    type: "Check",
    title: "Energy check",
    body: "Voel je een dip? Neem extra carbs.",
    tag: "fuelplan-energy-90"
  },
  {
    id: "fuel-120",
    triggerAtSec: 120,
    type: "Fuel",
    title: "Fuel now",
    body: "Neem 25g carbs indien intensiteit hoog blijft.",
    tag: "fuelplan-fuel-120"
  }
];

const finalTriggerAtSec = demoTimeline[demoTimeline.length - 1].triggerAtSec;

export function LiveSessionClient() {
  const [browserStatus, setBrowserStatus] =
    useState<BrowserNotificationStatus>("permission-needed");
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("idle");
  const [message, setMessage] = useState(
    "Open deze pagina op je telefoon en zet minstens een van beide notification routes aan."
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [eventStatuses, setEventStatuses] = useState<
    Record<string, EventDeliveryState>
  >(() => createInitialStatuses());

  const timeoutIdsRef = useRef<number[]>([]);
  const intervalIdRef = useRef<number | null>(null);
  const startedAtMsRef = useRef<number | null>(null);

  useEffect(() => {
    updateBrowserStatusFromPermission();
    return () => clearSessionTimers({ skipState: true });
  }, []);

  const nextEvent = useMemo(() => {
    return (
      demoTimeline.find((event) => {
        const state = eventStatuses[event.id];
        const stillPending = state.browser === "pending" || state.webPush === "pending";
        return stillPending && (!isSessionRunning(sessionStatus) || event.triggerAtSec > elapsedSeconds);
      }) || null
    );
  }, [elapsedSeconds, eventStatuses, sessionStatus]);

  const secondsToNextAction = nextEvent
    ? Math.max(0, nextEvent.triggerAtSec - elapsedSeconds)
    : 0;

  const enableBrowserNotifications = async () => {
    if (!isNotificationSupported()) {
      setBrowserStatus("unsupported");
      setMessage("Browser notifications worden niet ondersteund op dit toestel.");
      return false;
    }

    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      setBrowserStatus("permission-granted");
      setMessage("Niveau 1 staat aan. Test nu telefoon en horloge.");
      return true;
    }

    if (permission === "denied") {
      setBrowserStatus("permission-denied");
      setMessage("Notifications zijn geblokkeerd. Pas dit aan in je browserinstellingen.");
      return false;
    }

    setBrowserStatus("permission-needed");
    setMessage("Zet notificaties aan om live fueling alerts te testen.");
    return false;
  };

  const sendBrowserTestNotification = async () => {
    if (!isNotificationSupported()) {
      setBrowserStatus("unsupported");
      setMessage("Browser notifications worden niet ondersteund op dit toestel.");
      return;
    }

    if (Notification.permission !== "granted") {
      const isEnabled = await enableBrowserNotifications();

      if (!isEnabled) {
        return;
      }
    }

    const wasSent = await sendBrowserNotification(
      "FuelPlan test",
      "Als je dit op je horloge ziet, werkt de MVP-route.",
      "fuelplan-browser-test"
    );

    if (wasSent) {
      setMessage("Niveau 1 testnotification verzonden.");
      setBrowserStatus("permission-granted");
      return;
    }

    updateBrowserStatusFromPermission();
    setMessage("Zet notifications aan voor de browser test.");
  };

  const startDemoSession = () => {
    clearSessionTimers();
    setElapsedSeconds(0);
    setSessionStatus("session-running");
    setEventStatuses(createInitialStatuses());
    setMessage("Demo session loopt. Niveau 1 en Niveau 2 proberen elke trigger te verzenden.");
    startedAtMsRef.current = Date.now();

    intervalIdRef.current = window.setInterval(() => {
      if (!startedAtMsRef.current) {
        return;
      }

      const nextElapsedSeconds = Math.floor(
        (Date.now() - startedAtMsRef.current) / 1000
      );
      setElapsedSeconds(nextElapsedSeconds);

      if (nextElapsedSeconds >= finalTriggerAtSec + 2) {
        setSessionStatus("session-finished");
        setMessage("Demo session finished. Check telefoon en horloge.");
        clearSessionTimers({ keepRunningState: true });
      }
    }, 1000);

    demoTimeline.forEach((event) => {
      const timeoutId = window.setTimeout(() => {
        void sendTimelineEvent(event);
      }, event.triggerAtSec * 1000);

      timeoutIdsRef.current.push(timeoutId);
    });
  };

  const resetSession = () => {
    clearSessionTimers();
    setElapsedSeconds(0);
    setSessionStatus("idle");
    setEventStatuses(createInitialStatuses());
    updateBrowserStatusFromPermission();
    setMessage("Session reset. Start opnieuw wanneer je telefoon en horloge klaar zijn.");
  };

  const sendTimelineEvent = async (event: DemoTimelineEvent) => {
    const browserSent = await sendBrowserNotification(
      event.title,
      event.body,
      event.tag
    );

    setEventStatuses((current) => ({
      ...current,
      [event.id]: {
        ...current[event.id],
        browser: browserSent ? "sent" : "failed"
      }
    }));

    const webPushSent = await sendWebPushNotification(event);

    setEventStatuses((current) => ({
      ...current,
      [event.id]: {
        ...current[event.id],
        webPush: webPushSent ? "sent" : "failed"
      }
    }));

    setMessage(
      `${event.title}: Niveau 1 ${browserSent ? "sent" : "failed"}, Niveau 2 ${
        webPushSent ? "sent" : "failed"
      }.`
    );
  };

  function updateBrowserStatusFromPermission() {
    if (!isNotificationSupported()) {
      setBrowserStatus("unsupported");
      setMessage("Browser notifications worden niet ondersteund op dit toestel.");
      return;
    }

    if (Notification.permission === "granted") {
      setBrowserStatus("permission-granted");
      return;
    }

    if (Notification.permission === "denied") {
      setBrowserStatus("permission-denied");
      setMessage("Notifications zijn geblokkeerd. Pas dit aan in je browserinstellingen.");
      return;
    }

    setBrowserStatus("permission-needed");
  }

  function clearSessionTimers(
    options: { keepRunningState?: boolean; skipState?: boolean } = {}
  ) {
    timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutIdsRef.current = [];

    if (intervalIdRef.current !== null) {
      window.clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    startedAtMsRef.current = null;

    if (!options.keepRunningState && !options.skipState) {
      setSessionStatus("idle");
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-300">
              Notification MVP
            </div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-50">
              Live Fuel Coach
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Open deze pagina in Chrome op Android. Niveau 1 gebruikt Android-
              compatibele service-worker notifications zolang de pagina actief
              is. Niveau 2 gebruikt Web Push via Vercel met een device-scoped
              subscription. Als je horloge telefoonmeldingen spiegelt, verschijnen
              de alerts ook op je horloge.
            </p>
          </div>
          <a
            href="/"
            className="w-fit rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-slate-200"
          >
            Dashboard
          </a>
        </header>

        <PwaInstallPrompt />

        <section className="grid gap-5 xl:grid-cols-2">
          <NotificationRouteCard
            eyebrow="Niveau 1"
            title="Browser notifications"
            status={browserStatus}
            message={
              browserStatus === "permission-granted"
                ? "Directe notifications staan aan. Pagina moet open blijven."
                : browserStatus === "permission-denied"
                  ? "Notifications zijn geblokkeerd. Pas dit aan in je browserinstellingen."
                  : browserStatus === "unsupported"
                    ? "Browser notifications worden niet ondersteund op dit toestel."
                    : "Zet notificaties aan om live fueling alerts te testen."
            }
          >
            <ActionButton onClick={enableBrowserNotifications}>
              Enable notifications
            </ActionButton>
            <ActionButton onClick={sendBrowserTestNotification}>
              Send test notification
            </ActionButton>
          </NotificationRouteCard>

          <div>
            <PushNotificationManager />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                Combined session
              </div>
              <div className={`mt-2 w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${resolveSessionStatusClassName(sessionStatus)}`}>
                {sessionStatus}
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                {message}
              </p>
              <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">
                Voor Niveau 1 moet deze pagina open blijven. Voor Niveau 2 moet
                Web Push subscribed zijn; Vercel verstuurt alleen vaste
                FuelPlan event-types naar jouw eigen device subscription.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[360px]">
              <ActionButton
                onClick={startDemoSession}
                disabled={isSessionRunning(sessionStatus)}
              >
                Start demo session
              </ActionButton>
              <ActionButton onClick={resetSession}>Reset session</ActionButton>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-5">
            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
              Session timer
            </div>
            <div className="mt-3 text-5xl font-semibold text-slate-50">
              {formatElapsed(elapsedSeconds)}
            </div>
            <div className="mt-2 text-sm text-slate-500">
              {isSessionRunning(sessionStatus) ? "Session running" : "Ready"}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-5">
            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
              Next action
            </div>
            <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
              <div className="text-2xl font-semibold text-slate-50">
                {nextEvent ? nextEvent.title : "Session finished"}
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-400">
                {nextEvent
                  ? `${nextEvent.body} Over ${secondsToNextAction}s.`
                  : "Alle demo alerts zijn verwerkt."}
              </div>
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-slate-300">
                {isSessionRunning(sessionStatus)
                  ? "Volgende actie volgt straks"
                  : "Start de demo session voor live triggers."}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-5">
          <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
            Fuel timeline
          </div>
          <div className="mt-1 text-sm text-slate-400">
            Snelle testtriggers op 10s, 30s, 60s, 90s en 120s. Elke trigger
            probeert Niveau 1 en Niveau 2 te verzenden.
          </div>

          <div className="mt-5 grid gap-3">
            {demoTimeline.map((event) => (
              <TimelineRow
                key={event.id}
                event={event}
                status={eventStatuses[event.id]}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function NotificationRouteCard({
  children,
  eyebrow,
  message,
  status,
  title
}: {
  children: ReactNode;
  eyebrow: string;
  message: string;
  status: string;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
            {eyebrow}
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-100">{title}</div>
          <div className={`mt-2 w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${resolveBrowserStatusClassName(status)}`}>
            {status}
          </div>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
            {message}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">{children}</div>
      </div>
    </section>
  );
}

function ActionButton({
  children,
  disabled,
  onClick
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void | Promise<unknown>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  );
}

function TimelineRow({
  event,
  status
}: {
  event: DemoTimelineEvent;
  status: EventDeliveryState;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 lg:grid-cols-[80px_90px_minmax(0,1fr)_120px_120px] lg:items-center">
      <div className="text-sm font-semibold text-cyan-200">
        {formatElapsed(event.triggerAtSec)}
      </div>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {event.type}
      </div>
      <div className="font-semibold text-slate-100">{event.body}</div>
      <DeliveryPill label="N1" status={status.browser} />
      <DeliveryPill label="N2" status={status.webPush} />
    </div>
  );
}

function DeliveryPill({
  label,
  status
}: {
  label: "N1" | "N2";
  status: DeliveryStatus;
}) {
  return (
    <div className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${resolveDeliveryStatusClassName(status)}`}>
      {label} {status}
    </div>
  );
}

async function sendBrowserNotification(title: string, body: string, tag: string) {
  if (!isNotificationSupported() || Notification.permission !== "granted") {
    return false;
  }

  try {
    if ("serviceWorker" in navigator) {
      const registration = await registerServiceWorker();
      await registration.showNotification(title, {
        body,
        tag,
        icon: "/icons/fuelplan-icon-192.png",
        badge: "/icons/fuelplan-badge.svg",
        data: { url: "/live-session" },
        requireInteraction: true
      });
      return true;
    }

    new Notification(title, {
      body,
      tag,
      requireInteraction: true
    });
    return true;
  } catch {
    return false;
  }
}

async function sendWebPushNotification(event: DemoTimelineEvent) {
  try {
    const subscription = await getActivePushSubscription();

    if (!subscription) {
      return false;
    }

    const response = await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getPushAuthHeaders() },
      body: JSON.stringify({
        eventType: event.id
      })
    });
    const result = (await response.json()) as PushSendResponse;

    return Boolean(result.ok && (result.successful ?? 0) > 0);
  } catch {
    return false;
  }
}

async function getActivePushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }

  const registration = await registerServiceWorker();
  return registration.pushManager.getSubscription();
}

async function registerServiceWorker() {
  const registration = await navigator.serviceWorker.register("/sw.js");
  return registration;
}

function createInitialStatuses() {
  return demoTimeline.reduce<Record<string, EventDeliveryState>>((result, event) => {
    result[event.id] = {
      browser: "pending",
      webPush: "pending"
    };
    return result;
  }, {});
}

function isNotificationSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

function isSessionRunning(status: SessionStatus) {
  return status === "session-running";
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;

  return `${minutes}:${restSeconds.toString().padStart(2, "0")}`;
}

function resolveBrowserStatusClassName(status: string) {
  if (status === "permission-granted") {
    return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
  }

  if (status === "permission-needed") {
    return "border-amber-400/40 bg-amber-400/10 text-amber-200";
  }

  if (status === "permission-denied" || status === "unsupported") {
    return "border-rose-400/40 bg-rose-400/10 text-rose-200";
  }

  return "border-slate-600 bg-slate-900 text-slate-300";
}

function resolveSessionStatusClassName(status: SessionStatus) {
  if (status === "session-running") {
    return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
  }

  if (status === "session-finished") {
    return "border-cyan-400/40 bg-cyan-400/10 text-cyan-200";
  }

  return "border-slate-700 bg-slate-900 text-slate-300";
}

function resolveDeliveryStatusClassName(status: DeliveryStatus) {
  if (status === "sent") {
    return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
  }

  if (status === "failed") {
    return "border-rose-400/40 bg-rose-400/10 text-rose-200";
  }

  return "border-slate-700 bg-slate-900 text-slate-300";
}
