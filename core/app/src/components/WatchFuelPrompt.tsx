"use client";

import type { FuelPlanWatchOutput } from "@/integrations/watch/types";

interface WatchFuelPromptProps {
  output: FuelPlanWatchOutput;
}

export function WatchFuelPrompt({ output }: WatchFuelPromptProps) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-950/35 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
            Next FuelPlan action
          </div>
          <div className="mt-2 text-xl font-semibold text-slate-100">
            <span data-testid="watch-next-action">
              {formatAction(output.nextFuelAction)}
            </span>
          </div>
          <div className="mt-1 text-sm text-slate-500">{output.message}</div>
        </div>
        <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-right">
          <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/80">
            Timer
          </div>
          <div className="mt-1 text-lg font-semibold text-cyan-100">
            {formatTimer(output.nextActionTimerSeconds)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <PromptMetric label="Carbs" value={`${output.carbsDoseGrams}g`} />
        <PromptMetric label="Drink" value={`${output.drinkDoseMl}ml`} />
        <PromptMetric
          label="Buffer"
          value={formatSigned(output.fuelBufferGrams, "g")}
        />
        <PromptMetric
          label="Deficit"
          value={`${Math.round(output.fuelDeficitGrams)}g`}
        />
      </div>
    </section>
  );
}

function PromptMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/45 px-3 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function formatAction(action: FuelPlanWatchOutput["nextFuelAction"]) {
  switch (action) {
    case "carbs":
      return "Carbs";
    case "drink":
      return "Drink";
    case "carbs_and_drink":
      return "Carbs + drink";
    case "none":
      return "None";
  }
}

function formatTimer(seconds: number) {
  if (seconds <= 0) {
    return "now";
  }

  return `${Math.ceil(seconds / 60)} min`;
}

function formatSigned(value: number, unit: string) {
  return `${value > 0 ? "+" : ""}${Math.round(value)}${unit}`;
}
