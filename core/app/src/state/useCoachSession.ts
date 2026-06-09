"use client";

import {
  CoachScreen,
  useFuelingSession
} from "@/state/useFuelingSession";

export type { CoachScreen };

export function useCoachSession() {
  return useFuelingSession({ mode: "dashboard" });
}
