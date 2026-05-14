"use client";

import type {
  WatchConnectionStatus as WatchConnectionStatusValue,
  WatchProvider
} from "@/integrations/watch/types";

interface WatchConnectionStatusProps {
  provider: WatchProvider;
  status: WatchConnectionStatusValue;
}

export function WatchConnectionStatus({
  provider,
  status
}: WatchConnectionStatusProps) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-950/35 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-100">
            {provider.label}
          </div>
          <div className="mt-1 text-xs leading-5 text-slate-500">
            {provider.description}
          </div>
        </div>
        <StatusChip status={status} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DataList
          title="Expected watch data"
          items={provider.expectedData.map((field) => ({
            label: field.key,
            detail: field.availability
          }))}
        />
        <DataList
          title="FuelPlan output"
          items={provider.outputFields.map((field) => ({
            label: field.key,
            detail: "send"
          }))}
        />
      </div>
    </section>
  );
}

function StatusChip({ status }: { status: WatchConnectionStatusValue }) {
  const label = formatStatus(status);
  const className =
    status === "demo_connected"
      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
      : status === "real_integration_pending"
        ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
        : status === "error"
          ? "border-rose-400/40 bg-rose-400/10 text-rose-200"
          : "border-slate-600 bg-slate-900 text-slate-300";

  return (
    <div
      className={`w-fit rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${className}`}
    >
      {label}
    </div>
  );
}

function DataList({
  title,
  items
}: {
  title: string;
  items: Array<{ label: string; detail: string }>;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
        {title}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={`${title}-${item.label}`}
            className="rounded-full border border-slate-800 bg-slate-950/50 px-2.5 py-1 text-xs text-slate-300"
          >
            {item.label}
            <span className="pl-1 text-slate-600">{item.detail}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function formatStatus(status: WatchConnectionStatusValue) {
  switch (status) {
    case "demo_connected":
      return "Demo connected";
    case "real_integration_pending":
      return "Real integration pending";
    case "error":
      return "Error";
    case "not_connected":
      return "Not connected";
  }
}
