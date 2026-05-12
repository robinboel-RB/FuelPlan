"use client";

import {
  CoachInput,
  CoachPlan
} from "@/core/coachModel";

interface WatchCoachProps {
  input: CoachInput;
  plan: CoachPlan;
  elapsedMinute: number;
}

export function WatchCoach({ input, plan, elapsedMinute }: WatchCoachProps) {
  const isCritical = plan.urgency === "critical";
  const isWarning = plan.urgency === "warning";
  const isComplete = plan.urgency === "complete";
  const messageClassName = resolveMessageClassName(plan.watchMessage);
  const statusLabel =
    plan.urgency === "complete"
      ? "COMPLETE"
      : plan.urgency === "critical"
      ? "CRITICAL"
      : plan.urgency === "warning"
        ? "WARNING"
        : plan.urgency === "ready"
          ? "READY"
          : "ON TRACK";
  const overlayClassName = isCritical
    ? "bg-[radial-gradient(circle_at_50%_38%,rgba(251,113,133,0.9),rgba(190,24,93,0.88)_66%,rgba(103,8,33,0.94)_100%)]"
    : isWarning
      ? "bg-[radial-gradient(circle_at_50%_38%,rgba(251,191,36,0.78),rgba(217,119,6,0.74)_68%,rgba(120,53,15,0.82)_100%)]"
      : isComplete
        ? "bg-[radial-gradient(circle_at_50%_38%,rgba(34,197,94,0.18),rgba(15,23,42,0.1)_68%,transparent_100%)]"
        : "";

  return (
    <div className="rounded-[34px] border border-slate-800/80 bg-[rgba(4,10,21,0.84)] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.45)]">
      <div className="mx-auto max-w-[470px]">
        <div className="relative mx-auto w-[360px] pt-10 sm:w-[430px] sm:pt-12">
          <div className="mx-auto h-28 w-36 rounded-[26px] bg-gradient-to-b from-slate-600/70 to-slate-800/70 sm:h-32 sm:w-40" />
          <div className="relative -mt-4 aspect-square w-full rounded-full bg-gradient-to-br from-slate-500 to-slate-700 p-3 shadow-[0_30px_60px_rgba(0,0,0,0.45)]">
            <div className="absolute left-[-8px] top-1/2 h-10 w-4 -translate-y-1/2 rounded-l-full bg-slate-500 sm:h-12 sm:w-5" />
            <div className="absolute right-[-8px] top-1/2 h-10 w-4 -translate-y-1/2 rounded-r-full bg-slate-500 sm:h-12 sm:w-5" />

            <div className="relative h-full w-full overflow-hidden rounded-full border border-slate-500/70 bg-[radial-gradient(circle_at_50%_20%,rgba(30,41,59,0.28),transparent_38%),linear-gradient(180deg,#0b1424_0%,#09101d_100%)] text-center">
              <div className="absolute inset-3 rounded-full border border-slate-600/50" />

              {plan.urgency === "critical" ||
              plan.urgency === "warning" ||
              plan.urgency === "complete" ? (
                <div className={`absolute inset-0 ${overlayClassName}`} />
              ) : null}

              <div className="absolute inset-x-[16%] inset-y-[14%] z-10 flex flex-col sm:inset-x-[17%] sm:inset-y-[15%]">
                <div className="grid grid-cols-3 items-start gap-4 px-3 text-[8px] uppercase tracking-[0.14em] text-slate-400 sm:px-4 sm:text-[9px]">
                  <MetricStack label="Time" value={plan.simulatedClockLabel} align="left" />
                  <MetricStack
                    label="Dist"
                    value={`${plan.simulatedDistanceKm.toFixed(1)}K`}
                    align="center"
                  />
                  <MetricStack label="HR" value={`${input.heartRate}`} align="right" />
                </div>

                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 text-center sm:gap-3 sm:px-5">
                  <div
                    className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${
                      isComplete
                        ? "text-emerald-200"
                        : isCritical
                        ? "text-rose-50"
                        : isWarning
                          ? "text-amber-50"
                          : "text-emerald-300"
                    }`}
                  >
                    {statusLabel}
                  </div>

                  <div
                    className={`mx-auto max-w-[200px] whitespace-pre-line font-semibold leading-[0.92] tracking-tight sm:max-w-[228px] ${messageClassName} ${
                      isCritical || isWarning || isComplete
                        ? "text-white"
                        : "text-slate-100"
                    }`}
                  >
                    {plan.watchMessage}
                  </div>

                  <div
                    className={`max-w-[200px] text-sm font-semibold leading-snug tracking-[0.03em] sm:max-w-[225px] sm:text-[15px] ${
                      isComplete
                        ? "text-emerald-50"
                        : isCritical
                        ? "text-rose-50"
                        : isWarning
                          ? "text-amber-50"
                          : "text-slate-200"
                    }`}
                  >
                    {plan.watchDetail}
                  </div>
                </div>

                <div className="space-y-2 px-4 pb-2 text-center">
                  <div className="h-1.5 rounded-full bg-slate-700/90">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-blue-400"
                      style={{ width: `${plan.progressPct}%` }}
                    />
                  </div>

                  <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 sm:text-[11px]">
                    {elapsedMinute} / {plan.sessionDurationMin} min · {plan.zoneLabel}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mx-auto -mt-5 h-28 w-36 rounded-[26px] bg-gradient-to-b from-slate-600/60 to-slate-800/70 sm:h-32 sm:w-40" />
        </div>
      </div>
    </div>
  );
}

function MetricStack({
  label,
  value,
  align
}: {
  label: string;
  value: string;
  align: "left" | "center" | "right";
}) {
  const alignmentClassName =
    align === "left"
      ? "items-start text-left"
      : align === "right"
        ? "items-end text-right"
        : "items-center text-center";

  return (
    <div className={`flex flex-col gap-1 ${alignmentClassName}`}>
      <div>{label}</div>
      <div className="text-[12px] font-semibold tracking-[0.03em] text-slate-200 sm:text-[13px]">
        {value}
      </div>
    </div>
  );
}

function resolveMessageClassName(message: string) {
  const longestLineLength = Math.max(...message.split("\n").map((line) => line.length));

  if (longestLineLength >= 16) {
    return "text-[2.5rem] sm:text-[3rem]";
  }

  if (longestLineLength >= 11) {
    return "text-[2.8rem] sm:text-[3.4rem]";
  }

  return "text-[3rem] sm:text-[3.7rem]";
}
