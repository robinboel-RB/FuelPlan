"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CoachInput,
  DEFAULT_COACH_INPUT,
  IntakeEvent,
  SIMULATION_STEP_MIN,
  calculateCoachPlan,
  calculateSessionSummary,
  createFuelPlanWatchOutput,
  formatClockLabel,
  sanitizeCoachInput
} from "@/engine/fuelingEngine";
import { createMockWatchSensorSample } from "@/integrations/watch/mockWatchProvider";
import {
  getWatchProvider,
  resolveWatchProviderStatus
} from "@/integrations/watch/watchProviderRegistry";
import {
  WatchConnectionStatus,
  WatchProviderId
} from "@/integrations/watch/types";

export type CoachScreen = "setup" | "guidance";

export function useCoachSession() {
  const [screen, setScreen] = useState<CoachScreen>("setup");
  const [input, setInput] = useState<CoachInput>(DEFAULT_COACH_INPUT);
  const [elapsedMinute, setElapsedMinute] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [intakeEvents, setIntakeEvents] = useState<IntakeEvent[]>([]);
  const [selectedWatchProviderId, setSelectedWatchProviderId] =
    useState<WatchProviderId>("samsung");
  const [watchConnectionStatus, setWatchConnectionStatus] =
    useState<WatchConnectionStatus>("real_integration_pending");

  const sessionEndMinute = useMemo(
    () => Math.ceil(sanitizeCoachInput(input).segmentDurationMin),
    [input]
  );

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const timerId = window.setInterval(() => {
      setElapsedMinute((previous) => {
        const next = Math.min(previous + SIMULATION_STEP_MIN, sessionEndMinute);

        if (next >= sessionEndMinute) {
          setIsRunning(false);
        }

        return next;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isRunning, sessionEndMinute]);

  const plan = useMemo(
    () => calculateCoachPlan(input, elapsedMinute, isRunning, intakeEvents),
    [elapsedMinute, input, intakeEvents, isRunning]
  );

  const summary = useMemo(
    () => calculateSessionSummary(plan, intakeEvents, elapsedMinute),
    [elapsedMinute, intakeEvents, plan]
  );

  const isCompleted = elapsedMinute >= sessionEndMinute;
  const selectedWatchProvider = useMemo(
    () => getWatchProvider(selectedWatchProviderId),
    [selectedWatchProviderId]
  );
  const watchSensorSample = useMemo(
    () => createMockWatchSensorSample({ input, elapsedMinute }),
    [elapsedMinute, input]
  );
  const watchOutput = useMemo(
    () => createFuelPlanWatchOutput(watchSensorSample, plan),
    [plan, watchSensorSample]
  );

  const selectWatchProvider = (providerId: WatchProviderId) => {
    setSelectedWatchProviderId(providerId);
    setWatchConnectionStatus(resolveWatchProviderStatus(providerId));
  };

  const startSession = () => {
    setScreen("guidance");
    setElapsedMinute(0);
    setIsRunning(true);
    setIntakeEvents([]);
  };

  const pauseSession = () => {
    setIsRunning(false);
  };

  const resumeSession = () => {
    if (!isCompleted) {
      setIsRunning(true);
    }
  };

  const backToSetup = () => {
    setScreen("setup");
    setElapsedMinute(0);
    setIsRunning(false);
    setIntakeEvents([]);
  };

  const appendEvent = (event: IntakeEvent) => {
    setIntakeEvents((previous) => [...previous, event]);
  };

  const takeCarbs = () => {
    appendEvent({
      id: `carbs-${Date.now()}`,
      minute: elapsedMinute,
      clockLabel: formatClockLabel(elapsedMinute),
      type: "carbs",
      amount: plan.carbDoseG,
      unit: "g"
    });
  };

  const takeDrink = () => {
    appendEvent({
      id: `drink-${Date.now()}`,
      minute: elapsedMinute,
      clockLabel: formatClockLabel(elapsedMinute),
      type: "hydration",
      amount: plan.hydrationDoseMl,
      unit: "ml"
    });
  };

  const skipReminder = () => {
    if (plan.dueCarbMinute === null && plan.dueHydrationMinute === null) {
      return;
    }

    appendEvent({
      id: `skip-${Date.now()}`,
      minute: elapsedMinute,
      clockLabel: formatClockLabel(elapsedMinute),
      type: "skip",
      amount: 0,
      unit: "",
      targets: [
        ...(plan.dueCarbMinute !== null ? (["carbs"] as const) : []),
        ...(plan.dueHydrationMinute !== null ? (["hydration"] as const) : [])
      ]
    });
  };

  return {
    screen,
    input,
    setInput,
    selectedWatchProviderId,
    selectedWatchProvider,
    watchConnectionStatus,
    watchSensorSample,
    watchOutput,
    selectWatchProvider,
    elapsedMinute,
    isRunning,
    isCompleted,
    intakeEvents,
    plan,
    summary,
    startSession,
    pauseSession,
    resumeSession,
    backToSetup,
    takeCarbs,
    takeDrink,
    skipReminder
  };
}
