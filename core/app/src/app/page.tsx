"use client";

import { useCoachSession } from "@/state/useCoachSession";
import { WatchPanel } from "@/components/WatchPanel";
import { GuidancePanel } from "@/ui/GuidancePanel";
import { SetupPanel } from "@/ui/SetupPanel";

export default function HomePage() {
  const session = useCoachSession();

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
            <WatchPanel
              input={session.input}
              plan={session.plan}
              elapsedMinute={session.elapsedMinute}
              selectedProviderId={session.selectedWatchProviderId}
              provider={session.selectedWatchProvider}
              connectionStatus={session.watchConnectionStatus}
              sensorSample={session.watchSensorSample}
              watchOutput={session.watchOutput}
              onSelectProvider={session.selectWatchProvider}
            />
          </section>

          <section>
            {session.screen === "setup" ? (
              <SetupPanel
                value={session.input}
                plan={session.plan}
                onChange={session.setInput}
                onStart={session.startSession}
              />
            ) : (
              <GuidancePanel
                plan={session.plan}
                summary={session.summary}
                intakeEvents={session.intakeEvents}
                elapsedMinute={session.elapsedMinute}
                isRunning={session.isRunning}
                isCompleted={session.isCompleted}
                onPause={session.pauseSession}
                onResume={session.resumeSession}
                onBackToSetup={session.backToSetup}
                onTakeCarbs={session.takeCarbs}
                onTakeDrink={session.takeDrink}
                onSkip={session.skipReminder}
              />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
