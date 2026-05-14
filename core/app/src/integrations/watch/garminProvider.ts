import { commonWatchOutputFields } from "@/integrations/watch/mockWatchProvider";
import type { WatchProvider } from "@/integrations/watch/types";

export const garminProvider: WatchProvider = {
  id: "garmin",
  label: "Garmin",
  status: "real_integration_pending",
  description:
    "Connect IQ route for a Data Field or Watch App. The MVP keeps simulation data active until a Monkey C implementation exists.",
  modeLabel: "Connect IQ integration pending",
  expectedData: [
    { key: "heartRate", availability: "required" },
    { key: "distance", availability: "required" },
    { key: "pace/speed", availability: "required" },
    { key: "elapsedTime", availability: "required" },
    { key: "elevation/grade", availability: "optional" },
    { key: "temperature", availability: "limited" }
  ],
  outputFields: commonWatchOutputFields,
  connect: () => {
    // TODO: Build a Monkey C Connect IQ DataField or Watch App.
    // TODO: Read Activity.Info during each compute cycle for HR, distance,
    // pace/speed, elapsed time, and available elevation metrics.
    // TODO: Render FuelPlan output as a data field and/or alert on the watch.
    return "real_integration_pending";
  },
  disconnect: () => "not_connected"
};
