"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { PushNotificationManager } from "@/components/PushNotificationManager";
import { getPushAuthHeaders } from "@/lib/push/clientIdentity";
import { useFuelingSession } from "@/state/useFuelingSession";
import type { FuelingCoreTrigger } from "@/types/fuelingCore";

type BrowserNotificationStatus =
  | "unsupported"
  | "permission-needed"
  | "permission-granted"
  | "permission-denied";
type DeliveryStatus = "pending" | "sent" | "failed" | "skipped";
type ServerEventStatus = "scheduled" | "sent" | "failed" | "skipped" | "cancelled";

interface EventDeliveryState {
  browser: DeliveryStatus;
}

interface ServerSessionEvent {
  eventId: string;
  eventType: string;
  title: string;
  body: string;
  tag: string;
  triggerAt: number;
  delaySeconds: number;
  status: ServerEventStatus;
  qstashMessageId?: string;
  attempts: number;
  lastError?: string;
}

interface ServerSessionStatusResponse {
  ok: boolean;
  error?: string;
  storageMode?: "blob" | "upstash" | "memory";
  pushStorageMode?: "blob" | "upstash" | "memory";
  readiness?: {
    ok: boolean;
    missing: string[];
    hasActiveSubscription?: boolean;
    storageMode: string;
    pushStorageMode: string;
  };
  session?: {
    sessionId: string;
    status: "active" | "stopped" | "finished" | "expired";
    events: ServerSessionEvent[];
  };
  sentCount?: number;
  failedCount?: number;
  nextEvent?: ServerSessionEvent | null;
}

interface ServerSessionStartResponse {
  ok: boolean;
  error?: string;
  sessionId?: string;
  storageMode?: string;
  scheduledEventCount?: number;
  events?: ServerSessionEvent[];
}

