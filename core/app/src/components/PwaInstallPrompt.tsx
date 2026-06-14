"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type InstallState =
  | "standalone"
  | "chromium-ready"
  | "ios-helper"
  | "browser-helper"
  | "unsupported";

export function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [message, setMessage] = useState("Installatiestatus wordt gecontroleerd.");
  const [platform, setPlatform] = useState("unknown");

  useEffect(() => {
    setPlatform(detectInstallPlatform());
    setIsInstalled(isStandaloneDisplay());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setMessage("FuelPlan kan als app worden geinstalleerd op dit toestel.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const installState = resolveInstallState({
    canPrompt: Boolean(installPrompt),
    isInstalled,
    platform
  });

  const installApp = async () => {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    setMessage(
      choice.outcome === "accepted"
        ? "FuelPlan wordt geinstalleerd."
        : "Installatie geannuleerd. Je kan later opnieuw installeren."
    );
  };

  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
            PWA install
          </div>
          <div className={`mt-2 w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${resolveInstallClassName(installState)}`}>
            {formatInstallState(installState)}
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            {resolveInstallMessage(installState, message)}
          </p>
        </div>

        {installPrompt ? (
          <button
            type="button"
            onClick={installApp}
            className="w-fit rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100"
          >
            Install app
          </button>
        ) : null}
      </div>
    </section>
  );
}

function detectInstallPlatform() {
  if (typeof window === "undefined") {
    return "unknown";
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIos =
    /iphone|ipad|ipod/.test(userAgent) ||
    (userAgent.includes("mac") && "ontouchend" in document);
  const isAndroid = userAgent.includes("android");

  if (isIos) {
    return "ios";
  }

  if (isAndroid) {
    return "android";
  }

  return "desktop";
}

function isStandaloneDisplay() {
  if (typeof window === "undefined") {
    return false;
  }

  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean;
  };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

function resolveInstallState({
  canPrompt,
  isInstalled,
  platform
}: {
  canPrompt: boolean;
  isInstalled: boolean;
  platform: string;
}): InstallState {
  if (isInstalled) {
    return "standalone";
  }

  if (canPrompt) {
    return "chromium-ready";
  }

  if (platform === "ios") {
    return "ios-helper";
  }

  if (platform === "android" || platform === "desktop") {
    return "browser-helper";
  }

  return "unsupported";
}

function resolveInstallMessage(state: InstallState, message: string) {
  switch (state) {
    case "standalone":
      return "FuelPlan draait als geinstalleerde PWA.";
    case "chromium-ready":
      return message;
    case "ios-helper":
      return "iOS: open deze pagina in Safari, tik Deel en kies Voeg toe aan beginscherm.";
    case "browser-helper":
      return "Android Chrome toont de install prompt zodra de browser de PWA installable vindt. Gebruik anders het browsermenu en kies Install app.";
    case "unsupported":
      return "Deze browser geeft geen PWA install prompt door.";
  }
}

function formatInstallState(state: InstallState) {
  switch (state) {
    case "standalone":
      return "installed";
    case "chromium-ready":
      return "install ready";
    case "ios-helper":
      return "ios helper";
    case "browser-helper":
      return "install helper";
    case "unsupported":
      return "unsupported";
  }
}

function resolveInstallClassName(state: InstallState) {
  if (state === "standalone" || state === "chromium-ready") {
    return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
  }

  if (state === "ios-helper" || state === "browser-helper") {
    return "border-amber-400/40 bg-amber-400/10 text-amber-200";
  }

  return "border-slate-600 bg-slate-900 text-slate-300";
}
