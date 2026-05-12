"use client";

import { useEffect, useMemo, useState } from "react";
import { GuidancePanel } from "@/components/mvp/GuidancePanel";
import { SetupPanel } from "@/components/mvp/SetupPanel";
import { WatchCoach } from "@/components/mvp/WatchCoach";
import {
  CoachInput,
  DEFAULT_COACH_INPUT,
  IntakeEvent,
  SIMULATION_STEP_MIN,
  SIMULATION_TOTAL_MIN,
  calculateCoachPlan,
  calculateSessionSummary,
  formatClockLabel
} from "@/lib/mvp/coachModel";

type Screen = "setup" | "guidance";

export default function HomePage() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [input, setInput] = useState<CoachInput>(DEFAULT_COACH_INPUT);
  const [elapsedMinute, setElapsedMinute] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [intakeEvents, setIntakeEvents] = useState<IntakeEvent[]>([]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const timerId = window.setInterval(() => {
      setElapsedMinute((previous) => {
        const next = Math.min(previous + SIMULATION_STEP_MIN, SIMULATION_TOTAL_MIN);

        if (next >= SIMULATION_TOTAL_MIN) {
          setIsRunning(false);
        }

        return next;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isRunning]);

  const plan = useMemo(
    () => calculateCoachPlan(input, elapsedMinute, isRunning, intakeEvents),
    [elapsedMinute, input, intakeEvents, isRunning]
  );

  const summary = useMemo(
    () => calculateSessionSummary(plan, intakeEvents, elapsedMinute),
    [elapsedMinute, intakeEvents, plan]
  );
  const isCompleted = elapsedMinute >= SIMULATION_TOTAL_MIN;

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
    if (isCompleted) {
      return;
    }

    setIsRunning(true);
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

  return (
    <main className="min-h-screen px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-[1600px] space-y-8">
        <header className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.26em] text-slate-500">
            FuelPlan MVP
          </div>
          <div className="max-w-3xl space-y-2">
            <h1 className="text-4xl font-semibold tracking-wide text-slate-100 md:text-[3.35rem]">
              Real-time fueling coach
            </h1>
            <p className="max-w-2xl text-sm text-slate-400 md:text-base">
              Rechts vul je athlete- en segmentdata in. Links toont de watch live
              wanneer je tijdens de sessie moet eten of drinken.
            </p>
          </div>
        </header>

        <div className="grid gap-8 xl:grid-cols-[470px_minmax(0,1fr)] xl:items-start">
          <section className="xl:sticky xl:top-8">
            <WatchCoach input={input} plan={plan} elapsedMinute={elapsedMinute} />
          </section>

          <section>
            {screen === "setup" ? (
              <SetupPanel
                value={input}
                plan={plan}
                onChange={setInput}
                onStart={startSession}
              />
            ) : (
              <GuidancePanel
                plan={plan}
                summary={summary}
                intakeEvents={intakeEvents}
                elapsedMinute={elapsedMinute}
                isRunning={isRunning}
                isCompleted={isCompleted}
                onPause={pauseSession}
                onResume={resumeSession}
                onBackToSetup={backToSetup}
                onTakeCarbs={takeCarbs}
                onTakeDrink={takeDrink}
                onSkip={skipReminder}
              />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