export function LiveSessionClient() {
  const session = useFuelingSession({ mode: "live" });
  const [browserStatus, setBrowserStatus] =
    useState<BrowserNotificationStatus>("permission-needed");
  const [message, setMessage] = useState(
    "Laad een actieve sessie vanaf het dashboard en zet notifications aan."
  );
  const [eventStatuses, setEventStatuses] = useState<
    Record<string, EventDeliveryState>
  >({});
  const [serverSessionId, setServerSessionId] = useState<string | null>(null);
  const [serverStatus, setServerStatus] =
    useState<ServerSessionStatusResponse | null>(null);
  const [serverMessage, setServerMessage] = useState("Level 2 nog niet gestart.");
  const [isStartingServerSession, setIsStartingServerSession] = useState(false);

  useEffect(() => {
    updateBrowserStatusFromPermission();
    void refreshServerStatus();
  }, []);

  useEffect(() => {
    if (!session.calculatedFuelingPlan) {
      setEventStatuses({});
      return;
    }

    setEventStatuses(createInitialStatuses(session.calculatedFuelingPlan.triggers));
  }, [session.calculatedFuelingPlan]);

  useEffect(() => {
    if (!serverSessionId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshServerStatus(serverSessionId);
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [serverSessionId]);

  const dueTrigger = useMemo(() => {
    if (!session.calculatedFuelingPlan || !session.isRunning) {
      return null;
    }

    return (
      session.calculatedFuelingPlan.triggers.find(
        (trigger) =>
          trigger.minute <= session.elapsedMinute &&
          !session.firedTriggerMinutes.includes(trigger.minute)
      ) ?? null
    );
  }, [
    session.calculatedFuelingPlan,
    session.elapsedMinute,
    session.firedTriggerMinutes,
    session.isRunning
  ]);

  useEffect(() => {
    if (!dueTrigger) {
      return;
    }

    session.markTriggerFired(dueTrigger.minute);
    void sendLevel1FuelingTrigger(dueTrigger);
  }, [dueTrigger]);

  const nextTrigger = useMemo(() => {
    if (!session.calculatedFuelingPlan) {
      return null;
    }

    return (
      session.calculatedFuelingPlan.triggers.find(
        (trigger) => !session.firedTriggerMinutes.includes(trigger.minute)
      ) ?? null
    );
  }, [session.calculatedFuelingPlan, session.firedTriggerMinutes]);

  const secondsToNextAction = nextTrigger
    ? Math.max(0, nextTrigger.minute * 60 - session.elapsedSeconds)
    : 0;
  const hasActiveSession =
    session.calculationStatus === "ready" && Boolean(session.calculatedFuelingPlan);
  const readiness = serverStatus?.readiness;
  const serverEvents = serverStatus?.session?.events ?? [];
  const nextServerEvent = serverStatus?.nextEvent ?? null;

  const enableBrowserNotifications = async () => {
    if (!isNotificationSupported()) {
      setBrowserStatus("unsupported");
      setMessage("Browser notifications worden niet ondersteund op dit toestel.");
      return false;
    }

    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      setBrowserStatus("permission-granted");
      setMessage("Browser notifications staan aan.");
      void refreshServerStatus(serverSessionId ?? undefined);
      return true;
    }

    if (permission === "denied") {
      setBrowserStatus("permission-denied");
      setMessage("Notifications zijn geblokkeerd. Pas dit aan in je browserinstellingen.");
      return false;
    }

    setBrowserStatus("permission-needed");
    setMessage("Zet notificaties aan om live fueling alerts te ontvangen.");
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
      "Als je dit op je horloge ziet, werkt de telefoonmelding-route.",
      "fuelplan-browser-test"
    );

    setMessage(
      wasSent
        ? "Testnotification verzonden."
        : "Zet notifications aan voor de browser test."
    );
    updateBrowserStatusFromPermission();
  };

  const resetSession = () => {
    session.resetSession();
    setMessage("Live session reset.");
  };

  async function startLevel2ServerSession() {
    if (!session.calculatedFuelingPlan) {
      setServerMessage("Geen fueling timeline beschikbaar.");
      return;
    }

    setIsStartingServerSession(true);
    setServerMessage("Server session wordt gepland via QStash.");

    try {
      const response = await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getPushAuthHeaders() },
        body: JSON.stringify({
          timeline: session.calculatedFuelingPlan.triggers.map((trigger) => ({
            minute: trigger.minute,
            eventType: "carb",
            title: trigger.title,
            body: trigger.body,
            tag: trigger.tag,
            url: "/live-session"
          }))
        })
      });
      const result = (await response.json()) as ServerSessionStartResponse;

      if (!response.ok || !result.ok || !result.sessionId) {
        throw new Error(result.error || "Level 2 server session start failed");
      }

      setServerSessionId(result.sessionId);
      setServerMessage(
        `Level 2 actief: ${result.scheduledEventCount ?? 0} events gepland.`
      );
      setServerStatus({
        ok: true,
        storageMode: result.storageMode as "blob" | "upstash" | "memory" | undefined,
        session: {
          sessionId: result.sessionId,
          status: "active",
          events: result.events ?? []
        }
      });
      void refreshServerStatus(result.sessionId);
    } catch (error) {
      setServerMessage(
        error instanceof Error ? error.message : "Level 2 server session start failed"
      );
      void refreshServerStatus();
    } finally {
      setIsStartingServerSession(false);
    }
  }

  async function stopLevel2ServerSession() {
    if (!serverSessionId) {
      return;
    }

    try {
      const response = await fetch("/api/session/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getPushAuthHeaders() },
        body: JSON.stringify({ sessionId: serverSessionId })
      });
      const result = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Stop server session failed");
      }

      setServerMessage("Level 2 server session gestopt.");
      void refreshServerStatus(serverSessionId);
    } catch (error) {
      setServerMessage(error instanceof Error ? error.message : "Stop server session failed");
    }
  }

  async function refreshServerStatus(sessionId?: string) {
    try {
      const url = sessionId
        ? `/api/session/status?sessionId=${encodeURIComponent(sessionId)}`
        : "/api/session/status";
      const response = await fetch(url, {
        method: "GET",
        headers: getPushAuthHeaders()
      });
      const result = (await response.json()) as ServerSessionStatusResponse;

      setServerStatus(result);

      if (!response.ok || !result.ok) {
        setServerMessage(result.error || "Server status kon niet worden geladen.");
      }
    } catch {
      setServerMessage("Server status kon niet worden geladen.");
    }
  }

  async function sendLevel1FuelingTrigger(trigger: FuelingCoreTrigger) {
    const browserSent = await sendBrowserNotification(
      trigger.title,
      trigger.body,
      trigger.tag
    );

    setEventStatuses((current) => ({
      ...current,
      [trigger.minute]: {
        ...(current[trigger.minute] ?? { browser: "pending" }),
        browser: browserSent ? "sent" : "failed"
      }
    }));

    setMessage(
      `${trigger.title}: Level 1 browser notification ${
        browserSent ? "sent" : "failed"
      }.`
    );
  }

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

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-300">
              Live PWA coach
            </div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-50">
              Live Fuel Coach
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Level 1 gebruikt browsermeldingen zolang deze pagina actief is.
              Level 2 plant Web Push server-side via QStash, zodat telefoon en
              horloge-alerts niet afhankelijk zijn van een open browser.
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
            eyebrow="Level 1"
            title="Browser open required"
            status={browserStatus}
            message={
              browserStatus === "permission-granted"
                ? "Directe browser notifications staan aan. Deze route stopt als de tab of PWA niet meer actief draait."
                : browserStatus === "permission-denied"
                  ? "Notifications zijn geblokkeerd. Pas dit aan in je browserinstellingen."
                  : browserStatus === "unsupported"
                    ? "Browser notifications worden niet ondersteund op dit toestel."
                    : "Zet notificaties aan om lokale Level 1 alerts te ontvangen."
            }
          >
            <ActionButton onClick={enableBrowserNotifications}>
              Enable notifications
            </ActionButton>
            <ActionButton onClick={sendBrowserTestNotification}>
              Send test notification
            </ActionButton>
          </NotificationRouteCard>

          <PushNotificationManager />
        </section>

        <ServerReadinessPanel
          browserStatus={browserStatus}
          readiness={readiness}
          storageMode={serverStatus?.storageMode}
        />

        {!hasActiveSession ? (
          <section className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5">
            <div className="text-lg font-semibold text-amber-100">
              Geen actieve sessie
            </div>
            <p className="mt-2 text-sm leading-6 text-amber-100/80">
              Ga naar dashboard en start een sessie.
            </p>
            {session.calculationError ? (
              <p className="mt-2 text-sm text-amber-100/70">
                {session.calculationError}
              </p>
            ) : null}
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                    Active session
                  </div>
                  <div className={`mt-2 w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${resolveSessionStatusClassName(session.liveSessionStatus)}`}>
                    {session.liveSessionStatus}
                  </div>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                    {message}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[360px]">
                  <ActionButton
                    onClick={session.startSession}
                    disabled={session.isRunning}
                  >
                    Start live session
                  </ActionButton>
                  <ActionButton onClick={resetSession}>Reset session</ActionButton>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-300">
                    Level 2 server scheduled Web Push
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-100">
                    {serverSessionId ? `Session ${serverSessionId}` : "Geen server session"}
                  </div>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                    {serverMessage}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Level 2 gebruikt QStash delayed events. Na start mag de telefoon
                    locken en mag deze browser sluiten.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[380px]">
                  <ActionButton
                    onClick={startLevel2ServerSession}
                    disabled={isStartingServerSession}
                  >
                    Start Level 2 server session
                  </ActionButton>
                  <ActionButton
                    onClick={stopLevel2ServerSession}
                    disabled={!serverSessionId}
                  >
                    Stop Level 2
                  </ActionButton>
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <Metric label="Storage" value={serverStatus?.storageMode ?? "unknown"} />
                <Metric
                  label="Scheduled"
                  value={String(serverEvents.filter((event) => event.status === "scheduled").length)}
                />
                <Metric
                  label="Next server event"
                  value={
                    nextServerEvent
                      ? `${formatTimeDistance(nextServerEvent.triggerAt)} · ${nextServerEvent.tag}`
                      : "none"
                  }
                />
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-5">
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                  Session timer
                </div>
                <div className="mt-3 text-5xl font-semibold text-slate-50">
                  {formatElapsed(session.elapsedSeconds)}
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  {session.isRunning ? "Level 1 running" : "Ready"}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-5">
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                  Next Level 1 action
                </div>
                <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                  <div className="text-2xl font-semibold text-slate-50">
                    {nextTrigger ? nextTrigger.title : "Session finished"}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-400">
                    {nextTrigger
                      ? `${nextTrigger.body}. Over ${formatElapsed(secondsToNextAction)}.`
                      : "Alle carb alerts uit de fueling timeline zijn verwerkt."}
                  </div>
                  <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-slate-300">
                    {nextTrigger
                      ? `Trigger minute ${nextTrigger.minute} · ${nextTrigger.tag}`
                      : "Geen volgende carb-trigger."}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-5">
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                Fuel timeline
              </div>
              <div className="mt-1 text-sm text-slate-400">
                Carb triggers komen rechtstreeks uit Python time_for_carbs.
              </div>

              <div className="mt-5 grid gap-3">
                {session.calculatedFuelingPlan?.triggers.map((trigger) => (
                  <TimelineRow
                    key={trigger.tag}
                    trigger={trigger}
                    status={eventStatuses[trigger.minute] ?? { browser: "pending" }}
                    serverEvent={serverEvents.find((event) => event.tag === trigger.tag)}
                  />
                ))}
              </div>
            </section>

            <WatchReadinessChecklist />
          </>
        )}
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

