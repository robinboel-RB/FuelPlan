"use client";

import {
  CoachPlan,
  IntakeEvent,
  SessionSummary
} from "@/core/coachModel";
import { formatSigned } from "@/utils/format";

interface GuidancePanelProps {
  plan: CoachPlan;
  summary: SessionSummary;
  intakeEvents: IntakeEvent[];
  elapsedMinute: number;
  isRunning: boolean;
  isCompleted: boolean;
  onPause: () => void;
  onResume: () => void;
  onBackToSetup: () => void;
  onTakeCarbs: () => void;
  onTakeDrink: () => void;
  onSkip: () => void;
}

export function GuidancePanel({
  plan,
  summary,
  intakeEvents,
  elapsedMinute,
  isRunning,
  isCompleted,
  onPause,
  onResume,
  onBackToSetup,
  onTakeCarbs,
  onTakeDrink,
  onSkip
}: GuidancePanelProps) {
  const actualEvents = intakeEvents.filter((event) => event.type !== "skip");
  const logEvents = [...intakeEvents].reverse();

  return (
    <div className="space-y-7 rounded-[30px] border border-slate-800/80 bg-[rgba(7,14,25,0.78)] p-6 shadow-[0_28px_80px_rgba(2,6,23,0.35)] backdrop-blur xl:p-8">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
            Session guidance
          </div>
          <h2 className="text-3xl font-semibold tracking-wide text-slate-100">
            Live coaching
          </h2>
        </div>

        <div className="flex flex-wrap gap-3">
          {isCompleted ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-200">
              Completed
            </div>
          ) : (
            <button
              type="button"
              onClick={isRunning ? onPause : onResume}
              className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/15"
            >
              {isRunning ? "Pause" : "Resume"}
            </button>
          )}
          <button
            type="button"
            onClick={onBackToSetup}
            className="rounded-2xl border border-slate-700 bg-slate-900/40 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-500"
          >
            Back to setup
          </button>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between text-sm font-medium text-slate-200">
          <span>
            {elapsedMinute} / {plan.sessionDurationMin} min
          </span>
          <span>{plan.zoneLabel}</span>
        </div>
        <div className="h-2 rounded-full bg-slate-800">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-400"
            style={{ width: `${plan.progressPct}%` }}
          />
        </div>
      </section>

      <section className="space-y-4 border-t border-slate-800/80 pt-5">
        <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
          Energy output
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Metric label="Total kcal" value={`${Math.round(plan.totalKcal)}`} />
          <Metric label="Equation output" value={plan.selectedEngine} />
          <Metric
            label="Next action timer"
            value={
              isCompleted
                ? "done"
                : plan.nextFuelActionInMin === 0
                  ? "now"
                  : `${plan.nextFuelActionInMin} min`
            }
          />
          <Metric label="Fuel buffer" value={formatSigned(plan.fuelBufferG, "g")} />
          <Metric label="Fuel deficit" value={`${Math.round(plan.fuelDeficitG)} g`} />
          <Metric label="RER" value={plan.averageRer.toFixed(2)} />
        </div>
        <EngineComparison plan={plan} />
        <div className="text-sm text-slate-500">{plan.selectedEngineReason}</div>
        {plan.energyWarnings.length > 0 ? (
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {plan.energyWarnings.join(" ")}
          </div>
        ) : null}
      </section>

      <section className="space-y-4 border-t border-slate-800/80 pt-5">
        <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
          Session status
        </div>
        <div className="grid gap-3 text-sm md:grid-cols-[160px_minmax(0,1fr)]">
          <span className="text-slate-400">Next action</span>
          <span className="text-right text-lg font-semibold text-cyan-200 md:text-left">
            {isCompleted ? "Session complete" : plan.nextActionLabel}
          </span>
          <span className="text-slate-400">Fuel balance</span>
          <span className="text-right font-semibold text-amber-300 md:text-left">
            {formatSigned(summary.carbBalance, "g")} · {" "}
            {formatSigned(summary.hydrationBalance, "ml")}
          </span>
        </div>
      </section>

      <section className="space-y-5 border-t border-slate-800/80 pt-5">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
            Fuel timeline
          </div>
          <div className="text-sm text-slate-500">
            {elapsedMinute} / {plan.sessionDurationMin} min
          </div>
        </div>

        <TimelineRow
          label="Carbs plan"
          totalMinute={plan.sessionDurationMin}
          currentMinute={elapsedMinute}
          markers={plan.carbSchedule.map((minute) => ({
            minute,
            variant: "planned-carb" as const
          }))}
        />
        <TimelineRow
          label="Hydration plan"
          totalMinute={plan.sessionDurationMin}
          currentMinute={elapsedMinute}
          markers={plan.hydrationSchedule.map((minute) => ({
            minute,
            variant: "planned-hydration" as const
          }))}
        />
        <TimelineRow
          label="Actual"
          totalMinute={plan.sessionDurationMin}
          currentMinute={elapsedMinute}
          markers={actualEvents.map((event) => ({
            minute: event.minute,
            variant:
              event.type === "carbs"
                ? ("actual-carb" as const)
                : ("actual-hydration" as const)
          }))}
        />

        <div className="text-xs text-slate-500">
          Planned: hollow dots · Taken: filled dots
        </div>
      </section>

      <section className="space-y-4 border-t border-slate-800/80 pt-5">
        <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
          Intake actions
        </div>
        {isCompleted ? (
          <div className="rounded-2xl border border-slate-800 bg-[rgba(7,14,25,0.55)] px-4 py-4 text-sm text-slate-400">
            Sessiesimulatie afgerond. Gebruik de activity log en fuel balance voor je eindcheck.
          </div>
        ) : (
          <>
            <div className="text-base text-slate-300">
              Pending: carbs {summary.pendingCarbCount} · hydration {summary.pendingHydrationCount}
            </div>
            <div className="text-sm text-slate-500">
              Suggested now: {plan.carbDoseG}g carbs · {plan.hydrationDoseMl}ml drink
              <span className="block pt-1 text-slate-600">{plan.fuelMessage}</span>
            </div>

            <div className="flex flex-wrap gap-3">
              <ActionButton
                tone="carb"
                label={`Carbs taken (${plan.carbDoseG}g)`}
                onClick={onTakeCarbs}
              />
              <ActionButton
                tone="hydration"
                label={`Drink taken (${plan.hydrationDoseMl}ml)`}
                onClick={onTakeDrink}
              />
              <ActionButton tone="skip" label="Skip" onClick={onSkip} />
            </div>
          </>
        )}
      </section>

      <section className="space-y-4 border-t border-slate-800/80 pt-5">
        <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
          Intake history
        </div>
        <div className="space-y-3">
          {logEvents.length === 0 ? (
            <div className="text-sm text-slate-500">No intake events yet.</div>
          ) : (
            logEvents.map((event) => (
              <div
                key={event.id}
                className="grid grid-cols-[80px_minmax(0,1fr)_auto] gap-4 border-b border-slate-900/80 pb-3 text-sm"
              >
                <span className="text-slate-400">{event.clockLabel}</span>
                <span className="font-medium text-slate-200">
                  {describeEvent(event)}
                </span>
                <span className="text-slate-500">
                  {event.type === "skip" ? "skipped" : "taken"}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[rgba(3,9,19,0.58)] px-4 py-4">
      <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function EngineComparison({ plan }: { plan: CoachPlan }) {
  const maxKjMin = Math.max(plan.keytelKjMin, plan.minettiKjMin, 0.1);
  const gapLabel =
    plan.engineGapPct === 0
      ? "Keytel and Minetti aligned"
      : `Minetti ${Math.abs(plan.engineGapPct).toFixed(1)}% ${
          plan.engineGapPct > 0 ? "above" : "below"
        } Keytel`;

  return (
    <div className="space-y-4 rounded-2xl border border-slate-800/80 bg-[rgba(3,9,19,0.48)] p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
            Live equation comparison
          </div>
          <div className="mt-1 text-sm text-slate-400">{gapLabel}</div>
        </div>
        <div className="text-left md:text-right">
          <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
            Selected output
          </div>
          <div className="mt-1 text-lg font-semibold text-cyan-200">
            {plan.selectedKjMin.toFixed(1)} kJ/min
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <EngineBar
          label="Keytel"
          valueKjMin={plan.keytelKjMin}
          totalKcal={plan.keytelTotalKcal}
          maxKjMin={maxKjMin}
          active={plan.selectedEngine === "keytel"}
        />
        <EngineBar
          label="Minetti"
          valueKjMin={plan.minettiKjMin}
          totalKcal={plan.minettiTotalKcal}
          maxKjMin={maxKjMin}
          active={plan.selectedEngine === "minetti"}
        />
      </div>
    </div>
  );
}

function EngineBar({
  label,
  valueKjMin,
  totalKcal,
  maxKjMin,
  active
}: {
  label: "Keytel" | "Minetti";
  valueKjMin: number;
  totalKcal: number;
  maxKjMin: number;
  active: boolean;
}) {
  const widthPct = Math.max(4, Math.min(100, (valueKjMin / maxKjMin) * 100));

  return (
    <div
      className={`rounded-2xl border px-4 py-4 ${
        active
          ? "border-cyan-400/50 bg-cyan-400/10"
          : "border-slate-800 bg-slate-950/25"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-slate-100">{label}</div>
          <div className="mt-1 text-xs text-slate-500">
            {Math.round(totalKcal)} kcal total
          </div>
        </div>
        {active ? (
          <div className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
            selected
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 flex-1 rounded-full bg-slate-800">
          <div
            className={`h-2 rounded-full ${
              label === "Keytel" ? "bg-cyan-300" : "bg-amber-300"
            }`}
            style={{ width: `${widthPct}%` }}
          />
        </div>
        <div className="w-[88px] text-right text-sm font-semibold text-slate-200">
          {valueKjMin.toFixed(1)} kJ/min
        </div>
      </div>
    </div>
  );
}

function TimelineRow({
  label,
  totalMinute,
  currentMinute,
  markers
}: {
  label: string;
  totalMinute: number;
  currentMinute: number;
  markers: Array<{
    minute: number;
    variant:
      | "planned-carb"
      | "planned-hydration"
      | "actual-carb"
      | "actual-hydration";
  }>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-[116px_minmax(0,1fr)] md:items-center">
      <div className="text-lg text-slate-300">{label}</div>
      <div className="relative h-9">
        <div className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-slate-700" />
        <div
          className="absolute top-1/2 h-6 w-px -translate-y-1/2 bg-cyan-300"
          style={{ left: `${resolveMarkerOffset(currentMinute, totalMinute)}%` }}
        />

        {markers
          .filter((marker) => marker.minute >= 0 && marker.minute <= totalMinute)
          .map((marker, index) => {
          const left = `${resolveMarkerOffset(marker.minute, totalMinute)}%`;
          const className = resolveMarkerClassName(marker.variant);

          return (
            <div
              key={`${marker.variant}-${marker.minute}-${index}`}
              className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${className}`}
              style={{ left }}
            />
          );
        })}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  tone
}: {
  label: string;
  onClick: () => void;
  tone: "carb" | "hydration" | "skip";
}) {
  const className =
    tone === "carb"
      ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
      : tone === "hydration"
        ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
        : "bg-slate-600 text-slate-100 hover:bg-slate-500";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-5 py-3 text-base font-semibold transition ${className}`}
    >
      {label}
    </button>
  );
}

function resolveMarkerClassName(
  variant:
    | "planned-carb"
    | "planned-hydration"
    | "actual-carb"
    | "actual-hydration"
) {
  switch (variant) {
    case "planned-carb":
      return "border border-cyan-300 bg-transparent";
    case "planned-hydration":
      return "border border-slate-400 bg-transparent";
    case "actual-carb":
      return "bg-amber-300";
    case "actual-hydration":
      return "bg-cyan-300";
  }
}

function describeEvent(event: IntakeEvent) {
  if (event.type === "skip") {
    if (!event.targets || event.targets.length === 0) {
      return "Reminder skipped";
    }

    return `${event.targets.join(" + ")} skipped`;
  }

  return `${event.type === "carbs" ? "carbs" : "drink"} ${event.amount}${event.unit}`;
}

function resolveMarkerOffset(minute: number, totalMinute: number) {
  const rawOffset = (minute / totalMinute) * 100;
  return Math.max(0, Math.min(rawOffset, 100));
}
