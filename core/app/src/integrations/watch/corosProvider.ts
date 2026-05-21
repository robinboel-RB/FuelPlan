import { commonWatchOutputFields } from "@/integrations/watch/mockWatchProvider";
import type { WatchProvider } from "@/integrations/watch/types";

export const corosProvider: WatchProvider = {
  id: "coros",
  label: "COROS",
  status: "real_integration_pending",
  description:
    "COROS sync mode — live watch app pending/limited. MVP path is partner/API sync or file/workout exchange, not a Samsung/Garmin-style live custom app.",
  modeLabel: "COROS sync mode",
  expectedData: [
    { key: "heartRate", availability: "required" },
    { key: "distance", availability: "required" },
    { key: "pace/speed", availability: "required" },
    { key: "elapsedTime", availability: "required" },
    { key: "elevation/grade", availability: "optional" },
    { key: "temperature", availability: "limited" }
  ],
  outputFields: commonWatchOutputFields,
  integrationSteps: [
    {
      title: "Use sync mode for MVP",
      detail:
        "Treat COROS as file/API/workout-sync integration, not as a live custom watch app."
    },
    {
      title: "Request partner/API access",
      detail:
        "Submit a COROS API application before building account-level activity or workout sync."
    },
    {
      title: "Fallback to FIT exchange",
      detail:
        "Support FIT import/export or planned workout sync when partner access is unavailable."
    },
    {
      title: "Keep live prompts limited",
      detail:
        "Show FuelPlan planning and post-run analysis until COROS exposes a suitable live route."
    }
  ],
  connect: () => {
    // TODO: Explore COROS API / partner approval for post-activity or planned sync.
    // TODO: Support FIT import/export or planned workout sync if partner access is unavailable.
    // TODO: Keep UI explicit that live custom watch-app behavior is pending/limited for MVP.
    return "real_integration_pending";
  },
  disconnect: () => "not_connected"
};
