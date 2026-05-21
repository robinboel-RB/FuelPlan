"use client";

import type { WatchProviderId } from "@/integrations/watch/types";
import {
  getWatchProvider,
  selectableWatchProviders
} from "@/integrations/watch/watchProviderRegistry";

interface WatchProviderSelectorProps {
  selectedProviderId: WatchProviderId;
  onSelectProvider: (providerId: WatchProviderId) => void;
}

export function WatchProviderSelector({
  selectedProviderId,
  onSelectProvider
}: WatchProviderSelectorProps) {
  return (
    <section className="space-y-3">
      <div className="text-[11px] uppercase tracking-[0.26em] text-slate-500">
        Watch integration
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {selectableWatchProviders.map((providerId) => {
          const provider = getWatchProvider(providerId);
          const isActive = selectedProviderId === providerId;

          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => onSelectProvider(provider.id)}
              className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                isActive
                  ? "border-cyan-400/70 bg-cyan-400/10 text-cyan-100"
                  : "border-slate-800 bg-slate-950/35 text-slate-300 hover:border-slate-600"
              }`}
            >
              {provider.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
