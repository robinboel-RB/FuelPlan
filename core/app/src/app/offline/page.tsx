export default function OfflinePage() {
  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center">
        <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-300">
          FuelPlan PWA
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-50">
          Offline
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-400">
          Je bent offline. De live coach shell blijft beschikbaar, maar nieuwe
          Web Push-subscriptions en servergestuurde meldingen hebben opnieuw
          netwerk nodig.
        </p>
        <a
          href="/live-session"
          className="mt-6 w-fit rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100"
        >
          Terug naar Live Fuel Coach
        </a>
      </div>
    </main>
  );
}
