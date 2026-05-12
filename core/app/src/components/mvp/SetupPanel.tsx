"use client";

import { useEffect, useState } from "react";
import {
  CoachInput,
  CoachPlan,
  EquationOutputMode,
  Gender,
  formatDurationInput,
  formatPaceInput,
  parseDurationToMinutes,
  parsePaceToSpeedMPerMin
} from "@/lib/mvp/coachModel";

type NumericInputKey =
  | "weightKg"
  | "age"
  | "heartRate"
  | "heightM"
  | "restingHrBpm"
  | "maxHrBpm"
  | "slopeDecimal"
  | "cumulativeAscentM"
  | "cumulativeDescentM"
  | "ambientTempC"
  | "terrainFactor";

type NullableInputKey = "bodyFatPct" | "vo2MaxMlKgMin" | "plannedCarbsPerHour";

interface SetupPanelProps {
  value: CoachInput;
  plan: CoachPlan;
  onChange: (value: CoachInput) => void;
  onStart: () => void;
}

export function SetupPanel({
  value,
  plan,
  onChange,
  onStart
}: SetupPanelProps) {
  const [inputPage, setInputPage] = useState<"profile" | "run">("profile");
  const [draft, setDraft] = useState({
    weightKg: value.weightKg.toString(),
    age: value.age.toString(),
    heartRate: value.heartRate.toString(),
    bodyFatPct: value.bodyFatPct?.toString() ?? "",
    heightM: value.heightM.toString(),
    restingHrBpm: value.restingHrBpm.toString(),
    maxHrBpm: value.maxHrBpm.toString(),
    vo2MaxMlKgMin: value.vo2MaxMlKgMin?.toString() ?? "",
    plannedCarbsPerHour: value.plannedCarbsPerHour?.toString() ?? "",
    segmentPace: formatPaceInput(value.speedMPerMin),
    segmentTime: formatDurationInput(value.segmentDurationMin),
    cumulativeTime: formatDurationInput(value.cumulativeTimeMin),
    slopeDecimal: value.slopeDecimal.toString(),
    cumulativeAscentM: value.cumulativeAscentM.toString(),
    cumulativeDescentM: value.cumulativeDescentM.toString(),
    ambientTempC: value.ambientTempC.toString(),
    terrainFactor: value.terrainFactor.toString()
  });

  useEffect(() => {
    setDraft({
      weightKg: value.weightKg.toString(),
      age: value.age.toString(),
      heartRate: value.heartRate.toString(),
      bodyFatPct: value.bodyFatPct?.toString() ?? "",
      heightM: value.heightM.toString(),
      restingHrBpm: value.restingHrBpm.toString(),
      maxHrBpm: value.maxHrBpm.toString(),
      vo2MaxMlKgMin: value.vo2MaxMlKgMin?.toString() ?? "",
      plannedCarbsPerHour: value.plannedCarbsPerHour?.toString() ?? "",
      segmentPace: formatPaceInput(value.speedMPerMin),
      segmentTime: formatDurationInput(value.segmentDurationMin),
      cumulativeTime: formatDurationInput(value.cumulativeTimeMin),
      slopeDecimal: value.slopeDecimal.toString(),
      cumulativeAscentM: value.cumulativeAscentM.toString(),
      cumulativeDescentM: value.cumulativeDescentM.toString(),
      ambientTempC: value.ambientTempC.toString(),
      terrainFactor: value.terrainFactor.toString()
    });
  }, [value]);

  const updateNumber = (
    key: NumericInputKey,
    nextValue: string
  ) => {
    setDraft((previous) => ({
      ...previous,
      [key]: nextValue
    }));

    if (nextValue === "") {
      return;
    }

    const parsed = Number(nextValue);

    if (Number.isNaN(parsed)) {
      return;
    }

    onChange({
      ...value,
      [key]: parsed
    });
  };

  const updateNullableNumber = (key: NullableInputKey, nextValue: string) => {
    setDraft((previous) => ({
      ...previous,
      [key]: nextValue
    }));

    onChange({
      ...value,
      [key]: nextValue === "" ? null : Number(nextValue)
    });
  };

  const updateGender = (gender: Gender) => {
    onChange({
      ...value,
      gender
    });
  };

  const updateOutputMode = (outputMode: EquationOutputMode) => {
    onChange({
      ...value,
      outputMode
    });
  };

  const updatePace = (nextValue: string) => {
    setDraft((previous) => ({
      ...previous,
      segmentPace: nextValue
    }));

    const speedMPerMin = parsePaceToSpeedMPerMin(nextValue);

    if (speedMPerMin === null) {
      return;
    }

    onChange({
      ...value,
      speedMPerMin
    });
  };

  const updateDuration = (
    key: "segmentDurationMin" | "cumulativeTimeMin",
    draftKey: "segmentTime" | "cumulativeTime",
    nextValue: string
  ) => {
    setDraft((previous) => ({
      ...previous,
      [draftKey]: nextValue
    }));

    const minutes = parseDurationToMinutes(nextValue);

    if (minutes === null) {
      return;
    }

    onChange({
      ...value,
      [key]: minutes
    });
  };

  const restoreDraft = (key: keyof typeof draft, fallback: string) => {
    setDraft((previous) =>
      previous[key] === ""
        ? {
            ...previous,
            [key]: fallback
          }
        : previous
    );
  };

  return (
    <div className="space-y-6 rounded-[30px] border border-slate-800/80 bg-[rgba(7,14,25,0.78)] p-6 shadow-[0_28px_80px_rgba(2,6,23,0.35)] backdrop-blur xl:p-8">
      <div className="space-y-3">
        <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
          Session setup
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-wide text-slate-100 xl:text-[2.35rem]">
            Prepare athlete input
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-slate-400 xl:text-base">
            Athlete-profiel en segmentdata sturen de centrale Keytel/Minetti
            energy engine.
          </p>
        </div>
      </div>

      <div className="space-y-4 rounded-[24px] border border-slate-800/80 bg-[rgba(10,18,30,0.55)] p-4">
        <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
          Output equation
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <EquationButton
            active={value.outputMode === "keytel"}
            title="Keytel Equation"
            body="Energy used from HR"
            onClick={() => updateOutputMode("keytel")}
          />
          <EquationButton
            active={value.outputMode === "minetti"}
            title="Minetti Equation"
            body="Trail cost for ideal movement"
            onClick={() => updateOutputMode("minetti")}
          />
        </div>
      </div>

      <div className="flex gap-2 rounded-[18px] border border-slate-800 bg-[rgba(3,9,19,0.55)] p-1">
        <InputTab
          active={inputPage === "profile"}
          label="Athlete input"
          onClick={() => setInputPage("profile")}
        />
        <InputTab
          active={inputPage === "run"}
          label="Run data deep dive"
          onClick={() => setInputPage("run")}
        />
      </div>

      {inputPage === "profile" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Weight (kg)">
            <input
              className={inputClassName}
              type="number"
              min={35}
              max={220}
              step={0.1}
              value={draft.weightKg}
              onChange={(event) => updateNumber("weightKg", event.target.value)}
              onBlur={() => restoreDraft("weightKg", value.weightKg.toString())}
            />
          </Field>

          <Field label="Age">
            <input
              className={inputClassName}
              type="number"
              min={16}
              max={90}
              step={1}
              value={draft.age}
              onChange={(event) => updateNumber("age", event.target.value)}
              onBlur={() => restoreDraft("age", value.age.toString())}
            />
          </Field>

          <Field label="Gender">
            <select
              className={inputClassName}
              value={value.gender}
              onChange={(event) => updateGender(event.target.value as Gender)}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>

          <Field label="Height (m)">
            <input
              className={inputClassName}
              type="number"
              min={1.2}
              max={2.3}
              step={0.01}
              value={draft.heightM}
              onChange={(event) => updateNumber("heightM", event.target.value)}
              onBlur={() => restoreDraft("heightM", value.heightM.toString())}
            />
          </Field>

          <Field label="Resting HR (bpm)">
            <input
              className={inputClassName}
              type="number"
              min={30}
              max={120}
              step={1}
              value={draft.restingHrBpm}
              onChange={(event) => updateNumber("restingHrBpm", event.target.value)}
              onBlur={() =>
                restoreDraft("restingHrBpm", value.restingHrBpm.toString())
              }
            />
          </Field>

          <Field label="Max HR (bpm)">
            <input
              className={inputClassName}
              type="number"
              min={90}
              max={240}
              step={1}
              value={draft.maxHrBpm}
              onChange={(event) => updateNumber("maxHrBpm", event.target.value)}
              onBlur={() => restoreDraft("maxHrBpm", value.maxHrBpm.toString())}
            />
          </Field>

          <Field label="Body fat (%) optional">
            <input
              className={inputClassName}
              type="number"
              min={3}
              max={60}
              step={0.1}
              value={draft.bodyFatPct}
              onChange={(event) =>
                updateNullableNumber("bodyFatPct", event.target.value)
              }
              placeholder="Fallback estimate"
            />
          </Field>

          <Field label="VO2max optional">
            <input
              className={inputClassName}
              type="number"
              min={20}
              max={90}
              step={0.1}
              value={draft.vo2MaxMlKgMin}
              onChange={(event) =>
                updateNullableNumber("vo2MaxMlKgMin", event.target.value)
              }
              placeholder="HR estimate"
            />
          </Field>

          <Field label="Planned carbs (g/h)">
            <input
              className={inputClassName}
              type="number"
              min={0}
              max={160}
              step={1}
              value={draft.plannedCarbsPerHour}
              onChange={(event) =>
                updateNullableNumber("plannedCarbsPerHour", event.target.value)
              }
              placeholder="Auto target"
            />
          </Field>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Segment speed (min/km)">
            <input
              className={inputClassName}
              type="text"
              inputMode="numeric"
              value={draft.segmentPace}
              onChange={(event) => updatePace(event.target.value)}
              onBlur={() =>
                restoreDraft("segmentPace", formatPaceInput(value.speedMPerMin))
              }
              placeholder="06:01"
            />
          </Field>

          <Field label="Segment time">
            <input
              className={inputClassName}
              type="text"
              inputMode="numeric"
              value={draft.segmentTime}
              onChange={(event) =>
                updateDuration("segmentDurationMin", "segmentTime", event.target.value)
              }
              onBlur={() =>
                restoreDraft(
                  "segmentTime",
                  formatDurationInput(value.segmentDurationMin)
                )
              }
              placeholder="1:36:22"
            />
          </Field>

          <Field label="Cumulative time">
            <input
              className={inputClassName}
              type="text"
              inputMode="numeric"
              value={draft.cumulativeTime}
              onChange={(event) =>
                updateDuration("cumulativeTimeMin", "cumulativeTime", event.target.value)
              }
              onBlur={() =>
                restoreDraft(
                  "cumulativeTime",
                  formatDurationInput(value.cumulativeTimeMin)
                )
              }
              placeholder="1:36:22"
            />
          </Field>

          <Field label="Segment HR (bpm)">
            <input
              className={inputClassName}
              type="number"
              min={40}
              max={220}
              step={1}
              value={draft.heartRate}
              onChange={(event) => updateNumber("heartRate", event.target.value)}
              onBlur={() => restoreDraft("heartRate", value.heartRate.toString())}
            />
          </Field>

          <Field label="Segment slope (% in 0,00)">
            <input
              className={inputClassName}
              type="number"
              min={-0.45}
              max={0.45}
              step={0.0001}
              value={draft.slopeDecimal}
              onChange={(event) => updateNumber("slopeDecimal", event.target.value)}
              onBlur={() =>
                restoreDraft("slopeDecimal", value.slopeDecimal.toString())
              }
            />
          </Field>

          <Field label="Cumul. ascent (m)">
            <input
              className={inputClassName}
              type="number"
              min={0}
              max={20000}
              step={1}
              value={draft.cumulativeAscentM}
              onChange={(event) =>
                updateNumber("cumulativeAscentM", event.target.value)
              }
              onBlur={() =>
                restoreDraft("cumulativeAscentM", value.cumulativeAscentM.toString())
              }
            />
          </Field>

          <Field label="Cumul. descent (m)">
            <input
              className={inputClassName}
              type="number"
              min={0}
              max={20000}
              step={1}
              value={draft.cumulativeDescentM}
              onChange={(event) =>
                updateNumber("cumulativeDescentM", event.target.value)
              }
              onBlur={() =>
                restoreDraft(
                  "cumulativeDescentM",
                  value.cumulativeDescentM.toString()
                )
              }
            />
          </Field>

          <Field label="Ambient temp (C)">
            <input
              className={inputClassName}
              type="number"
              min={-25}
              max={55}
              step={0.1}
              value={draft.ambientTempC}
              onChange={(event) => updateNumber("ambientTempC", event.target.value)}
              onBlur={() =>
                restoreDraft("ambientTempC", value.ambientTempC.toString())
              }
            />
          </Field>

          <Field label="Terrain factor (1.0 - 1.5)">
            <input
              className={inputClassName}
              type="number"
              min={1}
              max={1.6}
              step={0.01}
              value={draft.terrainFactor}
              onChange={(event) => updateNumber("terrainFactor", event.target.value)}
              onBlur={() =>
                restoreDraft("terrainFactor", value.terrainFactor.toString())
              }
            />
          </Field>
        </div>
      )}

      <div className="rounded-[24px] border border-slate-800/80 bg-[rgba(10,18,30,0.72)] p-5">
        <div className="mb-4 text-[11px] uppercase tracking-[0.28em] text-slate-500">
          Engine preview
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <PreviewMetric label="Total kcal" value={`${Math.round(plan.totalKcal)}`} />
          <PreviewMetric label="Output" value={plan.selectedEngine} />
          <PreviewMetric label="Fuel buffer" value={formatSigned(plan.fuelBufferG, "g")} />
          <PreviewMetric label="Fuel deficit" value={`${Math.round(plan.fuelDeficitG)} g`} />
          <PreviewMetric label="Carbs / hour" value={`${Math.round(plan.carbPerHour)} g`} />
          <PreviewMetric
            label="Hydration / hour"
            value={`${plan.hydrationPerHour} ml`}
          />
          <PreviewMetric label="Dose carbs" value={`${plan.carbDoseG} g`} />
          <PreviewMetric
            label="Dose drink"
            value={`${plan.hydrationDoseMl} ml`}
          />
          <PreviewMetric label="RER" value={plan.averageRer.toFixed(2)} />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300">
            {plan.effortLabel} {plan.zoneLabel}
          </span>
          <span>Estimated max HR {plan.estimatedMaxHr} bpm</span>
          <span>Body fat {plan.bodyFatPctUsed}% ({plan.bodyFatSource})</span>
          <span>Keytel {Math.round(plan.keytelTotalKcal)} kcal</span>
          <span>Minetti {Math.round(plan.minettiTotalKcal)} kcal</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onStart}
        className="w-full rounded-[18px] bg-cyan-400 px-6 py-5 text-base font-semibold uppercase tracking-[0.1em] text-slate-950 transition hover:bg-cyan-300"
      >
        Start session
      </button>
    </div>
  );
}

function EquationButton({
  active,
  title,
  body,
  onClick
}: {
  active: boolean;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-4 text-left transition ${
        active
          ? "border-cyan-400/70 bg-cyan-400/10 text-cyan-100"
          : "border-slate-800 bg-[rgba(3,9,19,0.45)] text-slate-300 hover:border-slate-600"
      }`}
    >
      <div className="text-base font-semibold">{title}</div>
      <div className="mt-1 text-sm text-slate-500">{body}</div>
    </button>
  );
}

function InputTab({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
        active
          ? "bg-cyan-400 text-slate-950"
          : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

function Field({
  label,
  className,
  children
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`space-y-2 ${className ?? ""}`}>
      <div className="text-sm font-medium tracking-wide text-slate-300">
        {label}
      </div>
      {children}
    </label>
  );
}

function PreviewMetric({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[rgba(3,9,19,0.65)] px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-wide text-slate-100">
        {value}
      </div>
    </div>
  );
}

const inputClassName =
  "h-14 w-full rounded-2xl border border-slate-800 bg-[#060b16] px-4 text-lg text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60";

function formatSigned(value: number, unit: string) {
  return `${value > 0 ? "+" : ""}${Math.round(value)}${unit}`;
}