function ServerReadinessPanel({
  browserStatus,
  readiness,
  storageMode
}: {
  browserStatus: BrowserNotificationStatus;
  readiness?: ServerSessionStatusResponse["readiness"];
  storageMode?: string;
}) {
  const warnings = [
    storageMode === "memory" ? "Storage mode is memory. Level 2 production blokkeert dit." : "",
    browserStatus === "permission-denied" ? "Notification permission is denied." : "",
    readiness && !readiness.hasActiveSubscription ? "Geen actieve server PushSubscription." : "",
    ...(readiness?.missing ?? []).map((item) => `Ontbreekt: ${item}`)
  ].filter(Boolean);

  if (warnings.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5">
      <div className="text-[10px] uppercase tracking-[0.22em] text-amber-200">
        Level 2 readiness
      </div>
      <div className="mt-2 text-lg font-semibold text-amber-100">
        Controleer server push setup
      </div>
      <div className="mt-3 grid gap-2">
        {warnings.map((warning) => (
          <div key={warning} className="text-sm text-amber-100/85">
            {warning}
          </div>
        ))}
      </div>
    </section>
  );
}

function WatchReadinessChecklist() {
  const items = [
    "Android Chrome notifications allowed.",
    "Site notifications visible on lock screen.",
    "Galaxy Wearable/Wear OS notification mirroring enabled for Chrome/PWA.",
    "Battery saver disabled.",
    "Do Not Disturb disabled.",
    "First test phone notification, then watch mirroring."
  ];

  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-5">
      <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
        Watch readiness checklist
      </div>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <label key={item} className="flex gap-3 text-sm text-slate-300">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-cyan-300" />
            <span>{item}</span>
          </label>
        ))}
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-slate-100">
        {value}
      </div>
    </div>
  );
}

