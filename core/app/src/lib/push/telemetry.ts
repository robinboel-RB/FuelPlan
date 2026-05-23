export type PushTelemetryEvent =
  | "subscribe_success"
  | "subscribe_failure"
  | "unsubscribe_success"
  | "send_success"
  | "send_failure"
  | "permission_denied"
  | "cleanup_404_410";

export function recordPushTelemetry(
  event: PushTelemetryEvent,
  metadata: Record<string, string | number | boolean | undefined> = {}
) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  console.info("[fuelplan-push]", event, metadata);
}
