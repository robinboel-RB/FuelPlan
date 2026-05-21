"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PushNotificationManager } from "@/components/PushNotificationManager";

type TimelineStatus = "pending" | "scheduled" | "sent" | "failed";

interface DemoTimelineEvent {
  id: string;
  minute: number;
  title: string;
  body: string;
  tag: string;
}

interface PushSendResponse {
  ok: boolean;
  error?: string;
  successful?: number;
}

const demoTimeline: DemoTimelineEvent[] = [
  {
    id: "drink-1",
    minute: 1,
    title: "Drink now",
    body: "Drink 150-200ml water",
    tag: "fuelplan-drink-1"
  },
  {
    id: "carbs-1",
    minute: 2,
    title: "Fuel now",
    body: "Neem 25g carbs",
    tag: "fuelplan-carbs-1"
  },
  {
    id: "drink-2",
    minute: 3,
    title: "Drink now",
    body: "Drink opnieuw enkele slokken",
    tag: "fuelplan-drink-2"
  },
  {
    id: "check-energy",
    minute: 4,
    title: "Check effort",
    body: "Check energiegevoel",
    tag: "fuelplan-check-energy"
  },
  {
    id: "carbs-2",
    minute: 5,
    title: "Fuel now",
    body: "Neem 25g carbs indien intensiteit hoog blijft",
    tag: "fuelplan-carbs-2"
  }
];

export function LiveSessionClient() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [eventStatuses, setEventStatuses] = useState<Record<string, TimelineStatus>>(
    () => createInitialStatuses("pending")
  );
  const [lastMessage, setLastMessage] = useState("Volgende actie volgt straks");
  const timeoutIdsRef = useRef<number[]>([]);
  const intervalIdRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    return () => clearDemoTimers();
  }, []);

  const nextEvent = useMemo(
    () =>
      demoTimeline.find(
        (event) =>
          eventStatuses[event.id] === "pending" ||
          eventStatuses[event.id] === "scheduled"
      ),
    [eventStatuses]
  );

  const startDemoSession = () => {
    clearDemoTimers();
    startedAtRef.current = Date.now();
    setElapsedSeconds(0);
    setIsRunning(true);
    setLastMessage("Demo session gestart.");
    setEventStatuses(createInitialStatuses("scheduled"));

    intervalIdRef.current = window.setInterval(() => {
      if (!startedAtRef.current) {
        return;
      }

      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);

    demoTimeline.forEach((event) => {
      const timeoutId = window.setTimeout(() => {
        void sendTimelineEvent(event);
      }, event.minute * 60 * 1000);

      timeoutIdsRef.current.push(timeoutId);
    });
  };

  const sendTimelineEvent = async (event: DemoTimelineEvent) => {
    setLastMessage(`${event.title}: ${event.body}`);

    try {
      const result = await postJson<PushSendResponse>("/api/push/send", {
        title: event.title,
        body: event.body,
        url: "/live-session",
        tag: event.tag,
        requireInteraction: false
      });

      const wasSent = result.ok && (result.successful ?? 0) > 0;

      setEventStatuses((current) => ({
        ...current,
        [event.id]: wasSent ? "sent" : "failed"
      }));
      setLastMessage(
        wasSent
          ? `${event.title} verzonden.`
          : result.error || "Push send failed."
      );
    } catch {
      setEventStatuses((current) => ({ ...current, [event.id]: "failed" }));
      setLastMessage("Push send failed.");
    }
  };

  function clearDemoTimers() {
    timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutIdsRef.current = [];

    if (intervalIdRef.current !== null) {
      window.clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  }

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-300">
              FuelPlan PWA
            </div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
              Live Fuel Coach
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Fueling timeline naar Web Push op telefoon. Een gekoppeld horloge
              kan die telefoonmelding spiegelen.
            </p>
          </div>
          <a
            href="/"
            className="w-fit rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-slate-200"
          >
            Dashboard
          </a>
        </header>

        <PushNotificationManager />

        <section className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-5 rounded-2xl border border-slate-800/80 bg-slate-950/40 p-5">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                Session timer
              </div>
              <div className="mt-2 text-5xl font-semibold text-slate-50">
                {formatElapsed(elapsedSeconds)}
              </div>
              <div className="mt-2 text-sm text-slate-500">
                {isRunning ? "Demo session running" : "Ready for demo session"}
              </div>
            </div>

            <button
              type="button"
              onClick={startDemoSession}
              className="w-full rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100"
            >
              Start demo session
            </button>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-5">
            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
              Next action
            </div>
            <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
              <div className="text-2xl font-semibold text-slate-50">
                {nextEvent ? nextEvent.title : "Session complete"}
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-400">
                {nextEvent
                  ? `${nextEvent.body} at ${nextEvent.minute}:00`
                  : "Alle demo triggers zijn verwerkt."}
              </div>
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-slate-300">
                {lastMessage}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                Fuel timeline
              </div>
              <div className="mt-1 text-sm text-slate-400">
                Triggers op 1, 2, 3, 4 en 5 minuten.
              </div>
            </div>
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

function TimelineRow({
  event,
  status
}: {
  event: DemoTimelineEvent;
  status: TimelineStatus;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 sm:grid-cols-[80px_minmax(0,1fr)_110px] sm:items-center">
      <div className="text-sm font-semibold text-cyan-200">{event.minute}:00</div>
      <div>
        <div className="font-semibold text-slate-100">{event.body}</div>
        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
          {event.title}
        </div>
      </div>
      <div className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${resolveTimelineStatusClassName(status)}`}>
        {status}
      </div>
    </div>
  );
}

function createInitialStatuses(status: TimelineStatus) {
  return demoTimeline.reduce<Record<string, TimelineStatus>>((result, event) => {
    result[event.id] = status;
    return result;
  }, {});
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;

  return `${minutes}:${restSeconds.toString().padStart(2, "0")}`;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  return response.json() as Promise<T>;
}

function resolveTimelineStatusClassName(status: TimelineStatus) {
  if (status === "sent") {
    return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
  }

  if (status === "failed") {
    return "border-rose-400/40 bg-rose-400/10 text-rose-200";
  }

  if (status === "scheduled") {
    return "border-cyan-400/40 bg-cyan-400/10 text-cyan-200";
  }

  return "border-slate-700 bg-slate-900 text-slate-300";
}
