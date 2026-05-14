import { commonWatchOutputFields } from "@/integrations/watch/mockWatchProvider";
import type { WatchProvider } from "@/integrations/watch/types";

export const samsungProvider: WatchProvider = {
  id: "samsung",
  label: "Samsung",
  status: "real_integration_pending",
  description:
    "Galaxy Watch / Wear OS route for live exercise metrics. The MVP keeps simulation data active until a companion app is built.",
  modeLabel: "Wear OS integration pending",
  expectedData: [
    { key: "heartRate", availability: "required" },
    { key: "distance", availability: "required" },
    { key: "pace/speed", availability: "required" },
    { key: "elapsedTime", availability: "required" },
    { key: "elevation/grade", availability: "optional" },
    { key: "temperature", availability: "optional" }
  ],
  outputFields: commonWatchOutputFields,
  connect: () => {
    // TODO: Build a Wear OS companion app for live HR, distance, pace, and elapsed time.
    // TODO: Use Wear OS Health Services for exercise metrics during an active workout.
    // TODO: Optionally use Samsung Health Sensor SDK for BioActive Sensor data
    // such as HR, IBI, PPG, and skin temperature where device/API access allows it.
    return "real_integration_pending";
  },
  disconnect: () => "not_connected"
};
