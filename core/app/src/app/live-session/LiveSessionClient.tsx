"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { PushNotificationManager } from "@/components/PushNotificationManager";
import { getPushAuthHeaders } from "@/lib/push/clientIdentity";
import { useFuelingSession } from "@/state/useFuelingSession";
import type { FuelingCoreTrigger } from "@/types/fuelingCore";

type ServerEventStatus = "scheduled" | "sent" | "failed" | "skipped" | "cancelled";
type ServerEventDisplayStatus = ServerEventStatus | "pending";
type CoachSessionStatus = "not active" | "ready" | "running" | "completed" | "error";

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
  scheduledCount?: number;
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
  failedScheduleCount?: number;
  scheduleErrors?: string[];
  events?: ServerSessionEvent[];
}

export function LiveSessionClient() {
  const session = useFuelingSession({ mode: "live" });
  const [serverSessionId, setServerSessionId] = useState<string | null>(null);
  const [serverStatus, setServerStatus] =
    useState<ServerSessionStatusResponse | null>(null);
  const [serverMessage, setServerMessage] = useState(
    "Activeer Web Push en start daarna een sessie."
  );
  const [isStartingServerSession, setIsStartingServerSession] = useState(false);

  useEffect(() => {
    void refreshServerStatus();
  }, []);

  useEffect(() => {
    if (!serverSessionId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshServerStatus(serverSessionId);
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [serverSessionId]);

  const nextTrigger = useMemo(() => {
    if (!session.calculatedFuelingPlan) {
      return null;
    }

    return (
      session.calculatedFuelingPlan.triggers.find(
        (trigger) => trigger.minute * 60 >= session.elapsedSeconds
      ) ?? null
    );
  }, [session.calculatedFuelingPlan, session.elapsedSeconds]);

  const secondsToNextAction = nextTrigger
    ? Math.max(0, nextTrigger.minute * 60 - session.elapsedSeconds)
    : 0;
  const hasActiveSession =
    session.calculationStatus === "ready" && Boolean(session.calculatedFuelingPlan);
  const readiness = serverStatus?.readiness;
  const serverEvents = serverStatus?.session?.events ?? [];
  const serverEventCounts = summarizeServerEvents(serverEvents);
  const nextServerEvent = serverStatus?.nextEvent ?? null;
  const canStartServerSession =
    hasActiveSession &&
    Boolean(readiness?.hasActiveSubscription) &&
    Boolean(readiness?.ok) &&
    !isStartingServerSession;
  const coachStatus = resolveCoachSessionStatus({
    calculationStatus: session.calculationStatus,
    isRunning: session.isRunning,
    isCompleted: session.isCompleted,
    hasActiveSession
  });

  const resetSession = () => {
    session.resetSession();
    setServerSessionId(null);
    setServerStatus(null);
    setServerMessage("Sessie gereset. Activeer Web Push en start opnieuw.");
    void refreshServerStatus();
  };

  async function startDemoSession() {
    if (!session.calculatedFuelingPlan) {
      setServerMessage("Geen fueling timeline beschikbaar.");
      return;
    }

    if (!readiness?.hasActiveSubscription) {
      setServerMessage("Activeer eerst Web Push zodat alerts naar dit toestel kunnen.");
      return;
    }

    if (!readiness.ok) {
      setServerMessage(
        `Serverconfig is nog niet klaar: ${readiness.missing.join(", ")}.`
      );
      return;
    }

    setIsStartingServerSession(true);
    setServerMessage("Sessie wordt gepland.");

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

      if (result.sessionId && result.events) {
        setServerSessionId(result.sessionId);
        setServerStatus({
          ok: result.ok,
          error: result.error,
          storageMode: result.storageMode as "blob" | "upstash" | "memory" | undefined,
          session: {
            sessionId: result.sessionId,
            status: result.ok ? "active" : "stopped",
            events: result.events
          },
          scheduledCount: result.scheduledEventCount ?? 0,
          failedCount: result.failedScheduleCount ?? 0,
          sentCount: 0,
          nextEvent:
            result.events.find((event) => event.status === "scheduled") ?? null
        });
      }

      if (!result.sessionId) {
        throw new Error(result.error || "Sessie starten is mislukt.");
      }

      if (!response.ok || !result.ok) {
        const detail = result.scheduleErrors?.length
          ? `: ${result.scheduleErrors[0]}`
          : "";
        setServerMessage(`${result.error || "Sessie starten is mislukt"}${detail}`);
        return;
      }

      if ((result.scheduledEventCount ?? 0) === 0) {
        setServerMessage("Er zijn geen alerts gepland.");
      } else {
        setServerMessage(
          `${result.scheduledEventCount ?? 0} alerts gepland, ${
            result.failedScheduleCount ?? 0
          } mislukt.`
        );
        session.startSession();
      }

      void refreshServerStatus(result.sessionId);
    } catch (error) {
      setServerMessage(
        error instanceof Error ? error.message : "Sessie starten is mislukt."
      );
      void refreshServerStatus();
    } finally {
      setIsStartingServerSession(false);
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
        setServerMessage(result.error || "Serverstatus kon niet worden geladen.");
      }
    } catch {
      setServerMessage("Serverstatus kon niet worden geladen.");
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
              Live Fuel Coach
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Web Push stuurt fueling alerts naar je telefoon, ook wanneer de
              sessie in de achtergrond draait. Je horloge ontvangt dezelfde
              alerts via notificatiespiegeling op je telefoon.
            </p>
          </div>
          <a
            href="/"
            className="w-fit rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
          >
            Dashboard
          </a>
        </header>

        <PwaInstallPrompt />
        <PushNotificationManager />

        <SessionControlPanel
          canStart={canStartServerSession}
          coachStatus={coachStatus}
          isStarting={isStartingServerSession}
          readiness={readiness}
          serverMessage={serverMessage}
          storageMode={serverStatus?.storageMode}
          onReset={resetSession}
          onStart={startDemoSession}
        />

        {!hasActiveSession ? (
          <section className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-5">
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
            <section className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Timer
                </div>
                <div className="mt-3 text-5xl font-semibold text-slate-50">
                  {formatElapsed(session.elapsedSeconds)}
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  {session.isRunning ? "Sessie loopt" : "Klaar om te starten"}
                </div>
              </div>

              <NextActionPanel
                nextTrigger={nextTrigger}
                nextServerEvent={nextServerEvent}
                secondsToNextAction={secondsToNextAction}
              />
            </section>

            <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Alert timeline
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    Elke rij toont de serverstatus van één geplande fueling alert.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs sm:min-w-[320px]">
                  <Metric label="Scheduled" value={String(serverStatus?.scheduledCount ?? serverEventCounts.scheduled)} />
                  <Metric label="Sent" value={String(serverStatus?.sentCount ?? serverEventCounts.sent)} />
                  <Metric label="Failed" value={String(serverStatus?.failedCount ?? serverEventCounts.failed)} />
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {session.calculatedFuelingPlan?.triggers.map((trigger) => (
                  <TimelineRow
                    key={trigger.tag}
                    trigger={trigger}
                    serverEvent={serverEvents.find((event) => event.tag === trigger.tag)}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function SessionControlPanel({
  canStart,
  coachStatus,
  isStarting,
  onReset,
  onStart,
  readiness,
  serverMessage,
  storageMode
}: {
  canStart: boolean;
  coachStatus: CoachSessionStatus;
  isStarting: boolean;
  onReset: () => void;
  onStart: () => void | Promise<void>;
  readiness?: ServerSessionStatusResponse["readiness"];
  serverMessage: string;
  storageMode?: string;
}) {
  const blockers = [
    readiness && !readiness.hasActiveSubscription ? "Web Push is nog niet actief." : "",
    readiness && !readiness.ok ? `Serverconfig mist: ${readiness.missing.join(", ")}.` : "",
    storageMode === "memory" ? "Memory storage is alleen geschikt voor lokale tests." : ""
  ].filter((blocker): blocker is string => Boolean(blocker));

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Session control
          </div>
          <div className={`mt-2 w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${resolveCoachStatusClassName(coachStatus)}`}>
            {coachStatus}
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Starten is zinvol zodra Web Push actief is en de serverconfig klaar
            staat. Daarna worden de fueling alerts server-side gepland.
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            {serverMessage}
          </p>
          {blockers.length > 0 ? (
            <div className="mt-3 grid gap-1">
              {blockers.map((blocker) => (
                <div key={blocker} className="text-sm text-amber-200">
                  {blocker}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[340px]">
          <ActionButton onClick={onStart} disabled={!canStart || isStarting}>
            Start demo session
          </ActionButton>
          <ActionButton onClick={onReset}>Reset session</ActionButton>
        </div>
      </div>
    </section>
  );
}

function NextActionPanel({
  nextServerEvent,
  nextTrigger,
  secondsToNextAction
}: {
  nextTrigger: FuelingCoreTrigger | null;
  nextServerEvent: ServerSessionEvent | null;
  secondsToNextAction: number;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        Next action
      </div>
      <div className="mt-3 text-2xl font-semibold text-slate-50">
        {nextTrigger ? nextTrigger.title : "Sessie afgerond"}
      </div>
      <div className="mt-2 text-sm leading-6 text-slate-400">
        {nextTrigger
          ? `${nextTrigger.body}. Over ${formatElapsed(secondsToNextAction)}.`
          : "Alle geplande fueling alerts zijn verwerkt."}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {nextTrigger ? (
          <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300">
            {nextTrigger.minute} min
          </span>
        ) : null}
        {nextServerEvent ? (
          <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100">
            Volgende push over {formatTimeDistance(nextServerEvent.triggerAt)}
          </span>
        ) : null}
      </div>
    </div>
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
      className="min-h-11 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
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
  trigger
}: {
  trigger: FuelingCoreTrigger;
  serverEvent?: ServerSessionEvent;
}) {
  const status = serverEvent?.status ?? "pending";

  return (
    <div className="grid gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4 sm:grid-cols-[72px_minmax(0,1fr)_120px] sm:items-center">
      <div className="text-sm font-semibold text-cyan-200">
        {trigger.minute} min
      </div>
      <div>
        <div className="font-semibold text-slate-100">{trigger.body}</div>
        <div className="mt-1 break-all text-xs text-slate-500">
          Reservoir {Math.round(trigger.carbReservoirG)}g · {trigger.tag}
        </div>
        {serverEvent?.lastError ? (
          <div className="mt-2 text-xs leading-5 text-rose-200">
            {serverEvent.lastError}
          </div>
        ) : null}
      </div>
      <StatusPill status={status} />
    </div>
  );
}

function StatusPill({ status }: { status: ServerEventDisplayStatus }) {
  return (
    <div className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${resolveServerEventStatusClassName(status)}`}>
      {status}
    </div>
  );
}

function summarizeServerEvents(events: ServerSessionEvent[]) {
  return {
    scheduled: events.filter((event) => event.status === "scheduled").length,
    failed: events.filter((event) => event.status === "failed").length,
    sent: events.filter((event) => event.status === "sent").length
  };
}

function resolveCoachSessionStatus({
  calculationStatus,
  hasActiveSession,
  isCompleted,
  isRunning
}: {
  calculationStatus: string;
  hasActiveSession: boolean;
  isCompleted: boolean;
  isRunning: boolean;
}): CoachSessionStatus {
  if (calculationStatus === "error") {
    return "error";
  }

  if (!hasActiveSession) {
    return "not active";
  }

  if (isCompleted) {
    return "completed";
  }

  if (isRunning) {
    return "running";
  }

  return "ready";
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

function resolveCoachStatusClassName(status: CoachSessionStatus) {
  if (status === "running") {
    return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
  }

  if (status === "completed" || status === "ready") {
    return "border-cyan-400/40 bg-cyan-400/10 text-cyan-200";
  }

  if (status === "error") {
    return "border-rose-400/40 bg-rose-400/10 text-rose-200";
  }

  return "border-slate-700 bg-slate-900 text-slate-300";
}

function resolveServerEventStatusClassName(status: ServerEventDisplayStatus) {
  if (status === "sent") {
    return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
  }

  if (status === "failed") {
    return "border-rose-400/40 bg-rose-400/10 text-rose-200";
  }

  if (status === "cancelled" || status === "skipped") {
    return "border-slate-700 bg-slate-900 text-slate-300";
  }

  if (status === "pending") {
    return "border-amber-400/40 bg-amber-400/10 text-amber-200";
  }

  return "border-cyan-400/40 bg-cyan-400/10 text-cyan-200";
}
