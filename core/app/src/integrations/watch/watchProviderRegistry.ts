import { corosProvider } from "@/integrations/watch/corosProvider";
import { garminProvider } from "@/integrations/watch/garminProvider";
import { mockWatchProvider } from "@/integrations/watch/mockWatchProvider";
import { samsungProvider } from "@/integrations/watch/samsungProvider";
import type {
  WatchConnectionStatus,
  WatchProvider,
  WatchProviderId
} from "@/integrations/watch/types";

export const watchProviderRegistry: Record<WatchProviderId, WatchProvider> = {
  samsung: samsungProvider,
  garmin: garminProvider,
  coros: corosProvider,
  mock: mockWatchProvider
};

export const selectableWatchProviders: WatchProviderId[] = [
  "mock",
  "samsung",
  "garmin",
  "coros"
];

export function getWatchProvider(providerId: WatchProviderId): WatchProvider {
  return watchProviderRegistry[providerId];
}

export function resolveWatchProviderStatus(
  providerId: WatchProviderId
): WatchConnectionStatus {
  return getWatchProvider(providerId).connect();
}
