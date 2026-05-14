"use client";

import type { CoachInput, CoachPlan } from "@/engine/fuelingEngine";
import type { FuelPlanWatchOutput } from "@/integrations/watch/types";
import type {
  WatchConnectionStatus as WatchConnectionStatusValue,
  WatchProvider,
  WatchProviderId,
  WatchSensorSample
} from "@/integrations/watch/types";
import { WatchConnectionStatus } from "@/components/WatchConnectionStatus";
import { WatchFuelPrompt } from "@/components/WatchFuelPrompt";
import { WatchProviderSelector } from "@/components/WatchProviderSelector";

interface WatchPanelProps {
  input: CoachInput;
  plan: CoachPlan;
  elapsedMinute: number;
  selectedProviderId: WatchProviderId;
  provider: WatchProvider;
  connectionStatus: WatchConnectionStatusValue;
  sensorSample: WatchSensorSample;
  watchOutput: FuelPlanWatchOutput;
  onSelectProvider: (providerId: WatchProviderId) => void;
}

export function WatchPanel({
  input,
  plan,
  elapsedMinute,
  selectedProviderId,
  provider,
  connectionStatus,
  sensorSample,
  watchOutput,
  onSelectProvider
}: WatchPanelProps) {
  return (
    <div className="space-y-5 rounded-[34px] border border-slate-800/80 bg-[rgba(4,10,21,0.84)] p-5 shadow-[0_30px_80px_rgba(2,6,23,0.45)]">
      <WatchProviderSelector
        selectedProviderId={selectedProviderId}
        onSelectProvider={onSelectProvider}
      />

      <WatchFace input={input} plan={plan} elapsedMinute={elapsedMinute} />

      <WatchConnectionStatus provider={provider} status={connectionStatus} />
      <WatchFuelPrompt output={watchOutput} />

      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/35 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
            Demo sensor sample
          </div>
          <div className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
            Demo connected
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <SensorMetric
            label="HR"
            value={`${sensorSample.heartRateBpm ?? input.heartRate}`}
          />
          <SensorMetric
            label="Dist"
            value={`${Math.round(sensorSample.distanceMeters ?? 0)}m`}
          />
          <SensorMetric
            label="Pace"
            value={formatPace(sensorSample.paceSecPerKm)}
          />
        </div>
      </div>
    </div>
  );
}

function WatchFace({
  input,
  plan,
  elapsedMinute
}: {
  input: CoachInput;
  plan: CoachPlan;
  elapsedMinute: number;
}) {
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
    <div className="mx-auto max-w-[470px]">
      <div className="relative mx-auto w-[330px] pt-8 sm:w-[410px] sm:pt-10">
        <div className="mx-auto h-24 w-32 rounded-[26px] bg-gradient-to-b from-slate-600/70 to-slate-800/70 sm:h-28 sm:w-40" />
        <div className="relative -mt-4 aspect-square w-full rounded-full bg-gradient-to-br from-slate-500 to-slate-700 p-3 shadow-[0_30px_60px_rgba(0,0,0,0.45)]">
          <div className="absolute left-[-8px] top-1/2 h-10 w-4 -translate-y-1/2 rounded-l-full bg-slate-500 sm:h-12 sm:w-5" />
          <div className="absolute right-[-8px] top-1/2 h-10 w-4 -translate-y-1/2 rounded-r-full bg-slate-500 sm:h-12 sm:w-5" />

          <div className="relative h-full w-full overflow-hidden rounded-full border border-slate-500/70 bg-[radial-gradient(circle_at_50%_20%,rgba(30,41,59,0.28),transparent_38%),linear-gradient(180deg,#0b1424_0%,#09101d_100%)] text-center">
            <div className="absolute inset-3 rounded-full border border-slate-600/50" />

            {isCritical || isWarning || isComplete ? (
              <div className={`absolute inset-0 ${overlayClassName}`} />
            ) : null}

            <div className="absolute inset-x-[16%] inset-y-[14%] z-10 flex flex-col sm:inset-x-[17%] sm:inset-y-[15%]">
              <div className="grid grid-cols-3 items-start gap-4 px-3 text-[8px] uppercase tracking-[0.14em] text-slate-400 sm:px-4 sm:text-[9px]">
                <MetricStack
                  label="Time"
                  value={plan.simulatedClockLabel}
                  align="left"
                  testId="watch-time"
                />
                <MetricStack
                  label="Dist"
                  value={`${plan.simulatedDistanceKm.toFixed(1)}K`}
                  align="center"
                  testId="watch-distance"
                />
                <MetricStack
                  label="HR"
                  value={`${input.heartRate}`}
                  align="right"
                  testId="watch-hr"
                />
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
                  <span data-testid="watch-status">{statusLabel}</span>
                </div>

                <div
                  className={`mx-auto max-w-[200px] whitespace-pre-line font-semibold leading-[0.92] tracking-tight sm:max-w-[228px] ${messageClassName} ${
                    isCritical || isWarning || isComplete ? "text-white" : "text-slate-100"
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
                  <span data-testid="watch-progress-label">
                    {elapsedMinute} / {plan.sessionDurationMin} min · {plan.zoneLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto -mt-5 h-24 w-32 rounded-[26px] bg-gradient-to-b from-slate-600/60 to-slate-800/70 sm:h-28 sm:w-40" />
      </div>
    </div>
  );
}

function MetricStack({
  label,
  value,
  align,
  testId
}: {
  label: string;
  value: string;
  align: "left" | "center" | "right";
  testId?: string;
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
      <div
        className="text-[12px] font-semibold tracking-[0.03em] text-slate-200 sm:text-[13px]"
        data-testid={testId}
      >
        {value}
      </div>
    </div>
  );
}

function SensorMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function resolveMessageClassName(message: string) {
  const longestLineLength = Math.max(...message.split("\n").map((line) => line.length));

  if (longestLineLength >= 16) {
    return "text-[2.3rem] sm:text-[2.8rem]";
  }

  if (longestLineLength >= 11) {
    return "text-[2.6rem] sm:text-[3.2rem]";
  }

  return "text-[2.9rem] sm:text-[3.5rem]";
}

function formatPace(paceSecPerKm?: number) {
  if (!paceSecPerKm || !Number.isFinite(paceSecPerKm)) {
    return "--";
  }

  const totalSeconds = Math.round(paceSecPerKm);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}/km`;
}
