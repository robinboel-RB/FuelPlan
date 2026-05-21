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
  integrationSteps: [
    {
      title: "Build Connect IQ Data Field",
      detail:
        "Create a Monkey C Data Field first, because it can run inside an existing Garmin activity."
    },
    {
      title: "Read Activity.Info",
      detail:
        "Use each compute cycle to read currentHeartRate, elapsedDistance, speed/pace, elapsedTime, ascent, and descent when available."
    },
    {
      title: "Render FuelPlan field",
      detail:
        "Display next action, dose, timer, fuel buffer, and fuel deficit in the data field layout."
    },
    {
      title: "Add alert path later",
      detail:
        "Promote due carbs/drink into a watch alert only after the passive data field is stable."
    }
  ],
  connect: () => {
    // TODO: Build a Monkey C Connect IQ DataField or Watch App.
    // TODO: Read Activity.Info during each compute cycle for HR, distance,
    // pace/speed, elapsed time, and available elevation metrics.
    // TODO: Render FuelPlan output as a data field and/or alert on the watch.
    return "real_integration_pending";
  },
  disconnect: () => "not_connected"
};
