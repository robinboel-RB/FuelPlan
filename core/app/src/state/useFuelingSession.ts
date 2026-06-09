"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FuelPlanWatchOutput } from "@/integrations/watch/types";
import {
  CoachInput,
  CoachPlan,
  DEFAULT_COACH_INPUT,
  IntakeEvent,
  buildFuelingCoreInput,
  calculateSessionSummary,
  createCoachPlanFromFuelingCore,
  formatClockLabel,
  sanitizeCoachInput
} from "@/engine/fuelingEngine";
import type {
  FuelingCoreInput,
  FuelingCoreResult,
  FuelingCoreTrigger
} from "@/types/fuelingCore";

export const ACTIVE_SESSION_INPUT_KEY = "fuelplan.activeSessionInput";
export const ACTIVE_FUELING_PLAN_KEY = "fuelplan.activeFuelingPlan";

export type CalculationStatus = "idle" | "calculating" | "ready" | "error";
export type LiveSessionStatus = "idle" | "running" | "paused" | "finished";
export type CoachScreen = "setup" | "guidance";

interface FuelingCalculateResponse {
  ok: boolean;
  result?: FuelingCoreResult;
  error?: string;
}

interface UseFuelingSessionOptions {
  mode?: "dashboard" | "live";
}

export function useFuelingSession(options: UseFuelingSessionOptions = {}) {
  const mode = options.mode ?? "dashboard";
  const router = useRouter();
  const [screen, setScreen] = useState<CoachScreen>("setup");
  const [input, setInput] = useState<CoachInput>(DEFAULT_COACH_INPUT);
  const [calculatedFuelingPlan, setCalculatedFuelingPlan] =
    useState<FuelingCoreResult | null>(null);
  const [calculationStatus, setCalculationStatus] =
    useState<CalculationStatus>("idle");
  const [calculationError, setCalculationError] = useState<string | null>(null);
  const [liveSessionStatus, setLiveSessionStatus] =
    useState<LiveSessionStatus>("idle");
  const [elapsedMinute, setElapsedMinute] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [firedTriggerMinutes, setFiredTriggerMinutes] = useState<number[]>([]);
  const [intakeEvents, setIntakeEvents] = useState<IntakeEvent[]>([]);
  const liveStartedAtMsRef = useRef<number | null>(null);
  const calculationRequestIdRef = useRef(0);

  const isRunning = liveSessionStatus === "running";
  const sessionEndMinute = useMemo(
    () => Math.ceil(sanitizeCoachInput(input).segmentDurationMin),
    [input]
  );

  const calculate = useCallback(
    async (nextInput: CoachInput, nextIntakeEvents: IntakeEvent[] = []) => {
      const requestId = calculationRequestIdRef.current + 1;
      calculationRequestIdRef.current = requestId;
      setCalculationStatus("calculating");
      setCalculationError(null);

      const payload = buildFuelingCoreInput(nextInput, nextIntakeEvents);
      const result = await requestFuelingPlan(payload);

      if (calculationRequestIdRef.current === requestId) {
        setCalculatedFuelingPlan(result);
        setCalculationStatus("ready");
      }

      return result;
    },
    []
  );

  useEffect(() => {
    if (mode !== "dashboard") {
      return;
    }

    let isCancelled = false;
    const timeoutId = window.setTimeout(() => {
      void calculate(input, intakeEvents).catch((error) => {
        if (isCancelled) {
          return;
        }

        setCalculatedFuelingPlan(null);
        setCalculationStatus("error");
        setCalculationError(
          error instanceof Error ? error.message : "Fueling calculation failed"
        );
      });
    }, 250);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [calculate, input, intakeEvents, mode]);

  useEffect(() => {
    if (mode === "live") {
      loadActiveSessionFromStorage();
    }
  }, [mode]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const timerId = window.setInterval(() => {
      if (mode === "live") {
        if (liveStartedAtMsRef.current === null) {
          liveStartedAtMsRef.current = Date.now() - elapsedSeconds * 1000;
        }

        const nextElapsedSeconds = Math.floor(
          (Date.now() - liveStartedAtMsRef.current) / 1000
        );
        const nextElapsedMinute = Math.floor(nextElapsedSeconds / 60);

        setElapsedSeconds(nextElapsedSeconds);
        setElapsedMinute(Math.min(nextElapsedMinute, sessionEndMinute));

        if (nextElapsedMinute >= sessionEndMinute) {
          setLiveSessionStatus("finished");
          liveStartedAtMsRef.current = null;
        }

        return;
      }

      setElapsedMinute((previous) => {
        const next = Math.min(previous + 1, sessionEndMinute);
        setElapsedSeconds(next * 60);

        if (next >= sessionEndMinute) {
          setLiveSessionStatus("finished");
        }

        return next;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [elapsedSeconds, isRunning, mode, sessionEndMinute]);

  const plan = useMemo(
    () =>
      createCoachPlanFromFuelingCore(
        input,
        calculatedFuelingPlan,
        elapsedMinute,
        isRunning,
        firedTriggerMinutes,
        intakeEvents
      ),
    [
      calculatedFuelingPlan,
      elapsedMinute,
      firedTriggerMinutes,
      input,
      intakeEvents,
      isRunning
    ]
  );

  const summary = useMemo(
    () => calculateSessionSummary(plan, intakeEvents, elapsedMinute),
    [elapsedMinute, intakeEvents, plan]
  );
  const isCompleted = elapsedMinute >= sessionEndMinute;
  const nextPendingTrigger = useMemo(
    () => resolveNextPendingTrigger(calculatedFuelingPlan, firedTriggerMinutes),
    [calculatedFuelingPlan, firedTriggerMinutes]
  );
  const watchOutput = useMemo(
    () => createWatchOutput(plan),
    [plan]
  );

  const startSession = () => {
    setScreen("guidance");
    setElapsedMinute(0);
    setElapsedSeconds(0);
    setFiredTriggerMinutes([]);
    setIntakeEvents([]);
    liveStartedAtMsRef.current = mode === "live" ? Date.now() : null;
    setLiveSessionStatus("running");
  };

  const pauseSession = () => {
    setLiveSessionStatus("paused");
    liveStartedAtMsRef.current = null;
  };

  const resumeSession = () => {
    if (!isCompleted) {
      liveStartedAtMsRef.current =
        mode === "live" ? Date.now() - elapsedSeconds * 1000 : null;
      setLiveSessionStatus("running");
    }
  };

  const resetSession = () => {
    setElapsedMinute(0);
    setElapsedSeconds(0);
    setFiredTriggerMinutes([]);
    setLiveSessionStatus("idle");
    liveStartedAtMsRef.current = null;
  };

  const backToSetup = () => {
    setScreen("setup");
    resetSession();
    setIntakeEvents([]);
  };

  const appendEvent = (event: IntakeEvent) => {
    setIntakeEvents((previous) => [...previous, event]);
  };

  const markTriggerFired = (minute: number) => {
    setFiredTriggerMinutes((previous) =>
      previous.includes(minute) ? previous : [...previous, minute]
    );
  };

  const takeCarbs = () => {
    if (plan.dueCarbMinute !== null) {
      markTriggerFired(plan.dueCarbMinute);
    }

    appendEvent({
      id: `carbs-${Date.now()}`,
      minute: elapsedMinute,
      clockLabel: formatClockLabel(elapsedMinute),
      type: "carbs",
      amount: plan.carbDoseG,
      unit: "g"
    });
  };

  const skipReminder = () => {
    if (plan.dueCarbMinute === null) {
      return;
    }

    markTriggerFired(plan.dueCarbMinute);
    appendEvent({
      id: `skip-${Date.now()}`,
      minute: elapsedMinute,
      clockLabel: formatClockLabel(elapsedMinute),
      type: "skip",
      amount: 0,
      unit: "",
      targets: ["carbs"]
    });
  };

  const startLiveSession = () => {
    if (!calculatedFuelingPlan || calculationStatus !== "ready") {
      setCalculationError("Fueling plan is nog niet klaar.");
      return;
    }

    persistActiveSession(input, calculatedFuelingPlan);
    router.push("/live-session");
  };

  function loadActiveSessionFromStorage() {
    if (typeof window === "undefined") {
      return;
    }

    const storedInput = window.localStorage.getItem(ACTIVE_SESSION_INPUT_KEY);
    const storedPlan = window.localStorage.getItem(ACTIVE_FUELING_PLAN_KEY);

    if (!storedInput || !storedPlan) {
      setCalculationStatus("error");
      setCalculationError("Geen actieve sessie. Ga naar dashboard en start een sessie.");
      return;
    }

    try {
      setInput(JSON.parse(storedInput) as CoachInput);
      setCalculatedFuelingPlan(JSON.parse(storedPlan) as FuelingCoreResult);
      setCalculationStatus("ready");
      setCalculationError(null);
    } catch {
      setCalculationStatus("error");
      setCalculationError("Actieve sessie kon niet worden gelezen.");
    }
  }

  return {
    screen,
    input,
    setInput,
    calculatedFuelingPlan,
    fuelingPlan: calculatedFuelingPlan,
    calculationStatus,
    calculationError,
    liveSessionStatus,
    elapsedMinute,
    elapsedSeconds,
    isRunning,
    isCompleted,
    firedTriggerMinutes,
    intakeEvents,
    plan,
    summary,
    nextPendingTrigger,
    watchOutput,
    calculate,
    startSession,
    startLiveSession,
    pauseSession,
    resumeSession,
    resetSession,
    backToSetup,
    takeCarbs,
    skipReminder,
    markTriggerFired,
    loadActiveSessionFromStorage
  };
}

export function persistActiveSession(
  input: CoachInput,
  fuelingPlan: FuelingCoreResult
) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACTIVE_SESSION_INPUT_KEY, JSON.stringify(input));
  window.localStorage.setItem(
    ACTIVE_FUELING_PLAN_KEY,
    JSON.stringify(fuelingPlan)
  );
}

async function requestFuelingPlan(
  payload: FuelingCoreInput
): Promise<FuelingCoreResult> {
  const response = await fetch("/api/fueling/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const json = (await response.json()) as FuelingCalculateResponse;

  if (!response.ok || !json.ok || !json.result) {
    throw new Error(json.error || "Fueling calculation failed");
  }

  return json.result;
}

function resolveNextPendingTrigger(
  plan: FuelingCoreResult | null,
  firedTriggerMinutes: number[]
): FuelingCoreTrigger | null {
  if (!plan) {
    return null;
  }

  return (
    plan.triggers.find((trigger) => !firedTriggerMinutes.includes(trigger.minute)) ??
    null
  );
}

function createWatchOutput(plan: CoachPlan): FuelPlanWatchOutput {
  const hasCarbAction = plan.dueCarbMinute !== null || plan.nextCarbMinute < plan.sessionDurationMin;

  return {
    nextFuelAction: hasCarbAction ? "carbs" : "none",
    carbsDoseGrams: hasCarbAction ? plan.carbDoseG : 0,
    drinkDoseMl: 0,
    nextActionTimerSeconds: Math.max(0, plan.nextFuelActionInMin * 60),
    fuelBufferGrams: plan.fuelBufferG,
    fuelDeficitGrams: plan.fuelDeficitG,
    message: plan.fuelMessage
  };
}