function TimelineRow({
  serverEvent,
  status,
  trigger
}: {
  trigger: FuelingCoreTrigger;
  status: EventDeliveryState;
  serverEvent?: ServerSessionEvent;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 lg:grid-cols-[80px_minmax(0,1fr)_130px_130px] lg:items-center">
      <div className="text-sm font-semibold text-cyan-200">
        {trigger.minute} min
      </div>
      <div>
        <div className="font-semibold text-slate-100">{trigger.body}</div>
        <div className="mt-1 text-xs text-slate-500">
          Reservoir {Math.round(trigger.carbReservoirG)}g · {trigger.tag}
        </div>
      </div>
      <DeliveryPill label="Level 1" status={status.browser} />
      <ServerStatusPill status={serverEvent?.status ?? "scheduled"} />
    </div>
  );
}

function DeliveryPill({
  label,
  status
}: {
  label: "Level 1";
  status: DeliveryStatus;
}) {
  return (
    <div className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${resolveDeliveryStatusClassName(status)}`}>
      {label} {status}
    </div>
  );
}

function ServerStatusPill({ status }: { status: ServerEventStatus }) {
  return (
    <div className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${resolveServerEventStatusClassName(status)}`}>
      Level 2 {status}
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

async function registerServiceWorker() {
  return navigator.serviceWorker.register("/sw.js");
}

function createInitialStatuses(triggers: FuelingCoreTrigger[]) {
  return triggers.reduce<Record<string, EventDeliveryState>>((result, trigger) => {
    result[trigger.minute] = {
      browser: "pending"
    };
    return result;
  }, {});
}

function isNotificationSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;

  return `${minutes}:${restSeconds.toString().padStart(2, "0")}`;
}

function formatTimeDistance(timestamp: number) {
  const seconds = Math.max(0, Math.round((timestamp - Date.now()) / 1000));
  return formatElapsed(seconds);
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

function resolveSessionStatusClassName(status: string) {
  if (status === "running") {
    return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
  }

  if (status === "finished") {
    return "border-cyan-400/40 bg-cyan-400/10 text-cyan-200";
  }

  if (status === "paused") {
    return "border-amber-400/40 bg-amber-400/10 text-amber-200";
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

  if (status === "skipped") {
    return "border-slate-700 bg-slate-900 text-slate-300";
  }

  return "border-slate-700 bg-slate-900 text-slate-300";
}

function resolveServerEventStatusClassName(status: ServerEventStatus) {
  if (status === "sent") {
    return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
  }

  if (status === "failed") {
    return "border-rose-400/40 bg-rose-400/10 text-rose-200";
  }

  if (status === "cancelled" || status === "skipped") {
    return "border-slate-700 bg-slate-900 text-slate-300";
  }

  return "border-cyan-400/40 bg-cyan-400/10 text-cyan-200";
}
